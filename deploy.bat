@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo 🚀 VoiceMatch 部署脚本启动...
echo.

:: 检查Docker
echo 📋 检查Docker环境...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker未安装，请先安装Docker
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose未安装，请先安装Docker Compose
    pause
    exit /b 1
)

echo ✅ Docker环境检查通过
echo.

:: 检查环境变量文件
echo 📋 检查环境变量配置...
if not exist ".env" (
    if exist "env.example" (
        echo ⚠️  未找到.env文件，从env.example复制...
        copy "env.example" ".env" >nul
        echo ⚠️  请编辑.env文件，修改默认密码和密钥！
        echo ⚠️  按任意键继续...
        pause >nul
    ) else (
        echo ❌ 未找到环境变量配置文件
        pause
        exit /b 1
    )
)

echo ✅ 环境变量配置检查通过
echo.

:: 启动数据库
echo 🗄️  启动MySQL数据库...
docker-compose up -d db

echo ⏳ 等待数据库启动...
timeout /t 30 /nobreak >nul

echo ✅ 数据库启动完成
echo.

:: 执行数据迁移
echo 🔄 执行数据迁移...
if exist "backend\voicematch.db" (
    echo 📊 检测到SQLite数据库，开始迁移到MySQL...
    
    docker-compose --profile migrate up migrate
    
    if errorlevel 1 (
        echo ❌ 数据迁移失败
        pause
        exit /b 1
    )
    
    echo ✅ 数据迁移完成
) else (
    echo ⚠️  未检测到SQLite数据库，跳过迁移
)
echo.

:: 构建和启动服务
echo 🔨 构建Docker镜像...
make build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo 🚀 启动所有服务...
make up
if errorlevel 1 (
    echo ❌ 启动失败
    pause
    exit /b 1
)

echo ✅ 服务启动完成
echo.

:: 验证部署
echo 🔍 验证部署状态...
timeout /t 10 /nobreak >nul

docker-compose ps | findstr "Up" >nul
if errorlevel 1 (
    echo ❌ 服务启动异常
    docker-compose ps
    pause
    exit /b 1
)

echo ✅ 服务运行正常
echo.

:: 显示部署信息
echo 🎉 VoiceMatch 部署完成！
echo.
echo 📱 访问地址:
echo    前端: http://localhost
echo    后端API: http://localhost:8000
echo    API文档: http://localhost:8000/docs
echo.
echo 📊 服务状态:
echo    docker-compose ps
echo.
echo 📝 查看日志:
echo    make logs
echo.
echo 🛑 停止服务:
echo    make down
echo.
echo 🔄 重启服务:
echo    make up
echo.

pause

