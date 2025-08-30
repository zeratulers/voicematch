# 🚀 VoiceMatch GitHub Actions 自动化部署指南

## 📋 概述

本指南将帮助您设置GitHub Actions来自动构建Docker镜像，并推送到Docker Hub。这样您就可以在VPS上直接拉取最新的镜像进行部署。

## 🏗️ 架构说明

```
GitHub Repository → GitHub Actions → Docker Hub → VPS
     ↓                    ↓            ↓         ↓
   代码提交 → 自动构建镜像 → 推送镜像 → 拉取部署
```

## ⚙️ 设置步骤

### 1. 准备Docker Hub账户

1. **注册Docker Hub账户**
   - 访问 [Docker Hub](https://hub.docker.com/)
   - 创建账户并记住用户名

2. **创建访问令牌**
   - 登录Docker Hub
   - 进入 Account Settings → Security
   - 点击 "New Access Token"
   - 创建令牌并保存（只显示一次）

### 2. 配置GitHub Secrets

在您的GitHub仓库中设置以下Secrets：

1. **进入仓库设置**
   - 点击仓库页面的 "Settings" 标签
   - 左侧菜单选择 "Secrets and variables" → "Actions"

2. **添加Secrets**
   ```
   DOCKER_USERNAME: 您的Docker Hub用户名
   DOCKER_PASSWORD: 您的Docker Hub访问令牌
   ```

### 3. 修改配置文件

#### 修改部署脚本中的仓库名

在以下文件中，将 `your-username/voicematch` 替换为您的实际Docker Hub仓库名：

- `deploy-vps.sh` (Linux/Mac)
- `deploy-vps.bat` (Windows)

```bash
# 示例：如果您的Docker Hub用户名是 john，仓库名是 voicematch
REPOSITORY="john/voicematch"
```

## 🔄 工作流程

### 自动触发条件

1. **推送到主分支** (`main` 或 `master`)
   - 构建并推送 `latest` 标签的镜像

2. **创建版本标签** (`v*`)
   - 构建并推送指定版本的镜像
   - 例如：`v1.0.0` → 推送 `v1.0.0` 标签

3. **手动触发**
   - 在GitHub Actions页面手动运行
   - 可以指定自定义版本号

### 构建的镜像

每次构建会创建以下镜像：

- **后端镜像**: `your-username/voicematch-backend:版本号`
- **前端镜像**: `your-username/voicematch-frontend:版本号`

## 🚀 使用方法

### 1. 创建版本标签

```bash
# 创建并推送版本标签
git tag v1.0.0
git push origin v1.0.0
```

### 2. 手动触发构建

1. 进入GitHub仓库的 "Actions" 页面
2. 选择 "Production Docker Build" workflow
3. 点击 "Run workflow"
4. 输入版本号（如：`v1.0.1`）
5. 点击 "Run workflow"

### 3. 在VPS上部署

#### Linux/Mac VPS
```bash
# 下载部署脚本
wget https://raw.githubusercontent.com/your-username/voicematch/main/deploy-vps.sh
chmod +x deploy-vps.sh

# 部署最新版本
./deploy-vps.sh

# 部署指定版本
./deploy-vps.sh v1.0.0
```

#### Windows VPS
```cmd
# 下载部署脚本
# 运行部署脚本
deploy-vps.bat

# 部署指定版本
deploy-vps.bat v1.0.0
```

## 📁 文件结构

```
VoiceMatch/
├── .github/
│   └── workflows/
│       ├── docker-build.yml          # 完整构建workflow
│       └── production-deploy.yml     # 生产环境构建workflow
├── deploy-vps.sh                     # Linux/Mac部署脚本
├── deploy-vps.bat                    # Windows部署脚本
├── build-frontend.bat                # Windows前端构建脚本
├── build-project.bat                 # Windows完整项目构建脚本
└── check-db.bat                      # Windows数据库检查脚本
```

## 🔧 故障排除

### 常见问题

1. **Docker Hub认证失败**
   - 检查 `DOCKER_USERNAME` 和 `DOCKER_PASSWORD` 是否正确
   - 确认访问令牌是否有效

2. **构建失败**
   - 检查GitHub Actions日志
   - 确认Dockerfile语法正确
   - 检查依赖是否完整

3. **镜像拉取失败**
   - 确认镜像已成功推送到Docker Hub
   - 检查网络连接
   - 验证镜像名称和标签

### 调试技巧

1. **查看构建日志**
   - 在GitHub Actions页面查看详细日志
   - 关注错误信息和警告

2. **本地测试**
   - 在本地运行 `docker build` 命令
   - 测试Docker Compose配置

3. **检查镜像**
   - 在Docker Hub上确认镜像存在
   - 使用 `docker pull` 测试拉取

## 📊 监控和维护

### 1. 构建状态监控

- 定期检查GitHub Actions运行状态
- 监控构建时间和成功率
- 设置构建失败通知

### 2. 镜像管理

- 定期清理旧版本镜像
- 监控Docker Hub存储使用量
- 备份重要的镜像版本

### 3. 部署验证

- 在VPS上验证服务健康状态
- 检查日志和性能指标
- 测试关键功能

## 🔒 安全建议

1. **访问令牌安全**
   - 定期轮换Docker Hub访问令牌
   - 使用最小权限原则
   - 不要在代码中硬编码令牌

2. **镜像安全**
   - 定期更新基础镜像
   - 扫描镜像中的安全漏洞
   - 使用多阶段构建减少攻击面

3. **部署安全**
   - 使用强密码和密钥
   - 限制网络访问
   - 定期更新依赖

## 📈 扩展功能

### 1. 多环境部署

可以创建不同的workflow用于：
- 开发环境
- 测试环境
- 预生产环境
- 生产环境

### 2. 自动化测试

在构建过程中添加：
- 单元测试
- 集成测试
- 安全扫描
- 性能测试

### 3. 通知集成

集成通知服务：
- Slack
- Discord
- 邮件
- 钉钉/企业微信

## 📞 获取帮助

如果遇到问题：

1. 查看GitHub Actions日志
2. 检查Docker Hub镜像状态
3. 验证VPS部署配置
4. 参考Docker和GitHub Actions官方文档

---

**提示**: 首次设置可能需要一些时间，建议先在测试环境中验证整个流程。
