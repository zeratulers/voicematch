# VoiceMatch Docker 部署指南

## 快速开始

### 1. 环境要求
- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间

### 2. 一键启动生产环境
```bash
# 构建并启动所有服务
make build
make up

# 或者使用docker-compose直接启动
docker-compose up -d
```

### 3. 启动开发环境
```bash
# 启动开发环境（支持热重载）
make dev

# 或者使用docker-compose
docker-compose -f docker-compose.dev.yml up -d
```

## 服务说明

### 生产环境服务
- **前端 (web)**: http://localhost - React + Vite 构建的静态文件
- **后端 (api)**: http://localhost:8000 - FastAPI 服务
- **数据库 (db)**: localhost:3306 - MySQL 8.0
- **对象存储 (minio)**: localhost:9000 - MinIO 服务（可选）

### 开发环境服务
- **前端开发**: http://localhost:3000 - Vite 开发服务器（支持热重载）
- **后端开发**: http://localhost:8000 - FastAPI 开发服务器（支持热重载）
- **数据库**: localhost:3306 - MySQL 8.0

## 常用命令

### 生产环境
```bash
make up          # 启动服务
make down        # 停止服务
make logs        # 查看日志
make build       # 重新构建
```

### 开发环境
```bash
make dev         # 启动开发环境
make dev-down    # 停止开发环境
make dev-logs    # 查看开发环境日志
```

### 其他操作
```bash
make clean       # 清理所有容器和镜像
make help        # 显示帮助信息
```

## 环境变量配置

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

主要配置项：
- `MYSQL_ROOT_PASSWORD`: MySQL root密码
- `JWT_SECRET_KEY`: JWT密钥
- `STORAGE_BACKEND`: 存储后端（local/minio）
- `DEBUG`: 调试模式

## 网络配置

### 生产环境
- 前端通过 nginx 代理到后端 API
- 所有服务在同一网络中通信
- 外部访问端口：80 (HTTP), 443 (HTTPS)

### 开发环境
- 前端直接访问后端 API
- 支持热重载和实时调试
- 外部访问端口：3000 (前端), 8000 (后端)

## 故障排除

### 1. 端口冲突
如果端口被占用，修改 `docker-compose.yml` 中的端口映射：
```yaml
ports:
  - "8080:80"  # 改为其他端口
```

### 2. 数据库连接失败
```bash
# 检查数据库状态
docker-compose logs db

# 重启数据库
docker-compose restart db
```

### 3. 前端无法访问后端
检查 nginx 配置和网络设置：
```bash
# 检查前端容器网络
docker exec voicematch_web ping api

# 查看nginx日志
docker exec voicematch_web tail -f /var/log/nginx/error.log
```

### 4. 清理重建
```bash
# 完全清理并重建
make clean
make build
make up
```

## 性能优化

### 1. 数据库优化
- 调整 MySQL 配置参数
- 使用连接池
- 定期清理日志

### 2. 前端优化
- 启用 gzip 压缩
- 静态资源缓存
- CDN 加速

### 3. 监控和日志
- 使用 `docker stats` 监控资源使用
- 配置日志轮转
- 设置告警机制

## 安全建议

1. **修改默认密码**：生产环境必须修改所有默认密码
2. **限制网络访问**：只开放必要的端口
3. **定期更新**：定期更新 Docker 镜像和依赖
4. **备份数据**：定期备份数据库和重要文件
5. **HTTPS**：生产环境启用 HTTPS

## 扩展部署

### 1. 多实例部署
```yaml
# 在 docker-compose.yml 中添加
deploy:
  replicas: 3
```

### 2. 负载均衡
使用 nginx 或 traefik 进行负载均衡

### 3. 监控系统
集成 Prometheus + Grafana 监控

## 支持

如有问题，请查看：
1. Docker 容器日志
2. 应用日志
3. 网络连接状态
4. 配置文件语法
