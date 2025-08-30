# VoiceMatch - 术中语音指令播放系统

VoiceMatch是一个专为手术室设计的智能语音指令播放系统，支持多方言语音指令管理、语音识别和自动播放功能。

## 功能特性

- 🎯 **智能语音识别**: 支持中文语音指令识别，包括方言适配
- 🎵 **音频指令管理**: 支持多种音频格式，自动分类和管理
- 👥 **患者管理**: 患者信息管理，支持指令分配和播放记录
- 🔐 **权限管理**: 基于角色的访问控制，支持医生和管理员
- 📊 **实时监控**: 语音识别日志和播放记录统计
- 🚀 **现代化UI**: 响应式设计，支持移动端和桌面端

## 技术架构

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件**: TailwindCSS + shadcn/ui
- **状态管理**: React Query + Context API
- **语音识别**: Web Speech API + 自定义分类器

### 后端
- **框架**: FastAPI + Python 3.12
- **数据库**: MySQL 8.0 / SQLite
- **ORM**: SQLAlchemy 2.0 + Alembic
- **认证**: JWT + bcrypt
- **存储**: 本地存储 + MinIO对象存储

### 部署
- **容器化**: Docker + Docker Compose
- **Web服务器**: Nginx
- **数据库**: MySQL 8.0
- **对象存储**: MinIO (可选)

## 快速开始

### 开发环境

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd VoiceMatch
   ```

2. **启动开发环境**
   ```bash
   # 使用Docker Compose
   make dev
   
   # 或者分别启动
   make frontend-dev  # 前端开发服务器 (http://localhost:3000)
   make backend-dev   # 后端开发服务器 (http://localhost:8000)
   ```

3. **访问应用**
   - 前端: http://localhost:3000
   - 后端API: http://localhost:8000
   - API文档: http://localhost:8000/docs

### 生产环境部署

1. **环境要求**
   - Docker 20.10+
   - Docker Compose 2.0+
   - 至少4GB内存，20GB磁盘空间

2. **一键部署**
   ```bash
   # 构建并启动
   make build
   make up
   
   # 查看状态
   docker-compose ps
   ```

3. **数据迁移** (从SQLite到MySQL)
   ```bash
   # 首次部署时执行数据迁移
   make migrate
   
   # 或者分步执行
   make db-reset
   sleep 30
   make migrate-only
   ```

## 项目结构

```
VoiceMatch/
├── frontend/                 # 前端React应用
│   ├── src/
│   │   ├── components/      # React组件
│   │   ├── pages/          # 页面组件
│   │   ├── contexts/       # React Context
│   │   ├── api/            # API客户端
│   │   └── types/          # TypeScript类型定义
│   ├── Dockerfile          # 前端Docker镜像
│   └── nginx.conf          # Nginx配置
├── backend/                 # 后端FastAPI应用
│   ├── app/
│   │   ├── api/            # API路由
│   │   ├── core/           # 核心配置
│   │   ├── models/         # 数据模型
│   │   ├── schemas/        # Pydantic模式
│   │   └── services/       # 业务逻辑
│   ├── scripts/            # 脚本文件
│   └── Dockerfile          # 后端Docker镜像
├── deploy/                  # 部署配置
│   └── mysql/              # MySQL初始化脚本
├── docker-compose.yml       # 生产环境配置
├── docker-compose.dev.yml   # 开发环境配置
├── Makefile                 # 项目管理命令
└── README.md               # 项目说明
```

## 核心功能

### 语音控制模式
- **无语音控制**: 隐藏语音控制模块
- **离线语音控制**: 本地语音识别和处理
- **在线语音控制**: 云端语音识别 (开发中)

### 指令管理
- 支持多种音频格式 (WAV, MP3, OPUS, M4A, WEBM)
- 方言标签和分类管理
- 患者指令分配和播放记录
- 指令变体管理

### 语音识别
- 实时语音转文字
- 智能指令匹配算法
- 置信度评估和纠错机制
- 语音识别日志记录

## 管理命令

```bash
# 查看所有可用命令
make help

# 生产环境
make build          # 构建Docker镜像
make up             # 启动服务
make down           # 停止服务
make logs           # 查看日志

# 开发环境
make dev            # 启动开发环境
make dev-down       # 停止开发环境
make frontend-dev   # 启动前端开发服务器
make backend-dev    # 启动后端开发服务器

# 数据库操作
make db-reset       # 重置数据库
make migrate        # 执行数据迁移
make migrate-only   # 仅执行迁移

# 维护
make clean          # 清理容器和镜像
```

## 配置说明

### 环境变量
复制 `env.example` 为 `.env` 并修改配置：

```bash
# 数据库配置
MYSQL_ROOT_PASSWORD=your-strong-password
MYSQL_USER=voicematch
MYSQL_PASSWORD=your-strong-password

# 应用密钥
JWT_SECRET_KEY=your-super-secret-jwt-key
SECRET_KEY=your-super-secret-key

# 存储配置
STORAGE_BACKEND=local  # 或 minio
```

### 数据库配置
- **开发环境**: SQLite (默认)
- **生产环境**: MySQL 8.0
- **自动迁移**: 支持SQLite到MySQL的无缝迁移

## 部署到VPS

详细的VPS部署指南请参考 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

### 快速部署步骤
1. 上传项目到VPS
2. 配置环境变量
3. 执行数据迁移: `make migrate`
4. 启动服务: `make up`

## 开发指南

### 添加新功能
1. 在 `backend/app/models/` 中定义数据模型
2. 在 `backend/app/schemas/` 中定义API模式
3. 在 `backend/app/api/` 中实现API端点
4. 在 `frontend/src/components/` 中创建UI组件
5. 在 `frontend/src/pages/` 中创建页面

### 代码规范
- 使用 `black` 格式化Python代码
- 使用 `ruff` 进行Python代码检查
- 使用 `pre-commit` 进行提交前检查
- 遵循TypeScript和React最佳实践

## 故障排除

### 常见问题
1. **数据库连接失败**: 检查MySQL服务状态和网络配置
2. **前端无法访问后端**: 检查Nginx代理配置和CORS设置
3. **数据迁移失败**: 查看迁移日志，确保MySQL服务正常运行

### 日志查看
```bash
# 查看所有服务日志
make logs

# 查看特定服务日志
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f db
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 支持

如有问题或建议，请：
1. 查看 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) 部署指南
2. 检查 [ADMIN_FEATURES_README.md](ADMIN_FEATURES_README.md) 管理员功能说明
3. 提交 Issue 或 Pull Request

---

**注意**: 首次部署时，数据迁移可能需要几分钟时间。迁移完成后，您的所有数据将安全地存储在MySQL数据库中。

