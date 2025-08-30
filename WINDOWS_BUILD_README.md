# VoiceMatch Windows 环境构建指南

## 🪟 Windows 环境要求

- Windows 10/11
- Node.js 18+ (推荐使用 LTS 版本)
- Python 3.11+ 
- Git Bash 或 PowerShell

## 🚀 快速开始

### 1. 一键构建前端
```cmd
build-frontend.bat
```

### 2. 一键构建完整项目
```cmd
build-project.bat
```

### 3. 手动构建步骤

#### 前端构建
```cmd
cd frontend
npm install
npm run build
```

#### 后端配置检查
```cmd
cd backend
python check_db.py
```

## 📁 构建输出

- **前端构建文件**: `frontend\dist\`
- **后端配置检查**: 运行 `python check_db.py` 查看

## 🛠️ 可用的构建命令

### 前端命令
```cmd
npm run dev          # 启动开发服务器 (http://localhost:3000)
npm run build        # 构建生产版本 (跳过类型检查)
npm run build:check  # 构建生产版本 (包含类型检查)
npm run preview      # 预览构建结果
npm run lint         # 代码检查
```

### 后端命令
```cmd
python check_db.py                    # 检查数据库配置
python -m uvicorn app.main:app --reload  # 启动开发服务器
```

## 🔧 故障排除

### 前端构建问题

1. **TypeScript 类型错误**
   - 使用 `npm run build` (跳过类型检查)
   - 或修复类型错误后使用 `npm run build:check`

2. **依赖安装失败**
   ```cmd
   npm cache clean --force
   npm install
   ```

3. **端口被占用**
   - 修改 `vite.config.ts` 中的端口配置
   - 或关闭占用端口的程序

### 后端问题

1. **Python 依赖缺失**
   ```cmd
   cd backend
   pip install -r requirements.txt
   ```

2. **数据库连接失败**
   - 运行 `python check_db.py` 检查配置
   - 检查环境变量设置

## 🐳 Docker 部署 (可选)

### 构建 Docker 镜像
```cmd
docker-compose build
```

### 启动服务
```cmd
docker-compose up -d
```

### 查看日志
```cmd
docker-compose logs -f
```

## 📊 开发环境启动

### 方式 1: 分别启动
```cmd
# 终端 1: 启动前端
cd frontend
npm run dev

# 终端 2: 启动后端
cd backend
python -m uvicorn app.main:app --reload
```

### 方式 2: 使用 Docker Compose
```cmd
docker-compose -f docker-compose.dev.yml up -d
```

## 🌐 访问地址

- **前端开发**: http://localhost:3000
- **后端API**: http://localhost:8000
- **API文档**: http://localhost:8000/api/docs

## 📝 注意事项

1. **路径分隔符**: Windows 使用反斜杠 `\`，代码中使用正斜杠 `/`
2. **环境变量**: 复制 `env.example` 为 `.env` 并配置
3. **权限问题**: 以管理员身份运行命令提示符
4. **防火墙**: 确保端口 3000 和 8000 未被阻止

## 🔍 调试技巧

1. **查看构建日志**: 仔细阅读错误信息
2. **检查文件路径**: 确保所有文件都在正确位置
3. **验证依赖版本**: 检查 `package.json` 和 `requirements.txt`
4. **使用开发工具**: 浏览器开发者工具和 Python 调试器

## 📞 获取帮助

如果遇到问题：

1. 查看错误日志
2. 运行 `python check_db.py` 检查后端配置
3. 检查网络连接和端口状态
4. 参考项目主 README.md 文档

---

**提示**: 首次构建可能需要较长时间，请耐心等待依赖下载和编译完成。
