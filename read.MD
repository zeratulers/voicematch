你是 Cursor 中的资深全栈工程师。请严格按以下“逐条要求”完成一个可运行的前后端项目，用 FastAPI + Python（MySQL 或 SQLite） 作为后端，React + TypeScript 作为前端，实现一个“术中语音指令播放系统”。

1) 项目目标（务必实现）

解决术中医生与患者间语言不通的问题：

术中：程序使用 faster-whisper 实时监听医生语音，检测唤醒词 + 指令；被唤醒且识别到指令后，自动播放该指令的预先录制音频（患者能听懂的方言/语言变体）。

术前：医生团队为每位患者个性化定制可听懂的“术中常用指令”，可录制/管理多种方言变体，并绑定到具体患者。

提供 普通用户（临床医生） 与 管理员 两类角色能力；支持 Web 登录与权限控制。

支持 MySQL 或 SQLite（可用 .env 切换）。

2) 技术栈与约束

后端：FastAPI、Python 3.11+、SQLAlchemy 2.x、Alembic、Pydantic v2、Uvicorn、python-multipart、loguru。

前端：React 18+、TypeScript、Vite、React Router、React Query（TanStack Query）、Zod + react-hook-form、TailwindCSS、shadcn/ui、lucide-react、howler.js（或原生 Audio）播放音频。

身份认证：JWT（access + refresh）、基于角色的 RBAC（管理员 / 医生）。

音频：浏览器 MediaRecorder 录音（术前录制指令变体），后端保存为 WAV/Opus；统一采样率 16kHz/mono；文件存储支持本地文件系统或 S3/MinIO（用预签名 URL）。

实时语音：全在前端完成：浏览器采集麦克风 → 前端 WebWorker（WebGPU/WASM）运行 faster‑whisper/whisper.cpp → 本地 VAD+转写 → 本地匹配唤醒词与指令；不上传音频或识别文本。

代码质量：ruff/black、mypy、pre-commit；单元/集成/E2E 测试。

部署：Docker Compose（api / web / db / minio / (可选)gpu-asr），支持 .env 配置；生成完整 README。

3) 角色与权限（最少实现以下）

普通用户（医生）：登录；管理患者；管理“术中常用指令”；为每条指令录制/上传多个方言变体；为患者选择/绑定其能听懂的变体；术中控制台实时监听与播放；手动测试播放；仅能访问自己团队范围内数据（基础版可先全局共享）。

管理员：除医生权限外，还可：管理平台默认的“全局指令库”“默认方言/设置”；用户与角色管理；系统参数（唤醒词、阈值、冷却时间等）。

4) 数据模型（SQLAlchemy + Alembic，给出迁移）

必须建表并编写种子数据脚本（fixtures/seeds）：

隐私约束变更：指令文本与唤醒词不进入后端。后端仅保存患者信息、音频文件与与之关联的命令键（command_key，对规范化指令文本进行 SHA1 计算得到），用于分组与绑定。前端（IndexedDB）保存明文“指令短语”“唤醒词”等私有数据。

users：id, username, password_hash, role ("admin"|"doctor"), created_at, is_active。

patients：id, name, gender (M/F/Other), dob (date), note, created_by, created_at, updated_at。

commands：id (uuid), command_key(char40, sha1), is_active, created_by, scope ("global"|"team"|"user"), created_at。

仅存 command_key，不存明文 title/description；

(created_by, command_key) 唯一索引（避免重复）。

dialect_sets：id, key (zh-cn, zh-yue, wu, hak, en-us …)、label、notes、is_default。

command_variants：id, command_id -> commands、dialect_set_id -> dialect_sets、audio_url、duration_ms、speaker_note、created_by、is_active。

patient_command_prefs：id, patient_id -> patients、command_id -> commands、variant_id -> command_variants。

system_settings：id, storage_backend (local|minio)、minio_bucket、minio_endpoint、minio_access_key、minio_secret_key、retention_days、cors_whitelist 等（移除 wake_words/asr_* 等与识别相关字段）。

audit_logs：id, user_id, action, entity, entity_id, payload(json: 仅含 command_key/不含明文文本)、created_at。

