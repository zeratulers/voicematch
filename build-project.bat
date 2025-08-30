@echo off
REM VoiceMatch 完整项目构建脚本
REM 适用于Windows系统

echo.
echo ============================================================
echo VoiceMatch 完整项目构建
echo ============================================================
echo.

echo 步骤 1: 构建前端
echo ----------------------------------------
cd frontend
call npm install
call npm run build
cd ..

echo.
echo 步骤 2: 检查后端配置
echo ----------------------------------------
cd backend
python check_db.py
cd ..

echo.
echo 步骤 3: 构建Docker镜像（可选）
echo ----------------------------------------
echo 如果您想构建Docker镜像，请运行:
echo docker-compose build
echo.

echo ============================================================
echo 项目构建完成！
echo ============================================================
echo.
echo 前端构建输出: frontend\dist
echo 后端配置检查: 已完成
echo.
echo 下一步:
echo 1. 启动开发环境: cd frontend ^&^& npm run dev
echo 2. 启动后端: cd backend ^&^& python -m uvicorn app.main:app --reload
echo 3. 或使用Docker: docker-compose up -d
echo ============================================================
echo.

pause
