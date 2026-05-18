from __future__ import annotations

import dataclasses
import json
import os
import time
from typing import Any, Dict, List, Optional


AI_SYSTEM_PROMPT = """你是"浮生渡"的裁判与叙事引擎。严格遵守以下规则。

═══ 输出格式 ═══
返回JSON对象，包含：
- narrative(string): 这一年发生的事，200-400字，体现一整年的时间跨度
- scene_title(string): 下一幕场景标题，含地点和场景（不含年份，系统自动添加）
- scene_description(string): 下一幕场景详述，150-300字
- choices(array of {text, hint}): 2-4个选项，text用第二人称提问（"你要不要…"），hint≤15字
- attribute_changes(object): {appearance,intelligence,constitution,wealth,happiness}变化值，范围±3，重大事件±5
- score(object): {strategy,logic,social,role_consistency各1-5, total为四项之和, comments≤50字}
- next_age(int): 当前年龄+1（系统强制递增，此字段仅参考）
- new_flags(object): 记录关键事件、关系、技能等

═══ 核心铁律（违反即失败）═══
1.【年份·最重要】叙事中的年份和年龄必须严格等于payload中的current_year和current_age！
   · 叙事必须以"X岁那年"开头（X=current_age）
   · 所有事件必须发生在current_year年，角色年龄=current_age岁
   · 中国教育：小学6岁入学，初中12岁，高中15岁，高考18岁(高三6月)
   · 禁止写其他年龄段！禁止回到过去！禁止跳到未来！
   · scene_title中不要写年份（系统会自动添加），只写地点和场景
2.【背景】人名/地名/文化/物品必须100%符合world_setting和当前年份，禁止混入矛盾元素：
   · 现代中国→中国人名(张伟/王芳)、中国地名、中国文化(春节/高考/996)
   · 古代中国→古人名(李文远/赵小妹)、朝代年号、科举礼制；严禁出现：电视/手机/电脑/暖气/空调/泡沫垫/塑料/超市/动画片/冰箱/洗衣机/电灯等任何现代工业品！古人家中只有：木桌/油灯/炭盆/土炕/陶碗/布衣/竹篮等
   · 外国→必须使用该国人名(如美国:John/Mary,日本:太郎/花子)、该地名、该文化，严禁出现任何中国特有元素(炕/拨浪鼓/长命锁/红肚兜/福字/煤炉/中国地名等)！
   · 架空世界→必须创造完整的架空世界（自定义世界名/种族/魔法或科技体系/社会制度），严禁任何现实国家元素！严禁出现：春节/高考/妇幼保健院/收音机/电视/手机/电脑/中国人名(张伟/王芳)/中国地名/还珠格格/王奶奶等任何现实特有元素！人名用架空风格（艾瑞恩/洛兰/星河/银叶），地名用架空风格（风息堡/银月城），物品用架空风格（木铃/布偶/兽皮/草药）
3.【背景不可变】世界背景贯穿全程，搬家/移民也必须在同一世界背景内合理解释
4.【自检】生成前自问：①我写的年份=payload的current_year吗？②角色年龄=current_age吗？③该物品在当前年份存在吗？④world_setting是外国时，人名/地名/文化都是外国的吗？⑤world_setting是架空世界时，有任何现实国家元素吗？若有违反立即修正

═══ 叙事规则 ═══
【时间感】每回合=一整年。用时间标记开头（"7岁那年秋天…"），用"那年""几个月后""渐渐地"体现流逝。错误："你坐在教室里听讲"→正确："7岁那年你进了小学，冬天已和同桌成了伙伴，期末考了第五"
【时代感】开篇必须交代年份和时代背景。每年叙事应渗透历史氛围：
   · 战争→粮价飞涨、邻居被征兵、远处炮声，而非只写"战争爆发"
   · 经济危机→家里没肉、母亲帮人洗衣，而非只写"经济不好"
   · 疫情→门口告示、超市一空，而非只写"生病了"
   · 繁荣→换了彩电、下馆子庆祝；技术革新→第一次摸电脑的震撼
   小角色不亲历大事，但必被时代波及：物价、传言、收音机里的新闻
【多样性】禁止连续重复主题。上学不要年年讲课堂，要有：家庭、邻里、暗恋、节日、追星、身体变化。成年不要年年讲工作，要有：恋爱、买房、健康、兴趣、矛盾
【随机性】约30%回合出现意外事件。某些平淡选择可暗藏重大后果（hint用"看起来很普通"暗示）
【属性映射】属性变化须反映在叙事中：体质→身体变化，智力→学习表现，颜值→外貌变化，家境→生活条件，快乐→心情
【场景随时间变】scene_title含地点和场景（"红星小学，二年级的夏天"），不要写年份；scene_description含季节/年龄/时代/环境变化

═══ 属性规则 ═══
- 外貌(appearance): 社交加成/减益
- 智力(intelligence): 学习、决策、职业
- 体质(constitution): ≤0则角色死亡！其他属性≤0不会死但间接影响体质：
   家境低/颜值低→偶尔体质-1；家境高/颜值高→偶尔体质+1
   不要每回合都改体质，只在合理剧情中才改，隐式影响由系统计算
- 财富(wealth): 资源和抗风险能力
- 快乐(happiness): 心理健康，过低→抑郁/冲动

═══ 选项规则 ═══
- 用第二人称提问，不同选项有不同后果走向
- 至少1个保守+1个冒险选项
- 婴幼儿(0-3): 玩耍/社交/幻想/家庭/本能，不要只给学习选项
- 儿童(4-12): 校园/朋友/兴趣/冒险/叛逆
- 少年+: 越来越自主复杂

═══ 选择影响铁律（最重要）═══
1.【后果真实】玩家选择必须产生与其内容匹配的真实后果，严禁"抢救"玩家！
   · 自毁/危险选择（不吃饭/不治疗/跳楼/赌博）→ 必须产生严重负面后果（体质-3~-5，或直接死亡）
   · 保守/安全选择 → 后果温和（属性±1）
   · 冒险选择 → 高风险高回报（属性±3~5）
2.【禁止巧合救援】严禁出现：恰好被路过的人救了/突然有了奇迹/意外得到帮助等巧合脱困情节
   · 玩家选了"不吃饭"→必须饿坏身体（体质大幅下降），不能写"有人来送饭"
   · 玩家选了"跳河"→必须淹死或重伤，不能写"被路人救起"
   · 玩家选了"放弃治疗"→病情必须恶化，不能写"自愈了"
3.【属性变化力度】attribute_changes必须与选择的严重程度匹配：
   · 危及生命的行为：体质-3~-5（或更狠）
   · 自我伤害/危险行为：至少体质-2
   · 一般负面行为：相关属性-1~-2
   · 一般正面行为：相关属性+1
   · 奋力一搏：±3~5

═══ 年龄阶段 ═══
0-3婴儿 | 4-12儿童 | 13-17少年 | 18-39成年 | 40-64中年 | 65-79老年 | 80+晚年

═══ 随机事件 ═══
若context中有【系统随机事件】，你必须将此事件自然融入{current_age}岁这一年的叙事中，不要单独列出或用【】标记，而是作为故事的一部分自然展开

═══ 提醒 ═══
- 只返回JSON，无其他文字
- attribute_changes必须包含全部5属性（值可为0）
- choices的text必须第二人称提问式
- 叙事风格：生动中文，有烟火气（食物/天气/声音/气味），NPC有性格
"""


