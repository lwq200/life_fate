from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

from ai_provider import AIProvider


@dataclass(slots=True)
class Attributes:
    appearance: int = 5
    intelligence: int = 5
    constitution: int = 5
    wealth: int = 5
    happiness: int = 5

    def apply_delta(self, delta: Dict[str, int]) -> None:
        for key, value in delta.items():
            if not hasattr(self, key):
                continue
            setattr(self, key, int(getattr(self, key)) + int(value))

    def any_non_positive(self) -> bool:
        return self.constitution <= 0

    def as_dict(self) -> Dict[str, int]:
        return {
            "appearance": self.appearance,
            "intelligence": self.intelligence,
            "constitution": self.constitution,
            "wealth": self.wealth,
            "happiness": self.happiness,
        }


@dataclass(slots=True)
class PlayerState:
    player_id: str
    name: str
    gender: str = "男"  # "男" 或 "女"
    age: int = 0
    stage: str = "newborn"
    attributes: Attributes = field(default_factory=Attributes)
    talents: List[str] = field(default_factory=list)
    traits: List[str] = field(default_factory=list)
    history: List[str] = field(default_factory=list)
    flags: Dict[str, Any] = field(default_factory=dict)
    game_over: bool = False


@dataclass(slots=True)
class ChoiceOption:
    text: str
    hint: str


@dataclass(slots=True)
class ActionResult:
    narrative: str
    scene_title: str
    scene_description: str
    choices: List[Dict[str, str]]
    attribute_changes: Dict[str, int]
    score: Dict[str, Any]
    new_age: int
    new_flags: Dict[str, Any]
    summary: Optional[Dict[str, str]] = None  # 游戏结束时的AI总结


