# 浮生渡

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![License](https://img.shields.io/badge/license-MIT-orange)

**AI 驱动的人生模拟叙事游戏 · 每一步选择都将改变命运的走向**

[快速开始](#快速开始) · [游戏特色](#游戏特色) · [架构设计](#架构设计) · [API 文档](#api-概览)

</div>

---

## 📖 简介

**浮生渡**是一款 AI 驱动的文本叙事人生模拟游戏。你将扮演一个角色，从出生开始，在 AI 叙事引擎的驱动下经历完整的一生。每一年，你会面临各种选择——关于学业、事业、爱情、家庭、冒险……这些选择将塑造你独特的人生轨迹。

与传统的文字冒险游戏不同，浮生渡的每一段叙事都由大语言模型实时生成，你永远不会经历两次完全相同的人生。

---

## ✨ 游戏特色

| 特色 | 说明 |
|------|------|
| 🤖 **AI 叙事引擎** | DeepSeek 驱动，每次游戏都是独一无二的完整人生故事 |
| 🎭 **深度自由选择** | 预设选项 + 自定义输入，你想做什么就做什么 |
| 📊 **五维属性系统** | 颜值、智力、体质、家境、快乐，相互关联动态变化 |
| 🌍 **多世界背景** | 现代/古代/架空/外国，不同时空不同规则 |
| 🧬 **天赋系统** | 随机天赋池（天生丽质、过目不忘、钢铁意志…），影响整个人生 |
| 📜 **智能结算** | 游戏结束自动生成人生总结 + 人格分析 + 数字评分 |
| ⚰️ **真实死亡机制** | 体质归零即死亡，不同死因，不同结局 |
| 🔗 **分享功能** | 将你的结局和人生故事分享给朋友 |
| 🎨 **双前端** | 零依赖 HTML 版 + React/Tailwind 现代 UI 版 |

---

## 🎮 游戏流程

```
┌──────────┐    ┌──────────┐    ┌───────────┐
│  创建角色  │───▶│  AI 叙事  │───▶│  做出选择  │
│ 姓名·性别  │    │ 生成故事  │    │ 影响属性  │
│ 世界·天赋  │    │ 历史事件  │    │ 触发事件  │
└──────────┘    └──────────┘    └─────┬─────┘
                                      │
                                      ▼
              ┌──────────┐    ┌───────────────┐
              │  生命终结  │◀───│  逐年循环    │
              │ AI 总结   │    │  年龄+1       │
              │ 人格分析   │    │  新场景新事件  │
              └──────────┘    └───────────────┘
```

**世界背景选项**：
- 🏙️ 现代中国：2003年出生，经历新世纪的中国
- 🏯 古代中国：庆历年间，科举、庙堂与江湖
- 🏛️ 架空世界：星辰大陆，剑与魔法的冒险
- 🌎 现代外国：1990s 美国，追逐美国梦

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **后端框架** | Python 3.10+ / FastAPI | 高性能异步 REST API |
| **数据校验** | Pydantic v2 | 请求/响应模型自动校验 |
| **AI 引擎** | DeepSeek API（OpenAI 兼容） | 叙事生成 + JSON 结构化输出 |
| **前端 (React)** | Next.js 14 / React 18 / TailwindCSS / TypeScript | 现代化 SPA 体验 |
| **前端 (HTML)** | 原生 HTML/CSS/JS | 零依赖，双击即用 |

---

## 🚀 快速开始

### 前置条件

- **Python** ≥ 3.10
- **Node.js** ≥ 18（仅 React 前端需要）
- **DeepSeek API Key**（[免费注册获取](https://platform.deepseek.com)）

### 1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 2. 配置 API Key

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 DeepSeek API Key：

```env
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

> 💡 也支持其他 OpenAI 兼容 API（如 OpenAI、通义千问、智谱 GLM），修改 `DEEPSEEK_BASE_URL` 和模型名即可。

### 3. 启动服务

#### 方式一：一键启动（Windows）

双击 `start.bat`，自动完成依赖安装和后端/前端启动。

#### 方式二：手动启动

```bash
# 终端 1：启动后端 API（端口 8000）
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 终端 2：启动 React 前端（端口 3000，可选）
cd frontend
npm install
npx next dev -p 3000
```

### 4. 开始游戏

| 方式 | 地址 |
|------|------|
| 🖥️ **React 版** | http://localhost:3000 |
| 📄 **HTML 版** | 浏览器打开 `frontend/index.html` |
| 📚 **API 文档** | http://localhost:8000/docs |

---

## 🧩 架构设计

```
┌─────────────────────────────────────────────┐
│                  前端层                      │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │  index.html  │  │  React SPA (Next.js)│  │
│  │  原生 JS 调用 │  │  fetch API 调用      │  │
│  └──────┬───────┘  └──────────┬──────────┘  │
├─────────┼─────────────────────┼──────────────┤
│         │     HTTP/REST       │              │
│         ▼                     ▼              │
│  ┌──────────────────────────────────────┐    │
│  │         FastAPI 后端 (main.py)       │    │
│  │  路由 · CORS · 序列化 · 错误处理     │    │
│  └────────────────┬─────────────────────┘    │
│                   │                          │
│         ┌─────────▼──────────┐               │
│         │   GameEngine (引擎层)│              │
│         │  状态管理 · 属性计算  │              │
│         │  天赋系统 · 阶段推进  │              │
│         └─────────┬──────────┘               │
│                   │                          │
│         ┌─────────▼──────────┐               │
│         │   AIProvider (AI层) │              │
│         │  Prompt 工程 · 容错  │              │
│         │  JSON 解析 · 重试   │              │
│         └─────────┬──────────┘               │
│                   │                          │
│              ┌────▼────┐                     │
│              │ DeepSeek │                     │
│              │   API    │                     │
│              └──────────┘                    │
└─────────────────────────────────────────────┘
```

### 核心模块

| 文件 | 职责 | 关键能力 |
|------|------|---------|
| `ai_provider.py` | AI 调用与 Prompt 工程 | 系统提示 · JSON 结构化输出 · 重试容错 · 响应裁剪 |
| `game_engine.py` | 游戏核心引擎 | 状态机 · 年龄阶段 · 属性计算 · 天赋池 · 死亡判定 |
| `backend/main.py` | HTTP API 服务 | 路由定义 · 请求模型 · CORS · 版本管理 |
| `frontend/index.html` | 零依赖前端 | 完整 UI · 流式体验 · 离线可用 |
| `frontend/app/` | React 前端 | Next.js SPA · TypeScript 类型安全 · Responsive 设计 |

---

## 📂 项目结构

```
life_fate/
├── ai_provider.py          # AI 调用层（Prompt 工程 / JSON 解析 / 容错）
├── game_engine.py          # 游戏引擎（状态管理 / 年龄阶段 / 随机事件）
├── requirements.txt        # Python 依赖
├── start.bat               # Windows 一键启动脚本
├── README.md               # 项目文档
│
├── backend/
│   └── main.py             # FastAPI 后端（REST API / CORS）
│
├── frontend/
│   ├── index.html          # HTML 版前端（零依赖，开箱即用）
│   ├── package.json        # Node 依赖
│   ├── tailwind.config.ts  # Tailwind 配置
│   ├── next-env.d.ts       # Next.js 类型声明
│   ├── app/
│   │   ├── layout.tsx      # 根布局
│   │   ├── page.tsx        # 主页面（角色创建 · 游戏循环 · 结算）
│   │   └── globals.css     # 全局样式
│   └── types/
│       └── game.ts         # TypeScript 类型定义
│
├── .env.example            # 环境变量模板
└── .gitignore
```

---

## 🔌 API 概览

基础地址：`http://localhost:8000`

### 游戏接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/game/start` | 创建新游戏 |
| `POST` | `/api/game/{game_id}/action` | 执行行动，推进一年 |

### 系统接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/version` | 获取后端版本号 |
| `GET` | `/health` | 健康检查 |

### 请求示例

**开始游戏**：
```json
POST /api/game/start
{
  "name": "张伟",
  "gender": "男",
  "attributes": { "appearance": 6, "intelligence": 7, "constitution": 8, "wealth": 5, "happiness": 5 },
  "talents": ["过目不忘"]
}
```

**执行行动**：
```json
POST /api/game/{game_id}/action
{
  "choice_index": 0,
  "custom_action": ""
}
```

---

## ⚙️ 配置参考

`.env` 文件支持的完整配置：

```env
# DeepSeek API 配置
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# 可选：自定义 API 参数
DEEPSEEK_TEMPERATURE=0.8
DEEPSEEK_MAX_TOKENS=4096
```

| 变量 | 必填 | 默认值 | 说明 |
|------|:---:|--------|------|
| `DEEPSEEK_API_KEY` | ✅ | — | API 密钥 |
| `DEEPSEEK_MODEL` | ❌ | `deepseek-chat` | 模型名称 |
| `DEEPSEEK_BASE_URL` | ❌ | `https://api.deepseek.com/v1` | API 地址 |
| `DEEPSEEK_TEMPERATURE` | ❌ | `0.8` | 生成温度（0-2） |
| `DEEPSEEK_MAX_TOKENS` | ❌ | `4096` | 最大输出 Token |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/your-feature`
3. 提交改动：`git commit -m 'feat: 新增某某功能'`
4. 推送分支：`git push origin feat/your-feature`
5. 发起 Pull Request

---

## 📄 License

MIT © 2024
