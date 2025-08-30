@echo off
REM VoiceMatch VPS 部署脚本 (Windows版本)
REM 使用方法: deploy-vps.bat [版本号]

setlocal enabledelayedexpansion

REM 配置变量
set DOCKER_REGISTRY=docker.io
set REPOSITORY=your-username/voicematch
set VERSION=%1
if "%VERSION%"=="" set VERSION=latest

echo.
echo ============================================================
echo 🚀 VoiceMatch VPS 部署脚本 (Windows版本)
echo ============================================================
echo 版本: %VERSION%
echo 仓库: %DOCKER_REGISTRY%/%REPOSITORY%
echo ============================================================
echo.

REM 检查Docker是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker 未安装，请先安装 Docker Desktop
    echo 下载地址: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM 检查Docker Compose是否安装
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose 未安装，请先安装 Docker Compose
    pause
    exit /b 1
)

REM 创建部署目录
set DEPLOY_DIR=.\voicematch-deploy
if not exist "%DEPLOY_DIR%" mkdir "%DEPLOY_DIR%"
cd /d "%DEPLOY_DIR%"

echo 📁 创建部署目录: %DEPLOY_DIR%

REM 创建环境变量文件
if not exist .env (
    echo 📝 创建环境变量文件...
    (
        echo # VoiceMatch 环境变量配置
        echo # 请根据实际情况修改这些值
        echo.
        echo # 数据库配置
        echo MYSQL_ROOT_PASSWORD=your-strong-mysql-root-password
        echo MYSQL_DATABASE=voicematch
        echo MYSQL_USER=voicematch
        echo MYSQL_PASSWORD=your-strong-mysql-password
        echo.
        echo # 应用密钥
        echo JWT_SECRET_KEY=your-super-secret-jwt-key-change-this
        echo SECRET_KEY=your-super-secret-key-change-this
        echo.
        echo # 存储配置
        echo STORAGE_BACKEND=local
        echo AUDIO_STORAGE_PATH=./data/audio
        echo.
        echo # 其他配置
        echo DEBUG=false
    ) > .env
    echo ⚠️  请编辑 .env 文件，设置安全的密码和密钥
)

REM 创建部署配置文件
echo 📋 创建部署配置文件...
(
    echo version: '3.8'
    echo.
    echo services:
    echo   # 数据库服务
    echo   db:
    echo     image: mysql:8.0
    echo     container_name: voicematch_db
    echo     restart: unless-stopped
    echo     environment:
    echo       MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    echo       MYSQL_DATABASE: ${MYSQL_DATABASE}
    echo       MYSQL_USER: ${MYSQL_USER}
    echo       MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    echo     ports:
    echo       - "3306:3306"
    echo     volumes:
    echo       - mysql_data:/var/lib/mysql
    echo     networks:
    echo       - voicematch-network
    echo     command: ^>^
    echo       --character-set-server=utf8mb4
    echo       --collation-server=utf8mb4_unicode_ci
    echo       --max_connections=1000
    echo.
    echo   # 后端API服务
    echo   api:
    echo     image: %DOCKER_REGISTRY%/%REPOSITORY%-backend:%VERSION%
    echo     container_name: voicematch_api
    echo     restart: unless-stopped
    echo     environment:
    echo       DATABASE_URL: mysql+aiomysql://${MYSQL_USER}:${MYSQL_PASSWORD}@db:3306/${MYSQL_DATABASE}
    echo       JWT_SECRET_KEY: ${JWT_SECRET_KEY}
    echo       SECRET_KEY: ${SECRET_KEY}
    echo       STORAGE_BACKEND: ${STORAGE_BACKEND}
    echo       AUDIO_STORAGE_PATH: ${AUDIO_STORAGE_PATH}
    echo       DEBUG: ${DEBUG}
    echo     ports:
    echo       - "8000:8000"
    echo     volumes:
    echo       - audio_data:/app/data
    echo     networks:
    echo       - voicematch-network
    echo     depends_on:
    echo       - db
    echo.
    echo   # 前端Web服务
    echo   web:
    echo     image: %DOCKER_REGISTRY%/%REPOSITORY%-frontend:%VERSION%
    echo     container_name: voicematch_web
    echo     restart: unless-stopped
    echo     ports:
    echo       - "80:80"
    echo       - "443:443"
    echo     volumes:
    echo       - ./nginx.conf:/etc/nginx/nginx.conf:ro
    echo     networks:
    echo       - voicematch-network
    echo     depends_on:
    echo       - api
    echo.
    echo volumes:
    echo   mysql_data:
    echo   audio_data:
    echo.
    echo networks:
    echo   voicematch-network:
    echo     driver: bridge
) > docker-compose.yml