另：前端 IndexedDB（本地）：

client_settings：wake_words[], asr_lang, asr_model_size, vad_threshold, match_threshold, cooldown_ms。

client_commands：command_key ↔ 明文文本、同义词与本地标签。

支持加密导入/导出（密码派生密钥）。

要求：提供 ER 图（mermaid），并标注 commands(command_key, created_by) 唯一索引；command_variants(command_id, dialect_set_id) 唯一索引。

5) API 设计（REST + WebSocket）

统一前缀 /api/v1，统一错误响应：{"detail":"...","code":"..."}。

5.1 认证

POST /auth/login：用户名密码登录，返回 access/refresh 与用户信息。

POST /auth/refresh：刷新 token。

GET /auth/me：获取当前用户信息与权限。

5.2 患者

GET /patients（分页、关键词）；POST /patients；GET /patients/{id}；PUT /patients/{id}；DELETE /patients/{id}。

5.3 指令与变体

GET /commands（筛选 scope/is_active、关键词）；POST /commands；PUT/DELETE /commands/{id}。

GET /commands/{id}/variants；POST /commands/{id}/variants（表单+文件上传，或先 POST /uploads 获得 URL）；PUT/DELETE /command-variants/{id}。

GET /dialect-sets；POST/PUT/DELETE /dialect-sets/{id}。

5.4 患者绑定偏好

GET /patients/{id}/prefs：列出该患者绑定；

PUT /patients/{id}/prefs：批量设置 { command_id, variant_id }[]；

POST /patients/{id}/prefs/{command_id}：单设；DELETE ...：解绑。

5.5 音频上传/下载/播放

POST /uploads/audio：表单上传或预签名；返回 audio_url。

GET /media/{path}：本地文件回源（若使用本地存储）；

POST /playback/trigger：手动触发播放 { patient_id, command_id }，后端根据 patient_command_prefs 选择 variant，返回 audio_url 与 text，前端立即播放，并记录 audit_logs。

5.6 术中实时监听（前端离线）

不经后端：前端使用 WebWorker 承载 ASR 引擎（whisper.cpp WASM/WebGPU 或 onnxruntime-web + Whisper 模型）。

UI 线程仅做设备选择/状态展示/音频播放。

Worker 消息协议：

// UI → Worker
{ "type":"start", "config": {"lang":"zh","model":"tiny","vadThreshold":0.6,"wakeWords":["医生助手","小医"],"cooldownMs":3000} }
{ "type":"audio", "seq":1, "payload":"<Float32Array or Int16 PCM chunk>" }
{ "type":"stop" }
// Worker → UI
{ "type":"partial", "text":"...", "ts": 123456 }
{ "type":"final", "text":"...", "ts": 123789 }
{ "type":"match", "commandKey":"<sha1>", "variantId": 9, "textLocal":"放松不要紧张", "audioUrl":"/media/..." }
{ "type":"error", "detail":"..." }
{ "type":"stats", "rtf":0.5 }

匹配逻辑（在 Worker 内）：唤醒词 → 窗口期（默认 3s）→ 精确/模糊匹配（RapidFuzz-TS/自实现）→ 选择变体（患者绑定优先）。

播放：UI 收到 match 后直接用 <audio>/howler.js 播放，同时仅上传事件摘要：POST /audit/plays（含 patient_id,command_key,variant_id），不上传明文文本与音频片段。

5.7 API 变更（前端本地词表，不上传文本）

POST /commands：仅接收 { command_key, scope }；不接收 title/description。

GET /commands：返回 id, command_key, scope, is_active；前端用本地词表渲染文本。

POST /commands/{command_id}/variants：上传音频变体（multipart 或预签名）；

GET /resolve/play：查询某患者在给定 command_key 下使用哪个 variant，返回 audio_url（供前端离线匹配后调用，或预加载）；

POST /audit/plays：记录播放事件（command_key 形式）。

可选“远程识别模式”（备选方案）：保留旧版 WS /ws/asr，但默认关闭；仅在设备不支持 WebGPU 时启用。

6) 指令匹配与唤醒词规则（必须实现）

唤醒词：wake_words 可配置（示例：“医生助手”、“小医小医”）；检测规则：

