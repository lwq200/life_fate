'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { startGame, sendAction } from '@/lib/api';
import { PlayerState, Message, ChoiceOption, AttributeChanges, ScoreDetail, GameSummary, Attributes } from '@/types/game';

const ATTR_CONFIG: Record<string, { label: string; icon: string; accent: string; accentDim: string; track: string }> = {
  appearance: { label: '颜值', icon: '◈', accent: 'text-rose-300', accentDim: 'text-rose-300/60', track: 'bg-rose-900/40' },
  intelligence: { label: '智力', icon: '◇', accent: 'text-sky-300', accentDim: 'text-sky-300/60', track: 'bg-sky-900/40' },
  constitution: { label: '体质', icon: '◆', accent: 'text-emerald-300', accentDim: 'text-emerald-300/60', track: 'bg-emerald-900/40' },
  wealth: { label: '家境', icon: '♦', accent: 'text-amber-300', accentDim: 'text-amber-300/60', track: 'bg-amber-900/40' },
  happiness: { label: '快乐', icon: '♥', accent: 'text-violet-300', accentDim: 'text-violet-300/60', track: 'bg-violet-900/40' },
};

function formatDelta(val: number): string {
  if (val > 0) return `+${val}`;
  if (val < 0) return `${val}`;
  return '—';
}

const TYPEWRITER_PUNCT = '，。！？、；：\u201c\u201d\u2018\u2019…—';

function useTypewriter(text: string, speed = 30) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    if (!text) { setDone(true); return; }
    let i = 0;
    const timer = setInterval(() => {
      i++;
      const ch = text[i - 1];
      const isPunct = TYPEWRITER_PUNCT.includes(ch);
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      } else if (isPunct) {
        clearInterval(timer);
        setTimeout(() => {
          const t2 = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) { clearInterval(t2); setDone(true); }
          }, speed);
          // replace outer timer ref – but we just use setTimeout chain instead
        }, 120);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayed, done };
}

function TypewriterText({ text, speed = 30, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const { displayed, done } = useTypewriter(text, speed);
  useEffect(() => { if (done && onDone) onDone(); }, [done, onDone]);
  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {displayed}
      {!done && <span className="inline-block w-[2px] h-[1em] bg-gold-400/80 animate-pulse ml-0.5 align-middle" />}
    </span>
  );
}

