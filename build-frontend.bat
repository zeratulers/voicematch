@echo off
REM VoiceMatch 前端构建脚本
REM 适用于Windows系统

echo.
echo ============================================================
echo VoiceMatch 前端构建
echo ============================================================
echo.

cd frontend

echo 正在安装依赖...
call npm install

echo.
echo 正在构建前端...
call npm run build

echo.
echo ============================================================
echo 前端构建完成！
echo 构建输出目录: frontend\dist
echo ============================================================
echo.

pause