识别文本中包含任一唤醒词后，在**短时窗口（如 3 秒）**内匹配指令短语；

支持去噪与无标点匹配、同义词/简称（给出映射表）。

匹配策略：

先用精准包含，若无命中，使用 fuzzy match（RapidFuzz >= 比例 85%） 与同义词表；

命中多个时按：患者绑定变体 > 语言优先（当前 dialect_set）> 频次 > 最短编辑距离；

命中后返回 play 消息，给出 audio_url，并写 audit_logs。

防误触：

cooldown_ms（默认 3000ms）内不重复触发相同命令；

可配置 最低置信度（match_threshold）。

7) 前端信息架构（React + TS）

登录/注册：Login 页面；支持记住我；token 存储在 httpOnly cookie 或安全的 storage，并封装 apiClient 刷新逻辑。

仪表盘：概览近期播放、常用指令、患者数量。

患者模块：列表、搜索、创建/编辑（姓名、性别、生日、备注）；患者详情页含“偏好绑定”标签页（按命令分组选择变体）。

指令库：列表 + 过滤（活跃/语言/是否有音频）；创建/编辑指令；指令详情包含“变体”子表（录音、上传、试听、波形可选）。

录音工作台：基于 MediaRecorder 录音、回放、重录、波形（可选 wavesurfer.js）、表单提交到 POST /commands/{id}/variants。

术中控制台：

选择 patient、dialect_set、麦克风设备；

连接 WS /ws/asr 显示实时字幕（partial/final）；

命中后自动播放音频（howler.js 或 <audio>），并弹出 Toast；

提供“手动播放”按钮（调用 /playback/trigger）。

管理员设置：全局指令库、默认方言、系统参数（唤醒词、阈值、冷却时间、存储后端、ASR 模型大小等）、用户管理。

UI/UX 规范：shadcn/ui + Tailwind；表单校验 Zod；表格支持分页/搜索；错误 Toast；加载 Skeleton；深色模式。

8) 存储与文件命名

本地：/data/audio/{command_id}/{variant_id}/{uuid}.wav；

S3/MinIO：bucket 结构同上，生成预签名写入；

元数据写入 command_variants.audio_url；提供清理脚本。

9) 前端 ASR 集成（本地运行）

模型：支持 tiny/base/small（以体积优先），首选 whisper.cpp WASM + WebGPU 或 onnxruntime-web；模型文件由前端按需缓存（Cache Storage/IndexedDB），首次加载有进度条，支持离线使用。

VAD：Worker 内置 WebRTC VAD 或能量阈值；参数来自 client_settings。

性能策略：量化模型（q5_0/q8_0）、16kHz 单声道、分段长度 0.5–1.0s；

回退：若设备不支持 WebGPU，则允许切到“远程识别模式”（需显式开启）。

README 需给出：模型下载与缓存策略、权限申请失败的处理、性能调优与设备兼容矩阵。

10) 安全与合规

隐私优先：术中音频与识别文本不离开设备；后端仅接收播放事件摘要（command_key/variant_id）与必要的元数据。

患者 PII：最小化收集；可配置 数据保留天数；日志中脱敏。审计日志不含明文指令。

上传限制：仅音频文件（WAV/Opus）；大小/时长限制；病毒/恶意检测留接口（仅针对上传文件，非麦克风流）。

认证与权限：bcrypt + JWT；CORS 白名单。

11) 测试与质量保障（必须附带脚本）

后端：pytest + httpx；覆盖认证、CRUD、权限、播放触发、匹配算法（包含边界用例：近似匹配、误触、多命中）。

前端：Vitest + React Testing Library；Playwright 做关键 E2E（登录→录音→创建变体→绑定患者→WS 命中→自动播放）。

CI：GitHub Actions（或本地脚本）跑 lint/test/build。

12) 部署（必须可一键跑起来）

Docker Compose：

api（FastAPI）、web（Vite 构建后 Nginx 提供静态）、db（MySQL 或 SQLite-volume）、minio（可选）、nginx（反向代理静态）；

不需要 ASR 服务容器（默认前端离线），可选 asr-remote 作为回退；

