'use client';

import { useState, useRef, useEffect } from 'react';
import { startGame, sendAction } from '@/lib/api';
import { PlayerState, Message, ChoiceOption, AttributeChanges, ScoreDetail, GameSummary, Attributes } from '@/types/game';

const ATTR_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  appearance: { label: '外貌', color: 'text-pink-700', bg: 'bg-pink-100' },
  intelligence: { label: '智力', color: 'text-blue-700', bg: 'bg-blue-100' },
  constitution: { label: '体质', color: 'text-green-700', bg: 'bg-green-100' },
  wealth: { label: '财富', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  happiness: { label: '快乐', color: 'text-purple-700', bg: 'bg-purple-100' },
};

function formatDelta(val: number): string {
  if (val > 0) return `+${val}`;
  if (val < 0) return `${val}`;
  return '0';
}

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < count ? 'text-yellow-400' : 'text-gray-300'}>★</span>
      ))}
    </span>
  );
}

function AttributeChangesDisplay({ changes }: { changes: AttributeChanges }) {
  const entries = Object.entries(changes).filter(([k]) => ATTR_LABELS[k]);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-xs font-semibold text-gray-500 mb-2">📊 属性变化</div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, val]) => {
          const cfg = ATTR_LABELS[key];
          if (!cfg) return null;
          const isPositive = val > 0;
          const isZero = val === 0;
          return (
            <span
              key={key}
              className={`px-2 py-1 rounded-md text-xs font-medium ${
                isZero ? 'bg-gray-100 text-gray-400' : isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {cfg.label} {isZero ? '0' : formatDelta(val)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ScoreDisplay({ score }: { score: ScoreDetail }) {
  const dimensions = [
    { key: 'strategy', label: '策略性' },
    { key: 'logic', label: '逻辑性' },
    { key: 'social', label: '社交智慧' },
    { key: 'role_consistency', label: '角色一致' },
  ] as const;

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-xs font-semibold text-gray-500 mb-2">🎯 评分</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {dimensions.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-gray-600">{label}:</span>
            <Stars count={score[key] as number} />
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">总分:</span>
        <span className="text-sm font-bold text-gray-900">{score.total}/20</span>
      </div>
      {score.comments && (
        <p className="mt-1 text-xs text-gray-500 italic">{score.comments}</p>
      )}
    </div>
  );
}

function ChoicesDisplay({
  choices,
  onSelect,
  disabled,
}: {
  choices: ChoiceOption[];
  onSelect: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-4 space-y-2">
      <div className="text-xs font-semibold text-gray-500 mb-1">🤔 你的选择</div>
      {choices.map((choice, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(choice.text)}
          disabled={disabled}
          className="w-full text-left p-3 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-bold flex items-center justify-center">
              {String.fromCharCode(65 + idx)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                {choice.text}
              </p>
              {choice.hint && (
                <p className="text-xs text-gray-400 mt-0.5">{choice.hint}</p>
              )}
            </div>
          </div>
        </button>
      ))}
      <div className="text-center text-xs text-gray-400 mt-1">或输入自定义行动</div>
    </div>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of text) {
    const test = current + char;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default function Home() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [playerGender, setPlayerGender] = useState<string>('男');
  const [showNameInput, setShowNameInput] = useState(false);
  const [pendingChoices, setPendingChoices] = useState<ChoiceOption[]>([]);
  const [shareSummary, setShareSummary] = useState<{
    name: string; gender: string; age: number; ending: string;
    summary: GameSummary; attributes: Attributes;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 解析分享链接
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const share = params.get('share');
    if (share) {
      try {
        const data = JSON.parse(decodeURIComponent(atob(share)));
        setShareSummary({
          name: data.n || '未知',
          gender: data.g || '男',
          age: data.a || 0,
          ending: data.e || '',
          summary: { short_comment: data.sc || '', life_summary: data.ls || '', personality_analysis: data.pa || '' },
          attributes: data.at || { appearance: 5, intelligence: 5, constitution: 5, wealth: 5, happiness: 5 },
        });
      } catch {
        // invalid share data, ignore
      }
    }
  }, []);

  const addMessage = (
    type: 'system' | 'player' | 'choice',
    content: string,
    extra?: { choices?: ChoiceOption[]; attributeChanges?: AttributeChanges; score?: ScoreDetail; sceneTitle?: string }
  ) => {
    const newMessage: Message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: new Date(),
      ...extra,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleStartGame = async () => {
    if (!playerName.trim()) return;

    setIsLoading(true);
    try {
      const response = await startGame({ name: playerName.trim(), gender: playerGender });
      setGameId(response.game_id);
      setPlayerState(response.state);
      setShowNameInput(false);
      addMessage('system', response.scene_description);
    } catch (error) {
      addMessage('system', `错误: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChoiceSelect = async (choiceText: string) => {
    if (!gameId || isLoading || gameOver) return;
    setPendingChoices([]);
    await processPlayerInput(choiceText);
  };

  const processPlayerInput = async (playerInput: string) => {
    if (!gameId || isLoading || gameOver) return;

    addMessage('player', playerInput);
    setIsLoading(true);

    try {
      const response = await sendAction(gameId, { input: playerInput });

      // Add narrative as system message with structured data
      addMessage('system', response.narrative, {
        attributeChanges: response.attribute_changes,
        score: response.score,
        sceneTitle: response.scene_title,
      });

      // Update player state from response
      if (response.state) {
        setPlayerState(response.state);
      }

      // Set pending choices for the player
      if (response.choices && response.choices.length > 0) {
        setPendingChoices(response.choices);
      }

      // Check game over
      if (response.state && response.state.game_over) {
        setGameOver(true);
        setPendingChoices([]);
        if (response.summary) {
          setGameSummary(response.summary);
        }
      }
    } catch (error) {
      addMessage('system', `错误: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !gameId || isLoading || gameOver) return;

    const playerInput = input.trim();
    setInput('');
    setPendingChoices([]);
    await processPlayerInput(playerInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showNameInput) {
        handleStartGame();
      } else {
        handleSendMessage();
      }
    }
  };

  const handleRestart = () => {
    setGameId(null);
    setPlayerState(null);
    setMessages([]);
    setInput('');
    setGameOver(false);
    setGameSummary(null);
    setPlayerName('');
    setPlayerGender('男');
    setShowNameInput(false);
    setPendingChoices([]);
  };

  const getStageLabel = (stage: string): string => {
    const stageMap: Record<string, string> = {
      newborn: '新生儿',
      infant: '婴儿',
      child: '儿童',
      teen: '少年',
      adult: '成年',
      middle_age: '中年',
      senior: '老年',
      elder: '晚年',
    };
    return stageMap[stage] || stage;
  };

  // ===== 结算页分享功能 =====
  const settlementRef = useRef<HTMLDivElement>(null);

  const handleShareImage = async () => {
    if (!settlementRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      const w = 600, h = 900;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 背景渐变
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(0.5, '#312e81');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 装饰圆
      ctx.beginPath();
      ctx.arc(w / 2, 120, 50, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fill();

      // 标题
      ctx.fillStyle = '#e0e7ff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('浮生渡', w / 2, 80);

      // 结局
      const ending = playerState?.flags?.ending || '未知结局';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(ending, w / 2, 130);

      // 玩家信息
      if (playerState) {
        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#c7d2fe';
        const gender = playerState.gender === '女' ? '♀' : '♂';
        ctx.fillText(`${gender} ${playerState.name} · 终年${playerState.age}岁`, w / 2, 180);
      }

      // AI短评
      if (gameSummary) {
        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#f9a8d4';
        ctx.fillText(`「${gameSummary.short_comment}」`, w / 2, 240);

        // 人生总结
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#e0e7ff';
        const summaryLines = wrapText(ctx, gameSummary.life_summary, w - 80);
        let y = 290;
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText('— 人生总结 —', w / 2, y);
        y += 30;
        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#c7d2fe';
        for (const line of summaryLines) {
          ctx.fillText(line, w / 2, y);
          y += 22;
        }

        // 人格分析
        y += 15;
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText('— 人格分析 —', w / 2, y);
        y += 30;
        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#c7d2fe';
        const persLines = wrapText(ctx, gameSummary.personality_analysis, w - 80);
        for (const line of persLines) {
          ctx.fillText(line, w / 2, y);
          y += 22;
        }
      }

      // 最终属性
      if (playerState) {
        const attrs = playerState.attributes;
        const attrStr = `外貌${attrs.appearance}  智力${attrs.intelligence}  体质${attrs.constitution}  财富${attrs.wealth}  快乐${attrs.happiness}`;
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#818cf8';
        ctx.fillText(attrStr, w / 2, 770);
      }

      // 推广
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#6366f1';
      ctx.fillText('来浮生渡，开启你的命运之旅！', w / 2, 830);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#4f46e5';
      ctx.fillText('#浮生渡 #AI人生模拟', w / 2, 860);

      // 下载
      const link = document.createElement('a');
      link.download = `人生重开_${playerState?.name || '结算'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // fallback: ignore
    }
  };

  const handleShareLink = () => {
    if (!playerState || !gameSummary) return;
    const shareData = {
      n: playerState.name,
      g: playerState.gender,
      a: playerState.age,
      e: playerState.flags?.ending || '',
      sc: gameSummary.short_comment,
      ls: gameSummary.life_summary,
      pa: gameSummary.personality_analysis,
      at: playerState.attributes,
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
    const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('分享链接已复制到剪贴板！');
    }).catch(() => {
      prompt('复制分享链接：', url);
    });
  };

  // 分享链接结算页
  const renderShareSettlement = () => {
    if (!shareSummary) return null;
    const { name, gender, age, ending, summary, attributes } = shareSummary;
    const g = gender === '女' ? '♀' : '♂';

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-indigo-900 via-indigo-800 to-indigo-950 p-4">
        <div className="w-full max-w-md">
          <div className="text-center pt-6 pb-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-2xl">🌟</span>
            </div>
            <h2 className="text-lg font-bold text-indigo-200">浮生渡</h2>
            <div className="text-2xl font-black text-amber-400 my-2">{ending || '人生落幕'}</div>
            <p className="text-indigo-300 text-sm">{g} {name} · 终年 {age} 岁</p>
          </div>
          {summary.short_comment && (
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center mb-4">
              <span className="text-xl font-bold text-pink-300">「{summary.short_comment}」</span>
            </div>
          )}
          {summary.life_summary && (
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-4">
              <div className="text-xs font-semibold text-indigo-300 mb-2">📜 人生总结</div>
              <p className="text-sm text-indigo-100 leading-relaxed">{summary.life_summary}</p>
            </div>
          )}
          {summary.personality_analysis && (
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-4">
              <div className="text-xs font-semibold text-indigo-300 mb-2">🧠 人格分析</div>
              <p className="text-sm text-indigo-100 leading-relaxed">{summary.personality_analysis}</p>
            </div>
          )}
          <div className="flex justify-center gap-2 text-xs mb-4">
            <span className="px-2 py-1 bg-pink-500/20 text-pink-300 rounded">颜 {attributes.appearance}</span>
            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">智 {attributes.intelligence}</span>
            <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded">体 {attributes.constitution}</span>
            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded">财 {attributes.wealth}</span>
            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">乐 {attributes.happiness}</span>
          </div>
          <div className="bg-indigo-950/50 py-3 text-center rounded-xl">
            <p className="text-xs text-indigo-400">来浮生渡，开启你的命运之旅！</p>
            <p className="text-xs text-indigo-500">#浮生渡 #AI人生模拟</p>
          </div>
          <div className="text-center mt-6">
            <button
              onClick={() => { setShareSummary(null); window.history.replaceState({}, '', window.location.pathname); }}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transition-all"
            >
              🚀 开始我的人生
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 结算页面
  const renderSettlement = () => {
    if (!gameOver) return null;
    const ending = playerState?.flags?.ending || '未知结局';
    const gender = playerState?.gender === '女' ? '♀' : '♂';
    const summary = gameSummary; // 可能为 null（AI总结失败时）

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div ref={settlementRef} className="w-full max-w-md bg-gradient-to-b from-indigo-900 via-indigo-800 to-indigo-950 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
          {/* 顶部 */}
          <div className="text-center pt-8 pb-4 px-6">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-3xl">🌟</span>
            </div>
            <h2 className="text-xl font-bold text-indigo-200 mb-1">浮生渡</h2>
            <div className="text-3xl font-black text-amber-400 my-3">{ending}</div>
            <p className="text-indigo-300 text-sm">
              {gender} {playerState?.name} · 终年 {playerState?.age} 岁
            </p>
          </div>

          {/* AI短评 */}
          {summary && (
            <div className="mx-6 p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-center text-2xl font-bold text-pink-300 mb-1">
                「{summary.short_comment}」
              </div>
            </div>
          )}

          {/* 人生总结 */}
          {summary && (
            <div className="mx-6 mt-4 p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-xs font-semibold text-indigo-300 mb-2">📜 人生总结</div>
              <p className="text-sm text-indigo-100 leading-relaxed">{summary.life_summary}</p>
            </div>
          )}

          {/* 人格分析 */}
          {summary && (
            <div className="mx-6 mt-4 p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-xs font-semibold text-indigo-300 mb-2">🧠 人格分析</div>
              <p className="text-sm text-indigo-100 leading-relaxed">{summary.personality_analysis}</p>
            </div>
          )}

          {/* AI总结加载中 */}
          {!summary && (
            <div className="mx-6 mt-4 p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
              <div className="text-indigo-300 text-sm">AI 正在总结你的一生...</div>
            </div>
          )}

          {/* 最终属性 */}
          {playerState && (
            <div className="mx-6 mt-4 flex justify-center gap-2 text-xs">
              <span className="px-2 py-1 bg-pink-500/20 text-pink-300 rounded">颜 {playerState.attributes.appearance}</span>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">智 {playerState.attributes.intelligence}</span>
              <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded">体 {playerState.attributes.constitution}</span>
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded">财 {playerState.attributes.wealth}</span>
              <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">乐 {playerState.attributes.happiness}</span>
            </div>
          )}

          {/* 分享按钮 */}
          <div className="mx-6 mt-6 mb-6 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={handleShareImage}
                className="flex-1 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium rounded-xl hover:shadow-lg transition-all text-sm"
              >
                📸 生成结算图
              </button>
              <button
                onClick={handleShareLink}
                className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-medium rounded-xl hover:shadow-lg transition-all text-sm"
              >
                🔗 复制分享链接
              </button>
            </div>
            <button
              onClick={handleRestart}
              className="w-full py-2.5 bg-white/10 text-indigo-200 font-medium rounded-xl hover:bg-white/20 transition-all text-sm border border-white/10"
            >
              🔄 再来一局
            </button>
          </div>

          {/* 推广 */}
          <div className="bg-indigo-950/50 py-3 text-center">
            <p className="text-xs text-indigo-400">来浮生渡，开启你的命运之旅！</p>
            <p className="text-xs text-indigo-500">#浮生渡 #AI人生模拟</p>
          </div>
        </div>
      </div>
    );
  };

  const renderMessageContent = (message: Message) => {
    if (message.type === 'player') {
      return (
        <div className="max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl rounded-br-md shadow-sm bg-blue-500 text-white">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      );
    }

    // System message with structured content
    return (
      <div className="max-w-[90%] sm:max-w-[80%]">
        {/* Scene title */}
        {message.sceneTitle && (
          <div className="mb-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100 inline-block">
            <span className="text-xs font-bold text-blue-600">📍 {message.sceneTitle}</span>
          </div>
        )}

        {/* Narrative */}
        <div className="px-4 py-3 rounded-2xl rounded-bl-md shadow-sm bg-white text-gray-800 border border-gray-100">
          <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.content}</p>

          {/* Attribute changes */}
          {message.attributeChanges && (
            <AttributeChangesDisplay changes={message.attributeChanges} />
          )}

          {/* Score */}
          {message.score && (
            <ScoreDisplay score={message.score} />
          )}
        </div>
      </div>
    );
  };

  // 如果是分享链接，直接显示结算页
  if (shareSummary) {
    return <>{renderShareSettlement()}</>;
  }

  return (
    <main className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl">🎮</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">浮生渡</h1>
              <p className="text-xs text-gray-500">AI 驱动的沉浸式人生体验</p>
            </div>
          </div>
          {playerState && (
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="text-right">
                <div className="font-medium text-gray-900">{playerState.name}</div>
                <div className="text-gray-500">
                  {playerState.gender === '女' ? '♀' : '♂'} {playerState.age} 岁 · {getStageLabel(playerState.stage)}
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-md text-xs">
                  颜 {playerState.attributes.appearance}
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs">
                  智 {playerState.attributes.intelligence}
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs">
                  体 {playerState.attributes.constitution}
                </span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md text-xs">
                  财 {playerState.attributes.wealth}
                </span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs">
                  乐 {playerState.attributes.happiness}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                <span className="text-4xl">🌟</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎来到浮生渡</h2>
              <p className="text-gray-500 mb-8 text-center max-w-md">
                开启一段全新的人生旅程。你将经历成长、做出选择、面对挑战，最终书写属于自己的故事。
              </p>
              {!showNameInput ? (
                <button
                  onClick={() => setShowNameInput(true)}
                  className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105"
                >
                  🚀 开始新人生
                </button>
              ) : (
                <div className="w-full max-w-sm">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="请输入你的名字..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg mb-3"
                    autoFocus
                    disabled={isLoading}
                  />
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setPlayerGender('男')}
                      className={`flex-1 py-2.5 rounded-xl font-medium transition-all duration-200 border-2 ${
                        playerGender === '男'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      👦 男
                    </button>
                    <button
                      onClick={() => setPlayerGender('女')}
                      className={`flex-1 py-2.5 rounded-xl font-medium transition-all duration-200 border-2 ${
                        playerGender === '女'
                          ? 'border-pink-500 bg-pink-50 text-pink-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      👧 女
                    </button>
                  </div>
                  <button
                    onClick={handleStartGame}
                    disabled={isLoading || !playerName.trim()}
                    className="w-full px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '正在生成你的人生...' : '确认开始'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'player' ? 'justify-end' : 'justify-start'}`}
                >
                  {renderMessageContent(message)}
                </div>
              ))}

              {/* Choices display - shown after the last system message */}
              {pendingChoices.length > 0 && !isLoading && !gameOver && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] sm:max-w-[80%]">
                    <ChoicesDisplay
                      choices={pendingChoices}
                      onSelect={handleChoiceSelect}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {gameId && (
        <div className="bg-white border-t border-gray-200 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            {gameOver ? (
              <div className="text-center py-4">
                <p className="text-gray-600 mb-4">🎬 你的人生已经落幕。感谢你的体验！</p>
                <button
                  onClick={handleRestart}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-200"
                >
                  🔄 重新开始
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={pendingChoices.length > 0 ? "点击上方选项，或输入自定义行动..." : "描述你想要做的事情..."}
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span>发送</span>
                  <span>➤</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {playerState && (
        <div className="sm:hidden bg-white border-t border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">
              {playerState.gender === '女' ? '♀' : '♂'} {playerState.name} · {playerState.age} 岁
            </span>
            <div className="flex gap-1">
              <span className="px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded">颜 {playerState.attributes.appearance}</span>
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">智 {playerState.attributes.intelligence}</span>
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">体 {playerState.attributes.constitution}</span>
              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">财 {playerState.attributes.wealth}</span>
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">乐 {playerState.attributes.happiness}</span>
            </div>
          </div>
        </div>
      )}

      {/* 结算页面 */}
      {renderSettlement()}
    </main>
  );
}