try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


try:
    from pydantic import BaseModel, Field
except Exception as e:
    raise RuntimeError("缺少依赖：pydantic。请先安装 pydantic。") from e


class ChoiceOption(BaseModel):
    text: str
    hint: str


class ScoreDetail(BaseModel):
    strategy: int = Field(ge=1, le=5)
    logic: int = Field(ge=1, le=5)
    social: int = Field(ge=1, le=5)
    role_consistency: int = Field(ge=1, le=5)
    total: int = Field(ge=4, le=20)
    comments: str


class ActionEvaluationResponse(BaseModel):
    narrative: str
    scene_title: str
    scene_description: str
    choices: List[ChoiceOption] = Field(min_length=2, max_length=4)
    attribute_changes: Dict[str, int]
    score: ScoreDetail
    next_age: int = Field(ge=0)
    new_flags: Dict[str, Any] = Field(default_factory=dict)


class GameSummaryResponse(BaseModel):
    short_comment: str = Field(max_length=30)   # AI短评，≤20字
    life_summary: str = Field(min_length=20)   # 人生总结
    personality_analysis: str = Field(min_length=20)  # 人格分析


class AIProvider:
    """DeepSeek 驱动的 AI 适配层，负责生成场景与评估玩家行动。"""

    def __init__(
        self,
        model: str = "deepseek-v4-flash",
        api_key_env: str = "DEEPSEEK_API_KEY",
        base_url: str = "https://api.deepseek.com",
        timeout_s: float = 90.0,
    ) -> None:
        if load_dotenv is None:
            raise RuntimeError("缺少依赖：python-dotenv。请先安装 python-dotenv。")

        load_dotenv()
        api_key = os.getenv(api_key_env)
        if not api_key:
            raise RuntimeError(f"未找到环境变量 {api_key_env}。请在 .env 中配置。")

        self.model = model
        self.base_url = base_url
        self.timeout_s = timeout_s
        self._client = self._init_client(api_key)

    def generate_backstory(self, player_state: Any) -> Dict[str, Any]:
        """生成角色出生背景故事与初始选项。"""
        state_dict = self._serialize_state(player_state)
        attrs = state_dict.get("attributes", {})
        attr_desc = (
            f"颜值{attrs.get('appearance',5)}、智力{attrs.get('intelligence',5)}、"
            f"体质{attrs.get('constitution',5)}、家境{attrs.get('wealth',5)}、"
            f"快乐{attrs.get('happiness',5)}"
        )
        world_setting = state_dict.get("flags", {}).get("world_setting", "现代中国")
        birth_year = state_dict.get("flags", {}).get("birth_year", 2000)
        world_hint = self._world_hint(world_setting, birth_year)

        print(f"[AI_PREP] generate_backstory 参数提取:")
        print(f"  state_dict.flags = {state_dict.get('flags', {})}")
        print(f"  提取: world_setting={world_setting}, birth_year={birth_year}")

        payload = {
            "player_state": state_dict,
            "world_setting": world_setting,
            "birth_year": birth_year,
            "current_year": birth_year,
            "current_age": 0,
            "attributes": attr_desc,
            "context": (
                f"【关键】角色在{birth_year}年出生，世界背景={world_setting}。{world_hint}\n"
                f"叙事必须以'{birth_year}年'开头，交代时代背景和社会状况。人名/地名/文化必须符合{world_setting}！\n"
                "给出2-4个选项，反映婴儿本能反应或环境影响，不要只给学习类选项。"
            ),
        }
        parsed = self._call_with_retry(
            response_model=ActionEvaluationResponse,
            user_payload=payload,
        )
        return parsed

    def evaluate_action(
        self,
        player_state: Any,
        current_scene: str,
        player_input: str,
        random_event_hint: str = "",
    ) -> Dict[str, Any]:
        """评估玩家行动，返回解析好的字典。"""
        state_dict = self._serialize_state(player_state)
        world_setting = state_dict.get("flags", {}).get("world_setting", "现代中国")
        birth_year = state_dict.get("flags", {}).get("birth_year", 2000)
        current_year = state_dict.get("flags", {}).get("current_year", birth_year)
        current_age = state_dict.get("age", 0)

        print(f"[AI_PREP] evaluate_action 参数提取:")
        print(f"  state_dict.flags = {state_dict.get('flags', {})}")
        print(f"  state_dict.age = {current_age}")
        print(f"  提取: world_setting={world_setting}, birth_year={birth_year}, current_year={current_year}, age={current_age}")

        world_hint = self._world_hint(world_setting, birth_year)

        # 构建context，包含随机事件提示
        gender = state_dict.get("gender", "男")
        context = (
            f"【关键】角色现在{current_age}岁，年份是{current_year}年（{current_year}={birth_year}+{current_age}）。"
            f"性别：{gender}。"
            f"叙事必须只写{current_age}岁/{current_year}年发生的事！{world_hint}"
        )
        if random_event_hint:
            context += f"\n【系统随机事件·必须融入叙事】{random_event_hint}"

        payload = {
            "player_state": state_dict,
            "world_setting": world_setting,
            "birth_year": birth_year,
            "current_year": current_year,
            "current_age": current_age,
            "current_scene": current_scene,
            "player_input": player_input,
            "context": context,
        }
        parsed = self._call_with_retry(
            response_model=ActionEvaluationResponse,
            user_payload=payload,
        )
        return parsed

    SUMMARY_PROMPT = """你是"浮生渡"的结算评审。根据角色一生经历，生成游戏结算内容。

═══ 输出JSON ═══
- short_comment(string,≤20字): AI短评，优先使用成语，语言直接动人，如"大器晚成""命途多舛"
- life_summary(string,80-150字): 概括角色此局人生历程，包含关键转折和结局
- personality_analysis(string,80-150字): 基于玩家选择评价其人格特征，如"你在逆境中屡次选择坚守，体现了不屈的韧性"

═══ 规则 ═══
1. short_comment必须简洁有力，最好用四字成语
2. life_summary要有叙事感，突出人生的起伏
3. personality_analysis要基于具体选择推理，不要泛泛而谈
4. 所有文本以第二人称（"你"）书写

只返回JSON，无其他文字。"""

    def generate_summary(self, player_state: Any) -> Dict[str, Any]:
        """游戏结束时生成结算总结。"""
        state_dict = self._serialize_state(player_state)
        name = state_dict.get("name", "未知")
        gender = state_dict.get("gender", "男")
        age = state_dict.get("age", 0)
        ending = state_dict.get("flags", {}).get("ending", "未知结局")
        world = state_dict.get("flags", {}).get("world_setting", "现代中国")
        attrs = state_dict.get("attributes", {})
        history = state_dict.get("history", [])

        payload = {
            "name": name,
            "gender": gender,
            "age": age,
            "ending": ending,
            "world_setting": world,
            "attributes": attrs,
            "history": history,
        }

        system_content = self.SUMMARY_PROMPT
        user_content = f"角色数据：\n{json.dumps(payload, ensure_ascii=False)}"

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
        ]

        resp = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=False,
            response_format={"type": "json_object"},
            temperature=0.7,
        )

        content = resp.choices[0].message.content
        if not content:
            raise RuntimeError("AI 总结返回空响应")

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            raise RuntimeError(f"AI 总结返回无效JSON: {content}")

        parsed = GameSummaryResponse.model_validate(data)
        return parsed.model_dump(exclude_none=True)

    @staticmethod
    def _world_hint(world_setting: str, birth_year: int) -> str:
        """根据世界背景生成背景约束提示，供payload使用。"""
        # 判断是古代还是现代
        is_ancient = world_setting.startswith("古代")
        modern_ban = ""
        if is_ancient:
            modern_ban = (
                "【严禁现代物品】绝不能出现：电视/手机/电脑/暖气/空调/泡沫垫/塑料/超市/"
                "动画片/冰箱/洗衣机/电灯/自来水/煤气/抽水马桶/卫生纸/奶粉/奶瓶/"
                "积木(塑料)/摩托车/汽车/火车/飞机/抗生素/疫苗/眼镜(明以前)。"
                "古人家中只有：木桌/油灯/炭盆/土炕/陶碗/布衣/竹篮/蓆子/铜盆。"
            )

        hints = {
            "现代中国": f"背景：{birth_year}年现代中国。人名/地名/文化必须是中国式，禁外国元素。",
            "古代中国": (
                f"背景：{birth_year}年古代中国。"
                "必须点明朝代年号，人名/官制/礼制符合古代。"
                f"{modern_ban}"
                "婴儿玩耍：拨浪鼓/布老虎/木块/抓周，不是积木和动画片。"
            ),
            "现代外国": (
                f"背景：{birth_year}年现代外国。"
                "你必须选一个具体国家（美国/英国/日本/法国/德国等），"
                "人名/地名/文化/食物/物品必须是该国的！"
                "严禁任何中国特有元素：炕/拨浪鼓/长命锁/红肚兜/福字/煤炉/"
                "满月酒/中国地名/中国人名/春节/高考等。"
                "婴儿物品：crib/rattle/bottle/blanket，不是炕和拨浪鼓。"
            ),
            "古代外国": (
                f"背景：{birth_year}年古代外国。"
                "你必须选一个具体国家/文明（中世纪欧洲/古埃及/平安日本等），"
                "人名/地名/社会结构必须符合该时代该地区，禁中国/现代元素。"
                "严禁任何中国特有元素！"
                f"{modern_ban}"
            ),
            "架空世界": (
                f"背景：{birth_year}年架空世界。"
                "你必须创造一个完整的架空世界：自定义世界名、种族、魔法/科技体系、社会制度。"
                "严禁出现任何现实国家特有元素：中国（春节/高考/妇幼保健院/收音机/鞭炮/中国人名/"
                "还珠格格/常回家看看/王奶奶/米汤等）、美国、日本等现实国家的一切！"
                "架空世界不等于古代中国！不等于现代中国！"
                "人名必须是架空风格（如：艾瑞恩/洛兰/星河/银叶），不是中国名（张伟/王芳）。"
                "地名必须是架空风格（如：风息堡/银月城），不是中国地名。"
                "物品/建筑/食物必须是架空风格，严禁出现现代工业品和现实国家特有物品！"
                f"{modern_ban}"
                "婴儿物品：布偶/木铃/兽皮襁褓/草药汤，不是收音机和奶粉。"
            ),
        }
        return hints.get(world_setting, hints["现代中国"])

    def _call_with_retry(
        self,
        response_model: type[BaseModel],
        user_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        last_err: Optional[BaseException] = None
        for attempt in range(2):
            try:
                return self._call_openai(response_model, user_payload)
            except BaseException as e:
                last_err = e
                if attempt == 0:
                    time.sleep(1.0)
                    continue
                raise RuntimeError(f"AI 调用失败：{e}") from e
        raise RuntimeError(f"AI 调用失败：{last_err}")

    def _call_openai(
        self,
        response_model: type[BaseModel],
        user_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        # 把关键信息提取到醒目位置
        ws = user_payload.get("world_setting", "现代中国")
        cy = user_payload.get("current_year", 2000)
        ca = user_payload.get("current_age", 0)
        by = user_payload.get("birth_year", 2000)

        # ★ 调试日志：打印传给AI的关键参数
        print(f"[AI_CALL] 传给AI的关键参数:")
        print(f"  world_setting = {ws}")
        print(f"  birth_year    = {by}")
        print(f"  current_year  = {cy}")
        print(f"  current_age   = {ca}")
        # 检查 player_state 内部是否有冲突
        ps = user_payload.get("player_state", {})
        ps_flags = ps.get("flags", {}) if isinstance(ps, dict) else {}
        if ps_flags:
            ps_ws = ps_flags.get("world_setting")
            ps_by = ps_flags.get("birth_year")
            ps_cy = ps_flags.get("current_year")
            ps_age = ps.get("age")
            print(f"  [player_state内部] world_setting={ps_ws}, birth_year={ps_by}, current_year={ps_cy}, age={ps_age}")
            if ps_ws and ps_ws != ws:
                print(f"  ⚠️ 冲突! player_state.world_setting={ps_ws} ≠ payload.world_setting={ws}")
            if ps_cy and ps_cy != cy:
                print(f"  ⚠️ 冲突! player_state.current_year={ps_cy} ≠ payload.current_year={cy}")
            if ps_by and ps_by != by:
                print(f"  ⚠️ 冲突! player_state.birth_year={ps_by} ≠ payload.birth_year={by}")

        # 把动态关键信息注入system prompt，约束力最强
        gender = ""
        if isinstance(ps, dict):
            gender = ps.get("gender", "")
        system_content = (
            AI_SYSTEM_PROMPT
            + f"\n\n═══ 本次生成强制参数（不可违反）═══\n"
            f"世界背景：{ws}\n"
            f"当前年份：{cy}年\n"
            f"当前年龄：{ca}岁\n"
            + (f"性别：{gender}\n" if gender else "")
            + f"叙事必须以\"{ca}岁那年\"开头，所有事件发生在{cy}年，人名/地名/文化必须符合{ws}！\n"
        )

        # ★ 清理 player_state 中与顶层冲突的字段，防止AI参考内层旧数据
        clean_payload = dict(user_payload)
        if isinstance(ps, dict) and "flags" in ps and isinstance(ps["flags"], dict):
            clean_ps = dict(ps)
            clean_flags = dict(ps["flags"])
            # 移除内层与顶层重复的字段，避免AI参考旧值
            for key in ("world_setting", "birth_year", "current_year"):
                clean_flags.pop(key, None)
            clean_ps["flags"] = clean_flags
            clean_payload["player_state"] = clean_ps

        user_content = f"数据：\n{json.dumps(clean_payload, ensure_ascii=False)}"

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
        ]

        resp = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=False,
            response_format={"type": "json_object"},
            temperature=0.8,
        )

        content = resp.choices[0].message.content
        if not content:
            raise RuntimeError("AI 返回了空响应")

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            raise RuntimeError(f"AI 返回了无效的 JSON: {content}")

        parsed = response_model.model_validate(data)
        return parsed.model_dump(exclude_none=True)

    def _init_client(self, api_key: str) -> Any:
        try:
            from openai import OpenAI
        except Exception as e:
            raise RuntimeError("缺少依赖：openai。请先安装 openai>=1.0.0。") from e
        return OpenAI(api_key=api_key, base_url=self.base_url, timeout=self.timeout_s)

    def _serialize_state(self, player_state: Any) -> Dict[str, Any]:
        if player_state is None:
            return {}
        # ★ 优先使用 dataclasses.asdict()，对 @dataclass(slots=True) 也能正确序列化
        #    slots=True 的 dataclass 没有 __dict__，必须用 asdict() 而非 dict(obj.__dict__)
        if dataclasses.is_dataclass(player_state) and not isinstance(player_state, type):
            d = dataclasses.asdict(player_state)
        elif hasattr(player_state, "model_dump"):
            d = player_state.model_dump()
        elif hasattr(player_state, "dict"):
            d = player_state.dict()
        elif hasattr(player_state, "__dict__"):
            d = dict(player_state.__dict__)
        else:
            return {"value": str(player_state)}
        # 只保留最近5条历史，避免AI被早期历史干扰导致时间线混乱
        if "history" in d and isinstance(d["history"], list):
            d["history"] = d["history"][-5:]
        return d