function AttrBar({ value, max = 10, config }: { value: number; max?: number; config: typeof ATTR_CONFIG[string] }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs w-5 text-center ${config.accentDim}`}>{config.icon}</span>
      <span className="text-xs w-8 text-ink-200/70">{config.label}</span>
      <div className={`flex-1 h-1.5 rounded-full ${config.track} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${config.accent.replace('text-', 'bg-')}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs w-5 text-right tabular-nums ${config.accent}`}>{value}</span>
    </div>
  );
}

function AttributeChangesDisplay({ changes }: { changes: AttributeChanges }) {
  const entries = Object.entries(changes).filter(([k]) => ATTR_CONFIG[k]);
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 p-3 bg-ink-900/60 rounded-lg border border-gold-500/10">
      <div className="text-[10px] font-semibold text-gold-500/70 mb-2 tracking-wider">属 性 变 化</div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([key, val]) => {
          const cfg = ATTR_CONFIG[key];
          if (!cfg) return null;
          const isPositive = val > 0;
          const isZero = val === 0;
          return (
            <span
              key={key}
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                isZero
                  ? 'bg-ink-800/60 text-ink-400'
                  : isPositive
                    ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/30'
                    : 'bg-red-900/30 text-red-300 border border-red-700/30'
              }`}
            >
              {cfg.label} {isZero ? '—' : formatDelta(val)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ScoreDisplay({ score }: { score: ScoreDetail }) {
  const dims = [
    { key: 'strategy', label: '策略' },
    { key: 'logic', label: '逻辑' },
    { key: 'social', label: '社交' },
    { key: 'role_consistency', label: '入戏' },
  ] as const;
  return (
    <div className="mt-3 p-3 bg-ink-900/60 rounded-lg border border-gold-500/10">
      <div className="text-[10px] font-semibold text-gold-500/70 mb-2 tracking-wider">本 回 评 分</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {dims.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-ink-300">{label}</span>
            <span className="text-gold-300 tabular-nums">{score[key] as number}/5</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gold-500/10 flex items-center justify-between">
        <span className="text-xs text-ink-200">总分</span>
        <span className="text-sm font-bold text-gold-400 tabular-nums">{score.total}/20</span>
      </div>
      {score.comments && (
        <p className="mt-1 text-[11px] text-ink-400 italic">{score.comments}</p>
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
    <div className="mt-4 space-y-2 animate-slide-up">
      <div className="text-[10px] font-semibold text-gold-500/70 mb-1 tracking-wider">命 运 抉 择</div>
      {choices.map((choice, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(choice.text)}
          disabled={disabled}
          className="w-full text-left p-3 bg-ink-900/50 border border-gold-500/15 rounded-lg hover:border-gold-400/40 hover:bg-ink-800/50 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded border border-gold-500/25 text-gold-400 text-xs font-bold flex items-center justify-center group-hover:border-gold-400/60 group-hover:text-gold-300 transition-colors">
              {String.fromCharCode(65 + idx)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-100 leading-relaxed group-hover:text-gold-200 transition-colors">
                {choice.text}
              </p>
              {choice.hint && (
                <p className="text-[11px] text-ink-500 mt-0.5 group-hover:text-ink-400 transition-colors">{choice.hint}</p>
              )}
            </div>
          </div>
        </button>
      ))}
      <div className="text-center text-[11px] text-ink-600 mt-2">亦可自行书写命运</div>
    </div>
  );
}

function AttrAllocator({
  attrs,
  onChange,
  totalPoints,
}: {
  attrs: Record<string, number>;
  onChange: (key: string, delta: number) => void;
  totalPoints: number;
}) {
  const used = Object.values(attrs).reduce((a, b) => a + b, 0);
  const remaining = totalPoints - used;
  return (
    <div className="w-full max-w-xs mx-auto space-y-3">
      <div className="text-center text-xs text-gold-500/70">
        可分配点数：<span className={`tabular-nums font-bold ${remaining > 0 ? 'text-gold-400' : 'text-emerald-400'}`}>{remaining}</span> / {totalPoints}
      </div>
      {Object.entries(ATTR_CONFIG).map(([key, cfg]) => {
        if (key === 'happiness') return null;
        const val = attrs[key] ?? 5;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className={`text-xs w-8 text-center ${cfg.accent}`}>{cfg.label}</span>
            <button
              onClick={() => onChange(key, -1)}
              disabled={val <= 1}
              className="w-6 h-6 rounded border border-ink-600 text-ink-400 text-xs flex items-center justify-center hover:border-gold-500/50 hover:text-gold-400 transition-colors disabled:opacity-30"
            >
              −
            </button>
            <div className="flex-1 h-2 bg-ink-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${cfg.accent.replace('text-', 'bg-')}`}
                style={{ width: `${(val / 10) * 100}%` }}
              />
            </div>
            <span className={`text-xs w-5 text-right tabular-nums ${cfg.accent}`}>{val}</span>
            <button
              onClick={() => onChange(key, 1)}
              disabled={val >= 10 || remaining <= 0}
              className="w-6 h-6 rounded border border-ink-600 text-ink-400 text-xs flex items-center justify-center hover:border-gold-500/50 hover:text-gold-400 transition-colors disabled:opacity-30"
            >
              +
            </button>
          </div>
        );
      })}
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
  const [showAttrAlloc, setShowAttrAlloc] = useState(false);
  const [initAttrs, setInitAttrs] = useState<Record<string, number>>({
    appearance: 5, intelligence: 5, constitution: 5, wealth: 5,
  });
  const [shareSummary, setShareSummary] = useState<{
    name: string; gender: string; age: number; ending: string;
    summary: GameSummary; attributes: Attributes;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

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
      } catch { /* ignore */ }
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

  const handleAttrChange = (key: string, delta: number) => {
    setInitAttrs((prev) => {
      const newVal = prev[key] + delta;
      if (newVal < 1 || newVal > 10) return prev;
      const totalUsed = Object.entries(prev).reduce((sum, [k, v]) => sum + (k === key ? newVal : v), 0);
      if (totalUsed > 20) return prev;
      return { ...prev, [key]: newVal };
    });
  };

  const handleRandomizeAttrs = () => {
    const keys = ['appearance', 'intelligence', 'constitution', 'wealth'];
    const result: Record<string, number> = {};
    let remaining = 20;
    for (let i = 0; i < keys.length; i++) {
      const min = 1;
      const max = Math.min(10, remaining - (keys.length - i - 1) * min);
      const val = i === keys.length - 1 ? remaining : Math.floor(Math.random() * (max - min + 1)) + min;
      result[keys[i]] = val;
      remaining -= val;
    }
    setInitAttrs(result);
  };

  const handleStartGame = async () => {
    if (!playerName.trim()) return;
    setIsLoading(true);
    try {
      const attrs = showAttrAlloc ? {
        appearance: initAttrs.appearance,
        intelligence: initAttrs.intelligence,
        constitution: initAttrs.constitution,
        wealth: initAttrs.wealth,
      } : undefined;
      const response = await startGame({ name: playerName.trim(), gender: playerGender, attributes: attrs });
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
      addMessage('system', response.narrative, {
        attributeChanges: response.attribute_changes,
        score: response.score,
        sceneTitle: response.scene_title,
      });
      if (response.state) setPlayerState(response.state);
      if (response.choices && response.choices.length > 0) setPendingChoices(response.choices);
      if (response.state && response.state.game_over) {
        setGameOver(true);
        setPendingChoices([]);
        if (response.summary) setGameSummary(response.summary);
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
    setShowAttrAlloc(false);
    setInitAttrs({ appearance: 5, intelligence: 5, constitution: 5, wealth: 5 });
  };

  const getStageLabel = (stage: string): string => {
    const m: Record<string, string> = {
      newborn: '初生', infant: '婴孩', child: '童稚',
      teen: '少年', adult: '壮年', middle_age: '中年',
      senior: '暮年', elder: '耄耋',
    };
    return m[stage] || stage;
  };

  const getCurrentYear = (): string => {
    if (!playerState) return '';
    const birthYear = playerState.flags?.birth_year;
    if (typeof birthYear === 'number') return `${birthYear + playerState.age}`;
    return '';
  };

  const getWorldSetting = (): string => {
    if (!playerState) return '';
    return playerState.flags?.world_setting || '';
  };

  const settlementRef = useRef<HTMLDivElement>(null);

  const handleShareImage = async () => {
    if (!settlementRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      const w = 600, h = 900;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0d0b08');
      grad.addColorStop(0.5, '#1a1510');
      grad.addColorStop(1, '#0d0b08');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      ctx.arc(w / 2, 100, 40, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201,169,110,0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(201,169,110,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#c9a96e';
      ctx.font = 'bold 24px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('浮 生 渡', w / 2, 70);
      const ending = playerState?.flags?.ending || '未知结局';
      ctx.font = 'bold 32px Georgia, serif';
      ctx.fillStyle = '#e8c05a';
      ctx.fillText(ending, w / 2, 130);
      if (playerState) {
        ctx.font = '18px Georgia, serif';
        ctx.fillStyle = '#b8a080';
        const gender = playerState.gender === '女' ? '♀' : '♂';
        ctx.fillText(`${gender} ${playerState.name} · 终年${playerState.age}岁`, w / 2, 175);
      }
      if (gameSummary) {
        ctx.font = 'bold 26px Georgia, serif';
        ctx.fillStyle = '#f0d68e';
        ctx.fillText(`「${gameSummary.short_comment}」`, w / 2, 230);
        ctx.font = '15px Georgia, serif';
        ctx.fillStyle = '#d4c5a9';
        const summaryLines = wrapText(ctx, gameSummary.life_summary, w - 80);
        let y = 280;
        ctx.font = 'bold 16px Georgia, serif';
        ctx.fillStyle = '#c9a96e';
        ctx.fillText('— 人生总结 —', w / 2, y);
        y += 28;
        ctx.font = '14px Georgia, serif';
        ctx.fillStyle = '#b8a080';
        for (const line of summaryLines) { ctx.fillText(line, w / 2, y); y += 22; }
        y += 15;
        ctx.font = 'bold 16px Georgia, serif';
        ctx.fillStyle = '#c9a96e';
        ctx.fillText('— 人格分析 —', w / 2, y);
        y += 28;
        ctx.font = '14px Georgia, serif';
        ctx.fillStyle = '#b8a080';
        const persLines = wrapText(ctx, gameSummary.personality_analysis, w - 80);
        for (const line of persLines) { ctx.fillText(line, w / 2, y); y += 22; }
      }
      if (playerState) {
        const a = playerState.attributes;
        ctx.font = '13px Georgia, serif';
        ctx.fillStyle = '#9c7f5e';
        ctx.fillText(`颜值${a.appearance}  智力${a.intelligence}  体质${a.constitution}  家境${a.wealth}  快乐${a.happiness}`, w / 2, 770);
      }
      ctx.font = '13px Georgia, serif';
      ctx.fillStyle = '#8b7355';
      ctx.fillText('来浮生渡，书写你的命运', w / 2, 830);
      ctx.font = '11px Georgia, serif';
      ctx.fillStyle = '#6b5a42';
      ctx.fillText('#浮生渡 #AI人生模拟', w / 2, 860);
      const link = document.createElement('a');
      link.download = `浮生渡_${playerState?.name || '结算'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { /* ignore */ }
  };

  const handleShareLink = () => {
    if (!playerState || !gameSummary) return;
    const shareData = {
      n: playerState.name, g: playerState.gender, a: playerState.age,
      e: playerState.flags?.ending || '', sc: gameSummary.short_comment,
      ls: gameSummary.life_summary, pa: gameSummary.personality_analysis,
      at: playerState.attributes,
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
    const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
    navigator.clipboard.writeText(url).then(() => alert('分享链接已复制到剪贴板！')).catch(() => prompt('复制分享链接：', url));
  };

  const renderShareSettlement = () => {
    if (!shareSummary) return null;
    const { name, gender, age, ending, summary, attributes } = shareSummary;
    const g = gender === '女' ? '♀' : '♂';
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-ink-950 p-4">
        <div className="w-full max-w-md">
          <div className="text-center pt-8 pb-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full border border-gold-500/30 flex items-center justify-center">
              <span className="text-xl text-gold-400">☯</span>
            </div>
            <h2 className="text-base font-bold text-gold-500/70 tracking-widest">浮 生 渡</h2>
            <div className="text-2xl font-bold text-gold-300 my-2">{ending || '人生落幕'}</div>
            <p className="text-ink-300 text-sm">{g} {name} · 终年 {age} 岁</p>
          </div>
          {summary.short_comment && (
            <div className="p-4 bg-ink-900/60 rounded-xl border border-gold-500/15 text-center mb-4">
              <span className="text-lg font-bold text-gold-200">「{summary.short_comment}」</span>
            </div>
          )}
          {summary.life_summary && (
            <div className="p-4 bg-ink-900/60 rounded-xl border border-gold-500/15 mb-4">
              <div className="text-[10px] font-semibold text-gold-500/60 mb-2 tracking-wider">人 生 总 结</div>
              <p className="text-sm text-ink-200 leading-relaxed">{summary.life_summary}</p>
            </div>
          )}
          {summary.personality_analysis && (
            <div className="p-4 bg-ink-900/60 rounded-xl border border-gold-500/15 mb-4">
              <div className="text-[10px] font-semibold text-gold-500/60 mb-2 tracking-wider">人 格 分 析</div>
              <p className="text-sm text-ink-200 leading-relaxed">{summary.personality_analysis}</p>
            </div>
          )}
          <div className="space-y-2 mb-4 px-2">
            {Object.entries(ATTR_CONFIG).map(([key, cfg]) => (
              <AttrBar key={key} value={(attributes as unknown as Record<string, number>)[key] ?? 5} config={cfg} />
            ))}
          </div>
          <div className="py-3 text-center rounded-xl bg-ink-900/30 border border-gold-500/10">
            <p className="text-xs text-ink-500">来浮生渡，书写你的命运</p>
            <p className="text-[10px] text-ink-600">#浮生渡 #AI人生模拟</p>
          </div>
          <div className="text-center mt-6">
            <button
              onClick={() => { setShareSummary(null); window.history.replaceState({}, '', window.location.pathname); }}
              className="px-8 py-3 bg-gold-500/20 text-gold-300 font-medium rounded-xl border border-gold-500/30 hover:bg-gold-500/30 transition-all"
            >
              开启我的人生
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSettlement = () => {
    if (!gameOver) return null;
    const ending = playerState?.flags?.ending || '未知结局';
    const gender = playerState?.gender === '女' ? '♀' : '♂';
    const summary = gameSummary;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div ref={settlementRef} className="w-full max-w-md bg-gradient-to-b from-ink-900 via-ink-900 to-ink-950 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] border border-gold-500/15">
          <div className="text-center pt-8 pb-4 px-6">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full border border-gold-500/25 flex items-center justify-center animate-glow-pulse">
              <span className="text-2xl text-gold-400">☯</span>
            </div>
            <h2 className="text-sm font-bold text-gold-500/60 tracking-widest mb-1">浮 生 渡</h2>
            <div className="text-3xl font-bold text-gold-300 my-3">{ending}</div>
            <p className="text-ink-300 text-sm">
              {gender} {playerState?.name} · 终年 {playerState?.age} 岁
            </p>
          </div>

          {summary && (
            <div className="mx-5 p-4 bg-ink-950/60 rounded-xl border border-gold-500/10">
              <div className="text-center text-xl font-bold text-gold-200">「{summary.short_comment}」</div>
            </div>
          )}

          {summary && (
            <div className="mx-5 mt-3 p-4 bg-ink-950/60 rounded-xl border border-gold-500/10">
              <div className="text-[10px] font-semibold text-gold-500/60 mb-2 tracking-wider">人 生 总 结</div>
              <p className="text-sm text-ink-200 leading-relaxed">{summary.life_summary}</p>
            </div>
          )}

          {summary && (
            <div className="mx-5 mt-3 p-4 bg-ink-950/60 rounded-xl border border-gold-500/10">
              <div className="text-[10px] font-semibold text-gold-500/60 mb-2 tracking-wider">人 格 分 析</div>
              <p className="text-sm text-ink-200 leading-relaxed">{summary.personality_analysis}</p>
            </div>
          )}

          {!summary && (
            <div className="mx-5 mt-3 p-4 bg-ink-950/60 rounded-xl border border-gold-500/10 text-center">
              <div className="text-ink-400 text-sm">AI 正在总结你的一生...</div>
            </div>
          )}

          {playerState && (
            <div className="mx-5 mt-4 space-y-2">
              {Object.entries(ATTR_CONFIG).map(([key, cfg]) => (
                <AttrBar key={key} value={playerState.attributes[key as keyof Attributes] ?? 5} config={cfg} />
              ))}
            </div>
          )}

          <div className="mx-5 mt-6 mb-6 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={handleShareImage}
                className="flex-1 py-2.5 bg-gold-500/15 text-gold-300 font-medium rounded-xl hover:bg-gold-500/25 transition-all text-sm border border-gold-500/20"
              >
                留影纪念
              </button>
              <button
                onClick={handleShareLink}
                className="flex-1 py-2.5 bg-ink-800/60 text-ink-200 font-medium rounded-xl hover:bg-ink-700/60 transition-all text-sm border border-gold-500/15"
              >
                传递因果
              </button>
            </div>
            <button
              onClick={handleRestart}
              className="w-full py-2.5 bg-ink-800/40 text-gold-400/80 font-medium rounded-xl hover:bg-ink-700/40 transition-all text-sm border border-gold-500/10"
            >
              轮回转世
            </button>
          </div>

          <div className="py-3 text-center border-t border-gold-500/10">
            <p className="text-[11px] text-ink-500">来浮生渡，书写你的命运</p>
          </div>
        </div>
      </div>
    );
  };

  const renderMessageContent = (message: Message) => {
    if (message.type === 'player') {
      return (
        <div className="max-w-[80%] sm:max-w-[70%] px-4 py-3 rounded-xl rounded-br-sm bg-gold-500/15 border border-gold-500/20">
          <p className="whitespace-pre-wrap leading-relaxed text-sm text-ink-100">{message.content}</p>
        </div>
      );
    }

    return (
      <div className="max-w-[90%] sm:max-w-[80%]">
        {message.sceneTitle && (
          <div className="mb-2 px-3 py-1.5 bg-ink-900/80 border border-gold-500/15 rounded-lg inline-flex items-center gap-1.5">
            <span className="text-[10px] text-gold-500/50">◆</span>
            <span className="text-xs font-semibold text-gold-400/80">{message.sceneTitle}</span>
          </div>
        )}
        <div className="px-4 py-3 rounded-xl rounded-bl-sm bg-ink-900/60 border border-gold-500/10">
          <p className="text-sm text-ink-100 leading-relaxed">
            <TypewriterText text={message.content} />
          </p>
          {message.attributeChanges && <AttributeChangesDisplay changes={message.attributeChanges} />}
          {message.score && <ScoreDisplay score={message.score} />}
        </div>
      </div>
    );
  };

  if (shareSummary) {
    return <>{renderShareSettlement()}</>;
  }

  const worldSetting = getWorldSetting();

  return (
    <main className="flex flex-col h-screen bg-ink-950">
      {/* Header */}
      <header className="bg-ink-900/80 border-b border-gold-500/10 px-4 py-3 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-gold-500/25 flex items-center justify-center">
              <span className="text-gold-400 text-base">☯</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-gold-400/90 tracking-wider">浮 生 渡</h1>
              <p className="text-[10px] text-ink-500 tracking-wide">AI 驱动的沉浸式人生体验</p>
            </div>
          </div>
          {playerState && (
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="text-right">
                <div className="font-medium text-ink-100">{playerState.name}</div>
                <div className="text-ink-400 text-xs">
                  {playerState.gender === '女' ? '♀' : '♂'} {getCurrentYear()}年 · {playerState.age}岁 · {getStageLabel(playerState.stage)}
                  {worldSetting && <span className="ml-1 text-ink-500">| {worldSetting}</span>}
                </div>
              </div>
              <div className="space-y-1">
                {Object.entries(ATTR_CONFIG).map(([key, cfg]) => (
                  <AttrBar key={key} value={playerState.attributes[key as keyof Attributes] ?? 5} config={cfg} />
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
              <div className="w-20 h-20 rounded-full border border-gold-500/20 flex items-center justify-center mb-6 animate-glow-pulse">
                <span className="text-3xl text-gold-400">☯</span>
              </div>
              <h2 className="text-2xl font-bold text-gold-300/90 mb-2 tracking-widest">浮 生 渡</h2>
              <p className="text-ink-400 mb-8 text-center max-w-sm text-sm leading-relaxed">
                一命二运三风水，四积阴德五读书。<br />
                在这里，你将书写属于自己的人生。
              </p>
              {!showNameInput ? (
                <button
                  onClick={() => setShowNameInput(true)}
                  className="px-8 py-3 bg-gold-500/15 text-gold-300 font-medium rounded-xl border border-gold-500/25 hover:bg-gold-500/25 hover:border-gold-400/40 transition-all duration-300"
                >
                  开启此生
                </button>
              ) : (
                <div className="w-full max-w-sm space-y-4 animate-fade-in">
                  {!showAttrAlloc ? (
                    <>
                      <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="赐名..."
                        className="w-full px-4 py-3 bg-ink-900/60 border border-gold-500/15 rounded-xl focus:outline-none focus:border-gold-500/40 text-center text-lg text-ink-100 placeholder:text-ink-600"
                        autoFocus
                        disabled={isLoading}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPlayerGender('男')}
                          className={`flex-1 py-2.5 rounded-xl font-medium transition-all duration-200 border ${
                            playerGender === '男'
                              ? 'border-sky-500/40 bg-sky-900/20 text-sky-300'
                              : 'border-ink-700 bg-ink-900/40 text-ink-400 hover:border-ink-600'
                          }`}
                        >
                          ♂ 男
                        </button>
                        <button
                          onClick={() => setPlayerGender('女')}
                          className={`flex-1 py-2.5 rounded-xl font-medium transition-all duration-200 border ${
                            playerGender === '女'
                              ? 'border-rose-500/40 bg-rose-900/20 text-rose-300'
                              : 'border-ink-700 bg-ink-900/40 text-ink-400 hover:border-ink-600'
                          }`}
                        >
                          ♀ 女
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowAttrAlloc(true); }}
                          className="flex-1 py-2.5 rounded-xl text-ink-300 border border-ink-700 hover:border-gold-500/30 hover:text-gold-400/80 transition-all text-sm"
                        >
                          自定天赋
                        </button>
                        <button
                          onClick={handleStartGame}
                          disabled={isLoading || !playerName.trim()}
                          className="flex-1 py-2.5 bg-gold-500/15 text-gold-300 font-medium rounded-xl border border-gold-500/25 hover:bg-gold-500/25 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isLoading ? '天命降临中...' : '顺天承命'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center">
                        <div className="text-sm text-ink-200 mb-1">{playerName} · {playerGender === '女' ? '♀' : '♂'}</div>
                        <div className="text-[10px] text-gold-500/60 tracking-wider">天 赋 分 配</div>
                      </div>
                      <AttrAllocator attrs={initAttrs} onChange={handleAttrChange} totalPoints={20} />
                      <div className="flex gap-2">
                        <button
                          onClick={handleRandomizeAttrs}
                          className="flex-1 py-2.5 rounded-xl text-ink-300 border border-ink-700 hover:border-gold-500/30 hover:text-gold-400/80 transition-all text-sm"
                        >
                          听天由命
                        </button>
                        <button
                          onClick={handleStartGame}
                          disabled={isLoading}
                          className="flex-1 py-2.5 bg-gold-500/15 text-gold-300 font-medium rounded-xl border border-gold-500/25 hover:bg-gold-500/25 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isLoading ? '天命降临中...' : '就此降生'}
                        </button>
                      </div>
                      <button
                        onClick={() => setShowAttrAlloc(false)}
                        className="w-full py-2 text-ink-500 text-xs hover:text-ink-300 transition-colors"
                      >
                        返回
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'player' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  {renderMessageContent(message)}
                </div>
              ))}
              {pendingChoices.length > 0 && !isLoading && !gameOver && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] sm:max-w-[80%]">
                    <ChoicesDisplay choices={pendingChoices} onSelect={handleChoiceSelect} disabled={isLoading} />
                  </div>
                </div>
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-ink-900/60 px-4 py-3 rounded-xl border border-gold-500/10">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-1.5 h-1.5 bg-gold-500/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gold-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gold-500/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span className="text-[11px] text-ink-500 ml-2">命运流转中...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      {gameId && (
        <div className="bg-ink-900/60 border-t border-gold-500/10 px-4 py-4 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            {gameOver ? (
              <div className="text-center py-4">
                <p className="text-ink-400 mb-4 text-sm">此生已了，因果已定。</p>
                <button
                  onClick={handleRestart}
                  className="px-6 py-2.5 bg-gold-500/15 text-gold-300 font-medium rounded-xl border border-gold-500/25 hover:bg-gold-500/25 transition-all duration-200"
                >
                  轮回转世
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={pendingChoices.length > 0 ? '选择上方选项，或书写你的命运...' : '书写你的行动...'}
                  className="flex-1 px-4 py-3 bg-ink-900/60 border border-gold-500/15 rounded-xl focus:outline-none focus:border-gold-500/35 text-ink-100 text-sm"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !input.trim()}
                  className="px-5 py-3 bg-gold-500/15 text-gold-300 font-medium rounded-xl border border-gold-500/25 hover:bg-gold-500/25 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  传
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile status bar */}
      {playerState && (
        <div className="sm:hidden bg-ink-900/60 border-t border-gold-500/10 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-300">
              {playerState.gender === '女' ? '♀' : '♂'} {playerState.name} · {getCurrentYear()}年 · {playerState.age}岁
            </span>
            <div className="flex gap-1.5">
              {Object.entries(ATTR_CONFIG).map(([key, cfg]) => (
                <span key={key} className={`px-1.5 py-0.5 rounded text-[10px] ${cfg.accentDim} ${cfg.track}`}>
                  {cfg.label.charAt(0)} {playerState.attributes[key as keyof Attributes] ?? 5}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {renderSettlement()}
    </main>
  );
}
