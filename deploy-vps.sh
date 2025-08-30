#!/bin/bash

# VoiceMatch VPS 部署脚本
# 使用方法: ./deploy-vps.sh [版本号]

set -e

# 配置变量
DOCKER_REGISTRY="docker.io"
REPOSITORY="your-username/voicematch"  # 替换为您的Docker Hub用户名和仓库名
VERSION=${1:-"latest"}

echo "=========================================="
echo "🚀 VoiceMatch VPS 部署脚本"
echo "=========================================="
echo "版本: $VERSION"
echo "仓库: $DOCKER_REGISTRY/$REPOSITORY"
echo "=========================================="

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker 安装完成，请重新登录后运行此脚本"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，正在安装..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose 安装完成"
fi

# 创建部署目录
DEPLOY_DIR="./voicematch-deploy"
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

echo "📁 创建部署目录: $DEPLOY_DIR"

# 创建环境变量文件
if [ ! -f .env ]; then
    echo "📝 创建环境变量文件..."
    cat > .env << EOF
# VoiceMatch 环境变量配置
# 请根据实际情况修改这些值

# 数据库配置
MYSQL_ROOT_PASSWORD=your-strong-mysql-root-password
MYSQL_DATABASE=voicematch
MYSQL_USER=voicematch
MYSQL_PASSWORD=your-strong-mysql-password

# 应用密钥
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this
SECRET_KEY=your-super-secret-key-change-this

# 存储配置
STORAGE_BACKEND=local
AUDIO_STORAGE_PATH=./data/audio

# 其他配置
DEBUG=false
EOF
    echo "⚠️  请编辑 .env 文件，设置安全的密码和密钥"
fi

# 创建部署配置文件
echo "📋 创建部署配置文件..."
cat > docker-compose.yml << EOF
---
version: '3.8'

services:
  # 数据库服务
  db:
    image: mysql:8.0
    container_name: voicematch_db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: \${MYSQL_DATABASE}
      MYSQL_USER: \${MYSQL_USER}
      MYSQL_PASSWORD: \${MYSQL_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - voicematch-network
    command: >
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
      --max_connections=1000

  # 后端API服务
  api:
    image: $DOCKER_REGISTRY/$REPOSITORY-backend:$VERSION
    container_name: voicematch_api
    restart: unless-stopped
    environment:
      DATABASE_URL: mysql+aiomysql://\${MYSQL_USER}:\${MYSQL_PASSWORD}@db:3306/\${MYSQL_DATABASE}
      JWT_SECRET_KEY: \${JWT_SECRET_KEY}
      SECRET_KEY: \${SECRET_KEY}
      STORAGE_BACKEND: \${STORAGE_BACKEND}
      AUDIO_STORAGE_PATH: \${AUDIO_STORAGE_PATH}
      DEBUG: \${DEBUG}
    ports:
      - "8000:8000"
    volumes:
      - audio_data:/app/data
    networks:
      - voicematch-network
    depends_on:
      - db
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # 前端Web服务
  web:
    image: $DOCKER_REGISTRY/$REPOSITORY-frontend:$VERSION
    container_name: voicematch_web
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - voicematch-network
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mysql_data:
  audio_data:

networks:
  voicematch-network:
    driver: bridge
EOF

# 创建Nginx配置文件
echo "🌐 创建Nginx配置文件..."
cat > nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # 日志格式
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # 上游API服务器
    upstream api {
        server api:8000;
    }

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # 健康检查
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # API代理
        location /api/ {
            proxy_pass http://api/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # 媒体文件代理
        location /media/ {
            proxy_pass http://api/media/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # 前端静态文件
        location / {
            try_files \$uri \$uri/ /index.html;
        }

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
EOF

# 拉取最新镜像
echo "📥 拉取Docker镜像..."
docker pull $DOCKER_REGISTRY/$REPOSITORY-backend:$VERSION
docker pull $DOCKER_REGISTRY/$REPOSITORY-frontend:$VERSION

# 停止现有服务
echo "🛑 停止现有服务..."
docker-compose down 2>/dev/null || true

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 检查健康状态
echo "💚 检查服务健康状态..."
if curl -f http://localhost/api/health > /dev/null 2>&1; then
    echo "✅ 后端API服务正常"
else
    echo "❌ 后端API服务异常"
fi

if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ 前端Web服务正常"
else
    echo "❌ 前端Web服务异常"
fi

echo ""
echo "=========================================="
echo "🎉 VoiceMatch 部署完成！"
echo "=========================================="
echo "访问地址:"
echo "  - 前端: http://$(curl -s ifconfig.me 2>/dev/null || echo "localhost")"
echo "  - 后端API: http://$(curl -s ifconfig.me 2>/dev/null || echo "localhost"):8000"
echo "  - API文档: http://$(curl -s ifconfig.me 2>/dev/null || echo "localhost"):8000/api/docs"
echo ""
echo "管理命令:"
echo "  - 查看状态: docker-compose ps"
echo "  - 查看日志: docker-compose logs -f"
echo "  - 停止服务: docker-compose down"
echo "  - 重启服务: docker-compose restart"
echo "=========================================="
