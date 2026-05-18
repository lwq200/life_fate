# 浮生渡

AI 驱动的人生模拟叙事游戏。每一步选择都将改变命运的走向。

## 特色

- 🤖 AI 叙事引擎 — 每次游戏都是独一无二的故事
- 🎭 自由选择 — 从预设选项中选择，或输入自定义行动
- 📊 五维属性 — 颜值、智力、体质、家境、快乐，随选择动态变化
- 🌍 多世界背景 — 现代、古代、未来…不同世界观不同人生
- 🧬 天赋系统 — 随机天赋影响人生轨迹
- 📜 AI 结算 — 游戏结束后生成人生总结与人格分析
- 🔗 分享功能 — 将你的结局分享给朋友

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.10+ / FastAPI / Pydantic |
| AI | DeepSeek API (OpenAI 兼容) |
| 前端 (HTML) | 原生 HTML/CSS/JS，零依赖，开箱即用 |
| 前端 (React) | Next.js 14 / React 18 / TailwindCSS / TypeScript |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置 API Key

复制 `.env.example` 为 `.env`，填入你的 DeepSeek API Key：

```bash
cp .env.example .env
```

编辑 `.env`：

```
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_MODEL=deepseek-chat
```

> 也支持其他 OpenAI 兼容 API，修改 `.env` 中的配置即可。

### 3. 启动服务

**方式一：一键启动（Windows）**

双击 `start.bat`

**方式二：手动启动**

```bash
# 启动后端
py -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 启动 React 前端（可选）
cd frontend
npm install
npx next dev -p 3000
```

### 4. 开始游戏

- **HTML 版**：浏览器打开 `frontend/index.html`
- **React 版**：访问 http://localhost:3000
- **API 文档**：http://localhost:8000/docs

## 项目结构

```
├── ai_provider.py       # AI 调用层（系统提示、JSON 解析、容错）
├── game_engine.py       # 游戏引擎（状态管理、年龄/阶段、随机事件）
├── backend/
│   └── main.py          # FastAPI 后端（REST API、CORS）
├── frontend/
│   ├── index.html       # HTML 版前端（零依赖，开箱即用）
│   ├── app/             # Next.js React 版前端
│   ├── types/game.ts    # TypeScript 类型定义
│   └── lib/api.ts       # API 调用封装
├── requirements.txt     # Python 依赖
├── start.bat            # Windows 一键启动脚本
├── .env.example         # 环境变量示例
└── .gitignore
```

## API 概览

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/game/start` | POST | 开始新游戏（传名字、性别、属性） |
| `/api/game/{id}/action` | POST | 执行行动（传玩家输入） |
| `/api/version` | GET | 获取版本号 |
| `/health` | GET | 健康检查 |

## License

MIT