class GameEngine:
    TALENT_POOL: Sequence[str] = (
        "天生丽质",
        "过目不忘",
        "钢铁意志",
        "财运亨通",
        "社交达人",
        "幸运星",
        "厄运体质",
        "艺术细胞",
        "运动健将",
        "书香门第",
        "孤僻",
        "乐天派",
    )

    # 世界背景池：名称 → 权重
    WORLD_SETTINGS: Dict[str, int] = {
        "现代中国": 50,
        "古代中国": 15,
        "现代外国": 15,
        "古代外国": 10,
        "架空世界": 10,
    }

    # 世界背景对应的出生年份范围
    BIRTH_YEAR_RANGES: Dict[str, Sequence[int]] = {
        "现代中国": (1965, 2015),
        "古代中国": (1300, 1850),
        "现代外国": (1950, 2010),
        "古代外国": (1400, 1850),
        "架空世界": (1, 500),
    }

    # 随机事件类型及权重（总15%触发，按5:5:4:1内部分配）
    RANDOM_EVENT_WEIGHTS: Dict[str, int] = {
        "good_major": 5,     # 5% → 重大好事件（大幅属性提升/人生转折）
        "medium": 5,        # 5% → 中等事件（强制切换世界背景/环境）
        "bad": 4,           # 4% → 坏事件（属性损失/灾祸）
        "death": 1,         # 1% → 直接导致死亡
    }

    # AI返回的new_flags中不允许覆盖的核心系统字段
    _PROTECTED_FLAGS = frozenset({
        "birth_year", "current_year", "world_setting", "current_scene",
        "last_score", "last_random_event", "ending",
    })

    def __init__(
        self,
        seed: Optional[int] = None,
        ai_provider: Optional[AIProvider] = None,
    ) -> None:
        self._rng = random.Random(seed)
        self.state: Optional[PlayerState] = None
        self.current_scene: str = ""
        self.last_attribute_changes: Dict[str, int] = {}
        self.last_score: Optional[Dict[str, Any]] = None
        self.last_scene_title: str = ""
        self.last_scene_description: str = ""
        self.last_choices: List[Dict[str, str]] = []
        self._ai = ai_provider or AIProvider()

    # 合法性别值
    VALID_GENDERS = ("男", "女")

    def start_game(
        self,
        name: str,
        gender: str = "男",
        talents: Optional[Sequence[str]] = None,
        initial_attributes: Optional[Dict[str, int]] = None,
    ) -> ActionResult:
        player_id = str(uuid.uuid4())
        gender = gender if gender in self.VALID_GENDERS else "男"
        attrs = Attributes()
        if initial_attributes:
            allowed = {"appearance", "intelligence", "constitution", "wealth"}
            for k, v in initial_attributes.items():
                if k in allowed:
                    setattr(attrs, k, int(v))
            # happiness 始终从默认值5开始，不参与分配
            attrs.happiness = 5

        chosen_talents: List[str] = []
        if talents:
            chosen_talents = list(dict.fromkeys([str(t) for t in talents if str(t).strip()]))
        if not chosen_talents:
            chosen_talents = list(self._rng.sample(list(self.TALENT_POOL), k=2))

        # 随机选取世界背景
        world_setting = self._pick_world_setting()

        # 根据世界背景随机出生年份
        birth_year = self._pick_birth_year(world_setting)

        self.state = PlayerState(
            player_id=player_id,
            name=name,
            gender=gender,
            age=0,
            stage="newborn",
            attributes=attrs,
            talents=chosen_talents,
            traits=[],
            history=[],
            flags={"world_setting": world_setting, "birth_year": birth_year, "current_year": birth_year},
            game_over=False,
        )

        try:
            ai_result = self._ai.generate_backstory(self.state)

            narrative = str(ai_result.get("narrative", ""))
            if not narrative:
                narrative = f"你出生了，名字叫{name}。你拥有天赋：{', '.join(chosen_talents)}。"
            scene_title = str(ai_result.get("scene_title", "新生"))
            scene_description = str(ai_result.get("scene_description", ""))

            choices_raw = ai_result.get("choices") or []
            choices: List[Dict[str, str]] = []
            if isinstance(choices_raw, list):
                for c in choices_raw:
                    if isinstance(c, dict):
                        choices.append({
                            "text": str(c.get("text", "")),
                            "hint": str(c.get("hint", "")),
                        })
            if not choices:
                choices = [
                    {"text": "大哭一场，吸引父母的注意", "hint": "本能反应"},
                    {"text": "安静地观察这个世界", "hint": "沉静观察"},
                    {"text": "挥舞小手，抓住母亲的手指", "hint": "亲近家人"},
                ]

            attribute_changes = ai_result.get("attribute_changes") or {}
            if isinstance(attribute_changes, dict):
                self.last_attribute_changes = {str(k): int(v) for k, v in attribute_changes.items()}
                self.state.attributes.apply_delta(self.last_attribute_changes)

            score = ai_result.get("score")
            if isinstance(score, dict):
                self.last_score = score
                self.state.flags["last_score"] = score
            else:
                self.last_score = None

            next_age = ai_result.get("next_age")
            if isinstance(next_age, int) and next_age >= self.state.age:
                self.state.age = next_age
            else:
                self.state.age = 0
            if "birth_year" in self.state.flags:
                self.state.flags["current_year"] = self.state.flags["birth_year"] + self.state.age
            self.state.stage = self._stage_for_age(self.state.age)

            self.current_scene = scene_description if scene_description else narrative
            self.last_scene_title = scene_title
            self.last_scene_description = self.current_scene
            self.last_choices = choices
            self.state.flags["current_scene"] = self.current_scene
            self.state.history.append(f"开局：{narrative}")

            new_flags = ai_result.get("new_flags") or {}
            if isinstance(new_flags, dict):
                self._merge_flags_safely(new_flags)

            return ActionResult(
                narrative=narrative,
                scene_title=scene_title,
                scene_description=self.current_scene,
                choices=choices,
                attribute_changes=self.last_attribute_changes,
                score=self.last_score or {},
                new_age=self.state.age,
                new_flags=new_flags,
            )
        except Exception as e:
            # Fallback if AI call fails
            print(f"[ERROR] AI生成backstory失败: {e}")
            import traceback; traceback.print_exc()
            ws = self.state.flags.get("world_setting", "现代中国")
            birth_year = self.state.flags.get("birth_year", 2000)
            is_foreign = "外国" in ws
            is_ancient = "古代" in ws

            if is_foreign and is_ancient:
                fallback_narrative = f"你出生在{birth_year}年的远方国度。名字叫{name}，你拥有天赋：{', '.join(chosen_talents)}。啼哭声划破了古堡的宁静，你来到了这个世界。"
                fallback_scene = "古老的城堡内，烛火摇曳。你刚刚来到这个世界。"
            elif is_foreign:
                fallback_narrative = f"你出生在{birth_year}年的异国他乡。名字叫{name}，你拥有天赋：{', '.join(chosen_talents)}。一声嘹亮的啼哭划破了病房的宁静，你来到了这个世界。"
                fallback_scene = "医院病房内，灯火通明。你刚刚来到这个世界。"
            elif is_ancient:
                fallback_narrative = f"你出生在{birth_year}年的古代。名字叫{name}，你拥有天赋：{', '.join(chosen_talents)}。一声嘹亮的啼哭划破了内室的宁静，你来到了这个世界。"
                fallback_scene = "内室之中，油灯如豆。你刚刚来到这个世界。"
            else:
                fallback_narrative = f"你出生了，名字叫{name}。世界背景：【{ws}】。你拥有天赋：{', '.join(chosen_talents)}。一声嘹亮的啼哭划破产房的宁静，你来到了这个世界。"
                fallback_scene = "产房内，灯火通明。你刚刚来到这个世界。"

            fallback_choices = [
                {"text": "大哭一场，吸引父母的注意", "hint": "本能反应"},
                {"text": "安静地观察这个世界", "hint": "沉静观察"},
                {"text": "挥舞小手，抓住母亲的手指", "hint": "亲近家人"},
            ]
            self.current_scene = fallback_scene
            self.last_scene_title = "新生"
            self.last_scene_description = fallback_scene
            self.last_choices = fallback_choices
            self.state.flags["current_scene"] = fallback_scene
            self.state.history.append(f"开局：{fallback_narrative}")
            return ActionResult(
                narrative=fallback_narrative,
                scene_title="新生",
                scene_description=fallback_scene,
                choices=fallback_choices,
                attribute_changes={},
                score={},
                new_age=0,
                new_flags={},
            )

    def process_action(self, player_input: str) -> ActionResult:
        if not self.state:
            raise RuntimeError("游戏尚未开始，请先调用 start_game().")
        if self.state.game_over:
            raise RuntimeError("游戏已结束。")

        # 推进年龄和年份到下一岁，AI叙事描述的是新年龄这一年发生的事
        self.state.age += 1
        if "birth_year" in self.state.flags:
            self.state.flags["current_year"] = self.state.flags["birth_year"] + self.state.age
        self.state.stage = self._stage_for_age(self.state.age)

        # 先触发随机事件（15%概率），把事件信息传给AI让其在叙事中自然融入
        random_event = self._apply_random_event()
        random_event_hint = ""
        if random_event.get("triggered"):
            self.state.flags["last_random_event"] = random_event
            random_event_hint = random_event.get("narrative_hint", "")
        else:
            self.state.flags.pop("last_random_event", None)

        ai_result = self._ai.evaluate_action(
            self.state, self.current_scene, player_input,
            random_event_hint=random_event_hint,
        )

        narrative = str(ai_result.get("narrative", "你做出了一个选择，但什么也没发生。"))
        scene_title = str(ai_result.get("scene_title", "下一幕"))
        scene_description = str(ai_result.get("scene_description", "新的人生篇章即将开启..."))

        choices_raw = ai_result.get("choices") or []
        choices = []
        if isinstance(choices_raw, list):
            for c in choices_raw:
                if isinstance(c, dict):
                    choices.append({
                        "text": str(c.get("text", "")),
                        "hint": str(c.get("hint", "")),
                    })
        if not choices:
            choices = [{"text": "继续你的人生", "hint": "顺其自然"}]

        attribute_changes = ai_result.get("attribute_changes") or {}
        if isinstance(attribute_changes, dict):
            self.last_attribute_changes = {str(k): int(v) for k, v in attribute_changes.items()}
            self.state.attributes.apply_delta(self.last_attribute_changes)

        # 环境对体质的隐式影响
        env_penalty = self._calc_env_penalty()
        if env_penalty != 0:
            self.state.attributes.constitution += env_penalty

        # 年龄对体质的衰减
        age_penalty = self._calc_age_penalty()
        if age_penalty != 0:
            self.state.attributes.constitution += age_penalty

        new_flags = ai_result.get("new_flags") or {}
        if isinstance(new_flags, dict):
            self._merge_flags_safely(new_flags)

        score = ai_result.get("score")
        if isinstance(score, dict):
            self.last_score = score
            self.state.flags["last_score"] = score
        else:
            self.last_score = None

        self.current_scene = scene_description
        self.last_scene_title = scene_title
        self.last_scene_description = scene_description
        self.state.flags["current_scene"] = self.current_scene

        self.state.history.append(f"{self.state.age}岁：{narrative}")

        self._check_game_over()
        summary = None
        if self.state.game_over:
            narrative = self._build_game_over_text(narrative)
            summary = self._generate_game_summary()

        return ActionResult(
            narrative=narrative,
            scene_title=scene_title,
            scene_description=scene_description,
            choices=choices,
            attribute_changes=self.last_attribute_changes,
            score=self.last_score or {},
            new_age=self.state.age,
            new_flags=new_flags,
            summary=summary,
        )

    def _merge_flags_safely(self, new_flags: Dict[str, Any]) -> None:
        """合并AI返回的new_flags，保护核心系统字段不被覆盖。"""
        for k, v in new_flags.items():
            if k not in self._PROTECTED_FLAGS:
                self.state.flags[k] = v

    def _pick_world_setting(self) -> str:
        """根据权重随机选取世界背景。"""
        settings = list(self.WORLD_SETTINGS.keys())
        weights = list(self.WORLD_SETTINGS.values())
        return self._rng.choices(settings, weights=weights, k=1)[0]

    def _pick_birth_year(self, world_setting: str) -> int:
        """根据世界背景随机生成出生年份。"""
        year_range = self.BIRTH_YEAR_RANGES.get(world_setting, (1950, 2010))
        return self._rng.randint(year_range[0], year_range[1])

    def _roll_random_event(self) -> Optional[str]:
        """每回合15%概率触发随机事件，按内部权重分配类型。"""
        if not self.state:
            return None
        if self._rng.random() >= 0.15:
            return None
        types = list(self.RANDOM_EVENT_WEIGHTS.keys())
        weights = list(self.RANDOM_EVENT_WEIGHTS.values())
        return self._rng.choices(types, weights=weights, k=1)[0]

    def _apply_random_event(self) -> Dict[str, Any]:
        """触发随机事件并应用效果，返回事件信息供叙事使用。"""
        event_type = self._roll_random_event()
        if event_type is None:
            return {"triggered": False}

        result: Dict[str, Any] = {"triggered": True, "type": event_type}

        if event_type == "good_major":
            boost = self._rng.choice(["wealth", "intelligence", "appearance", "happiness"])
            amount = self._rng.randint(2, 4)
            setattr(self.state.attributes, boost, getattr(self.state.attributes, boost) + amount)
            result["effect"] = f"{boost}+{amount}"
            result["narrative_hint"] = (
                f"命运向你微笑——一件意料之外的好事降临了，你的{self._attr_label(boost)}大幅提升！"
            )

        elif event_type == "medium":
            world = self.state.flags.get("world_setting", "现代中国")
            age = self.state.age
            env_events = self._build_env_events(world, age)
            event = self._rng.choice(env_events)
            result["effect"] = f"环境切换: {event}"
            result["narrative_hint"] = (
                f"生活的轨迹发生了变化——{event}，你需要适应新的环境！"
            )

        elif event_type == "bad":
            loss = self._rng.choice(["constitution", "wealth", "happiness"])
            amount = self._rng.randint(1, 3)
            setattr(self.state.attributes, loss, getattr(self.state.attributes, loss) - amount)
            result["effect"] = f"{loss}-{amount}"
            result["narrative_hint"] = (
                f"厄运降临——一场不幸的事件发生了，你的{self._attr_label(loss)}受到了损害！"
            )

        elif event_type == "death":
            self.state.attributes.constitution = 0
            result["effect"] = "constitution=0"
            result["narrative_hint"] = "命运无情地降临——一场突如其来的灾难夺走了你的生命！"

        return result

    @staticmethod
    def _attr_label(key: str) -> str:
        """属性键名转中文标签。"""
        return {
            "appearance": "颜值",
            "intelligence": "智力",
            "constitution": "体质",
            "wealth": "家境",
            "happiness": "快乐",
        }.get(key, key)

    def _build_env_events(self, world: str, age: int) -> List[str]:
        """根据世界背景和年龄生成合理的环境切换事件列表。"""
        common = ["搬到了一个新的住处", "转到了新的环境"]
        child_events = ["转学到了新学校", "转到了另一个班级", "跟着父母搬到了新地方"]
        teen_events = ["转学到了新学校", "换了一个新的班级", "搬到了新的住处"]
        adult_events = ["换了一份新工作", "被调到了新的部门", "搬到了另一个城市"]
        elder_events = ["搬到了新的住处", "搬去和子女同住", "搬到了养老院"]

        if world == "现代中国":
            specific = {
                "child": ["从老家搬到了省城", "跟着爸妈去了大城市", "转学到了县城的学校"],
                "teen": ["考上了外地的高中", "家里搬到了市区", "转学到了新学校"],
                "adult": [
                    "调动到了另一个城市的分公司",
                    "辞职去了深圳闯荡",
                    "被公司派驻到外地",
                    "跳槽到了一家新公司",
                    "从老家来到大城市打工",
                ],
                "elder": ["跟着孩子搬到了城里", "从乡下搬到了镇上"],
            }
        elif world == "古代中国":
            specific = {
                "child": ["随父赴任到了新县", "家道中落搬到了乡下", "被寄养在亲戚家"],
                "teen": ["被送到书院求学", "随师傅到了新地方", "家中变故搬到了别处"],
                "adult": [
                    "被调任到新的县衙", "随军到了边关", "商队到了新的城镇",
                    "赴京赶考", "被贬到偏远之地",
                ],
                "elder": ["告老还乡", "随子迁居"],
            }
        elif world == "现代外国":
            specific = {
                "child": ["搬家到了另一个社区", "转学到了新学校", "跟着父母去了另一个州"],
                "teen": ["转学到了新学校", "搬到了新的城市", "交换生去了新地方"],
                "adult": [
                    "调动到了另一个城市", "跳槽到了新公司",
                    "被派驻到海外分部", "搬到了新的州",
                ],
                "elder": ["搬到了新的社区", "搬去和子女同住"],
            }
        elif world == "古代外国":
            specific = {
                "child": ["随家人搬到了新领地", "被送到新的教区"],
                "teen": ["被送到新的学院", "随家族迁到了新城镇"],
                "adult": [
                    "被派往新的领地", "随军队到了新驻地",
                    "商队到了新的城邦", "迁居到了港口城市",
                ],
                "elder": ["退隐到乡间", "搬到了修道院"],
            }
        else:  # 架空世界
            specific = {
                "child": ["随家人迁到了新的领地", "被送到了新的地方"],
                "teen": ["来到了新的城镇", "进入了新的学院"],
                "adult": ["被派往新的据点", "迁居到了新的城邦", "跟随商队到了新地方"],
                "elder": ["退隐到新的地方", "搬到了隐居之所"],
            }

        if age <= 12:
            age_pool = child_events
            spec_pool = specific.get("child", [])
        elif age <= 17:
            age_pool = teen_events
            spec_pool = specific.get("teen", [])
        elif age <= 55:
            age_pool = adult_events
            spec_pool = specific.get("adult", [])
        else:
            age_pool = elder_events
            spec_pool = specific.get("elder", [])

        return age_pool + spec_pool + common

    def _calc_env_penalty(self) -> int:
        """计算环境对体质的隐式影响。"""
        if not self.state:
            return 0
        penalty = 0
        wealth = self.state.attributes.wealth
        appearance = self.state.attributes.appearance

        if wealth <= 2 and self._rng.random() < 0.3:
            penalty -= 1
        elif wealth >= 8 and self._rng.random() < 0.2:
            penalty += 1

        if appearance <= 2 and self._rng.random() < 0.2:
            penalty -= 1
        elif appearance >= 8 and self._rng.random() < 0.15:
            penalty += 1

        return penalty

    def _calc_age_penalty(self) -> int:
        """计算年龄对体质的衰减。"""
        if not self.state:
            return 0
        age = self.state.age
        if age <= 25:
            return 0

        r = self._rng.random()
        if age <= 40:
            return -1 if r < 0.01 else 0
        if age <= 55:
            return -1 if r < 0.03 else 0
        if age <= 65:
            if r < 0.01:
                return -2
            if r < 0.06:
                return -1
            return 0
        if age <= 75:
            if r < 0.03:
                return -2
            if r < 0.13:
                return -1
            return 0
        # 76+
        if r < 0.05:
            return -2
        if r < 0.17:
            return -1
        return 0

    def _stage_for_age(self, age: int) -> str:
        if age <= 3:
            return "infant"
        if age <= 12:
            return "child"
        if age <= 17:
            return "teen"
        if age <= 39:
            return "adult"
        if age <= 64:
            return "middle_age"
        if age <= 79:
            return "senior"
        return "elder"

    def _check_game_over(self) -> None:
        if not self.state:
            return

        if self.state.attributes.constitution < 0:
            self.state.game_over = True
            if self.state.age < 10:
                self.state.flags["ending"] = "夭折"
            elif self.state.age < 40:
                self.state.flags["ending"] = "英年早逝"
            elif self.state.age < 65:
                self.state.flags["ending"] = "中年病故"
            elif self.state.age < 80:
                self.state.flags["ending"] = "年老体衰"
            else:
                self.state.flags["ending"] = "寿终正寝"
            return

        if self.state.age >= 90:
            self.state.game_over = True
            self.state.flags["ending"] = "寿终正寝"

    def _build_game_over_text(self, last_narrative: str) -> str:
        if not self.state:
            return "游戏结束。"

        ending = str(self.state.flags.get("ending", "未知结局"))
        attrs = self.state.attributes.as_dict()
        summary = (
            f"{last_narrative}\n\n"
            f"—— 游戏结束：{ending}\n"
            f"终年：{self.state.age}岁\n"
            f"最终属性：外貌{attrs['appearance']} 智力{attrs['intelligence']} 体质{attrs['constitution']} "
            f"财富{attrs['wealth']} 快乐{attrs['happiness']}"
        )
        self.state.history.append(f"结局：{ending}（{self.state.age}岁）")
        return summary

    def _generate_game_summary(self) -> Optional[Dict[str, str]]:
        """游戏结束时调用AI生成总结（短评/人生总结/人格分析）。"""
        if not self.state:
            return None
        try:
            return self._ai.generate_summary(self.state)
        except Exception as e:
            print(f"[ERROR] AI生成总结失败: {e}")
            return None