提供 .env.example：数据库 DSN、JWT_SECRET、STORAGE_BACKEND、MINIO_* 等。

本地启动：make dev（或 task）同时起前后端；make seed 导入示例数据与 3 条示例指令音频（文本仅在本地）。

13) 文件结构建议

root
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/ (config, security, deps)
│  │  ├─ models/ (sqlalchemy)
│  │  ├─ schemas/ (pydantic)
│  │  ├─ api/ (routers: auth, patients, commands, variants, prefs, uploads, playback)
│  │  ├─ services/ (asr.py, playback.py, storage.py, matching.py)
│  │  ├─ ws/ (asr_ws.py, protocol.py)
│  │  ├─ migrations/ (alembic)
│  │  └─ tests/
│  └─ Dockerfile
├─ frontend/
│  ├─ src/
│  │  ├─ app/ (routes, providers)
│  │  ├─ pages/ (Login, Dashboard, Patients, PatientDetail, Commands, CommandDetail, Studio, ORConsole, Admin)
│  │  ├─ components/ (forms, tables, audio, ws)
│  │  ├─ api/ (client.ts, hooks)
│  │  ├─ store/ (auth, settings)
│  │  └─ utils/ (audio, i18n)
│  └─ Dockerfile
├─ deploy/
│  ├─ docker-compose.yml
│  └─ nginx.conf
├─ .env.example
├─ README.md
└─ Makefile / Taskfile.yml

14) 关键实现细节（给出代码骨架）

匹配算法（services/matching.py）：

def match_command(text: str, patient_id: int|None) -> Optional[MatchResult]：实现唤醒词检测、窗口期、fuzzy 比对（RapidFuzz）、同义词映射、冷却机制；返回命中 command_id/variant_id/audio_url。

存储抽象（services/storage.py）：Local 与 MinIO 后端；上传、生成访问 URL、清理。

WS 协议：心跳、错误、断线重连；客户端自动重连。

前端录音：MediaRecorder 封装：开始/暂停/结束、WAV/Opus 导出、回放、上传进度条。

音频播放：成功命中后自动播放（含手动重播按钮），并在 UI 显示命中文本与变体信息。

15) 验收标准（Definition of Done）

docker compose up 后，访问前端即可：

用种子账号 admin/admin123 登录；

创建患者 → 在指令库录制/上传变体（生成 command_key）→ 在患者页绑定该变体；

打开术中控制台，网络断开情况下仍可使用：麦克风说出 “医生助手，放松不要紧张”，前端本地识别并自动播放该患者对应方言音频；

后端审计日志中仅出现 command_key/variant_id，不含明文。

所有单元/集成/E2E 测试通过；README 清晰说明“前端离线模式”与回退方案。

16) 非功能性要求

性能：单实例在 CPU 下流畅处理 1 路流；GPU 下可 3–5 路（README 说明限制与调优）。

稳定性：长连 WS 断线自动重连；录音失败与权限被拒绝时给出可操作提示。

可维护性：清晰的分层与类型标注；关键函数注释与 docstring。

17) 交付物（请由 Cursor 自动生成）

完整可运行代码仓；

README.md（含快速开始、架构图、ER 图、时序图、API 文档示例、常见问题）；

.env.example、Alembic 迁移、种子数据脚本；

测试用例与 CI 配置；

示例音频与示例指令（文本 + 录音占位）。

18) 开发顺序（建议里程碑）

脚手架（后端/前端/Compose/CI）。

认证与 RBAC。

患者/指令/变体/绑定 CRUD。

音频上传与存储。

播放触发 /playback/trigger（手动流程闭环）。

faster-whisper 集成（离线转写 API）。

WebSocket 实时监听与匹配。

术中控制台 UI 与字幕展示。

管理员设置页。

测试与文档完善。

19) 验收用示例数据（种子）

指令（3 条）+ 每条 2 个方言变体（zh-cn, zh-yue）；

患者 2 人，分别绑定不同变体；

唤醒词：["医生助手", "小医"]。

20) 任务清单（勾选项）



请严格按以上条目落地实现，必要处给出代码骨架与注释；所有关键可配项写入 .env 并在 README 解释。

