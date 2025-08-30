# VoiceMatch 部署指南

## 概述

本指南将帮助您将VoiceMatch系统从本地开发环境部署到VPS服务器，并完成SQLite到MySQL的数据迁移。

## 前置要求

- VPS服务器（推荐Ubuntu 20.04+或CentOS 8+）
- Docker 20.10+
- Docker Compose 2.0+
- 至少4GB可用内存
- 至少20GB可用磁盘空间

## 部署步骤

### 1. 准备服务器环境

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户添加到docker组
sudo usermod -aG docker $USER
# 重新登录或执行：newgrp docker
```

### 2. 上传项目文件

```bash
# 在本地打包项目
cd /path/to/VoiceMatch
tar -czf voicematch.tar.gz . --exclude=node_modules --exclude=venv --exclude=.git

# 上传到服务器
scp voicematch.tar.gz user@your-server:/home/user/

# 在服务器上解压
cd /home/user
tar -xzf voicematch.tar.gz
cd VoiceMatch
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量（重要：修改默认密码和密钥）
nano .env
```

关键配置项：
- `MYSQL_ROOT_PASSWORD`: 设置强密码
- `JWT_SECRET_KEY`: 设置强密钥
- `SECRET_KEY`: 设置强密钥

### 4. 执行数据迁移（含自动修复 commands 表与时间戳）

```bash
# 启动数据库服务
make db-reset

# 等待数据库完全启动（约30秒）
sleep 30

# 执行数据迁移（自动：建表+数据导入）
make migrate-only

# 如迁移日志中出现：
#  "创建表 commands 失败: Incorrect column specifier for column 'id'"
# 说明 SQLite 的 commands.id 为 UUID 文本，已自动改为 MySQL VARCHAR(36) 主键；
# 迁移脚本已内置修复逻辑。若迁移中断，可再次运行：
# make migrate-only
```

迁移过程将：
1. 自动创建MySQL表结构
2. 将SQLite数据导入MySQL
3. 显示迁移进度和结果
 4. 自动将 commands.id 映射为 VARCHAR(36) 主键（UUID）
 5. 自动规范 created_at/updated_at 时间戳字符串，兼容 Z 结尾

### 5. 启动完整服务

```bash
# 构建并启动所有服务
make build
make up

# 查看服务状态
docker-compose ps

# 查看日志
make logs
```

### 6. 验证部署

```bash
# 检查服务健康状态
curl -f http://localhost/health

# 检查API服务
curl -f http://localhost:8000/api/health

# 检查数据库连接
docker exec voicematch_db mysql -u voicematch -p -e "SHOW TABLES;"
```

## 数据迁移说明

### 迁移过程

1. **自动表结构创建**: 脚本会自动分析SQLite表结构并创建对应的MySQL表
2. **数据类型映射**: 
   - INTEGER → INT
   - TEXT → TEXT
   - REAL → DOUBLE
   - BLOB → LONGBLOB
3. **数据导入**: 逐表导入所有数据
4. **错误处理**: 如果某个表迁移失败，会记录错误并继续其他表

### 迁移后验证

```bash
# 检查数据完整性
docker exec voicematch_db mysql -u voicematch -p -e "
SELECT 
    table_name,
    table_rows,
    data_length,
    index_length
FROM information_schema.tables 
WHERE table_schema = 'voicematch';
"
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   ```bash
   # 检查数据库容器状态
   docker-compose logs db
   
   # 重启数据库
   docker-compose restart db
   ```

2. **数据迁移失败**
   ```bash
   # 查看迁移日志
   docker-compose logs migrate
   
   # 重新执行迁移
   make migrate-only
   ```

3. **前端无法访问后端**
   ```bash
   # 检查网络配置
   docker exec voicematch_web ping api
   
   # 查看nginx日志
   docker exec voicematch_web tail -f /var/log/nginx/error.log
   ```

### 日志查看

```bash
# 查看所有服务日志
make logs

# 查看特定服务日志
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f db
```

## 性能优化

### 数据库优化

```bash
# 在.env中调整MySQL配置
MYSQL_MAX_CONNECTIONS=1000
MYSQL_INNODB_BUFFER_POOL_SIZE=1G
```

### 前端优化

- 启用gzip压缩（已在nginx.conf中配置）
- 静态资源缓存（已在nginx.conf中配置）
- CDN加速（可选）

## 安全建议

1. **修改默认密码**: 生产环境必须修改所有默认密码
2. **防火墙配置**: 只开放必要端口（80, 443, 8000）
3. **HTTPS配置**: 配置SSL证书
4. **定期备份**: 设置数据库自动备份
5. **监控告警**: 配置服务监控和告警

## 备份和恢复

### 数据库备份

```bash
# 创建备份
docker exec voicematch_db mysqldump -u root -p voicematch > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复备份
docker exec -i voicematch_db mysql -u root -p voicematch < backup_file.sql
```

### 完整系统备份

```bash
# 备份数据卷
docker run --rm -v voicematch_mysql_data:/data -v $(pwd):/backup alpine tar czf /backup/mysql_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# 备份配置文件
tar czf config_backup_$(date +%Y%m%d_%H%M%S).tar.gz .env docker-compose.yml
```

## 更新部署

```bash
# 停止服务
make down

# 拉取最新代码
git pull origin main

# 重新构建和启动
make build
make up
```

## 支持

如遇到问题，请：

1. 查看Docker容器日志
2. 检查环境变量配置
3. 验证网络连接
4. 查看系统资源使用情况

---

**注意**: 首次部署时，数据迁移可能需要几分钟时间，请耐心等待。迁移完成后，您的所有数据将安全地存储在MySQL数据库中。