REM 创建Nginx配置文件
echo 🌐 创建Nginx配置文件...
(
    echo events {
    echo     worker_connections 1024;
    echo }
    echo.
    echo http {
    echo     include       /etc/nginx/mime.types;
    echo     default_type  application/octet-stream;
    echo.
    echo     # 日志格式
    echo     log_format main '$remote_addr - $remote_user [$time_local] "$request" '
    echo                     '$status $body_bytes_sent "$http_referer" '
    echo                     '"$http_user_agent" "$http_x_forwarded_for"';
    echo.
    echo     access_log /var/log/nginx/access.log main;
    echo     error_log /var/log/nginx/error.log;
    echo.
    echo     # Gzip压缩
    echo     gzip on;
    echo     gzip_vary on;
    echo     gzip_min_length 1024;
    echo     gzip_proxied any;
    echo     gzip_comp_level 6;
    echo     gzip_types
    echo         text/plain
    echo         text/css
    echo         text/xml
    echo         text/javascript
    echo         application/json
    echo         application/javascript
    echo         application/xml+rss
    echo         application/atom+xml
    echo         image/svg+xml;
    echo.
    echo     # 上游API服务器
    echo     upstream api {
    echo         server api:8000;
    echo     }
    echo.
    echo     server {
    echo         listen 80;
    echo         server_name _;
    echo         root /usr/share/nginx/html;
    echo         index index.html;
    echo.
    echo         # 健康检查
    echo         location /health {
    echo             access_log off;
    echo             return 200 "healthy\n";
    echo             add_header Content-Type text/plain;
    echo         }
    echo.
    echo         # API代理
    echo         location /api/ {
    echo             proxy_pass http://api/;
    echo             proxy_set_header Host $host;
    echo             proxy_set_header X-Real-IP $remote_addr;
    echo             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    echo             proxy_set_header X-Forwarded-Proto $scheme;
    echo         }
    echo.
    echo         # 媒体文件代理
    echo         location /media/ {
    echo             proxy_pass http://api/media/;
    echo             proxy_set_header Host $host;
    echo             proxy_set_header X-Real-IP $remote_addr;
    echo             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    echo             proxy_set_header X-Forwarded-Proto $scheme;
    echo         }
    echo.
    echo         # 前端静态文件
    echo         location / {
    echo             try_files $uri $uri/ /index.html;
    echo         }
    echo.
    echo         # 静态资源缓存
    echo         location ~* \.(js^|css^|png^|jpg^|jpeg^|gif^|ico^|svg^)$ {
    echo             expires 1y;
    echo             add_header Cache-Control "public, immutable";
    echo         }
    echo     }
    echo }
) > nginx.conf

REM 拉取最新镜像
echo 📥 拉取Docker镜像...
docker pull %DOCKER_REGISTRY%/%REPOSITORY%-backend:%VERSION%
docker pull %DOCKER_REGISTRY%/%REPOSITORY%-frontend:%VERSION%

REM 停止现有服务
echo 🛑 停止现有服务...
docker-compose down 2>nul

REM 启动服务
echo 🚀 启动服务...
docker-compose up -d

REM 等待服务启动
echo ⏳ 等待服务启动...
timeout /t 30 /nobreak >nul

REM 检查服务状态
echo 🔍 检查服务状态...
docker-compose ps

echo.
echo ============================================================
echo 🎉 VoiceMatch 部署完成！
echo ============================================================
echo 访问地址:
echo   - 前端: http://localhost
echo   - 后端API: http://localhost:8000
echo   - API文档: http://localhost:8000/api/docs
echo.
echo 管理命令:
echo   - 查看状态: docker-compose ps
echo   - 查看日志: docker-compose logs -f
echo   - 停止服务: docker-compose down
echo   - 重启服务: docker-compose restart
echo ============================================================
echo.

pause
