"""
VoiceMatch术中语音指令播放系统 - 主应用入口

该系统解决术中医患语言沟通问题，使用离线语音识别和预录制方言音频。
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger
import os
from pathlib import Path

from app.core.config import settings
from app.core.database import init_db
from app.api.auth import router as auth_router
from app.api.patients import router as patients_router
from app.api.commands import router as commands_router
from app.api.variants import router as variants_router
from app.api.patient_assignments import router as assignments_router
from app.api.uploads import router as uploads_router
from app.api.playback import router as playback_router
from app.api.admin import router as admin_router
from app.api.voice_logs import router as voice_logs_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动和关闭时的生命周期管理"""
    # 启动时显示数据库配置信息
    logger.info("🚀 VoiceMatch应用正在启动...")
    logger.info("=" * 60)
    logger.info("📊 数据库配置信息:")
    logger.info(f"   - 数据库类型: {'MySQL' if settings.is_mysql else 'SQLite'}")
    logger.info(f"   - 连接URL: {settings.DATABASE_URL}")
    logger.info(f"   - 存储后端: {settings.STORAGE_BACKEND}")
    logger.info(f"   - 调试模式: {settings.DEBUG}")
    logger.info("=" * 60)
    
    # 启动时初始化数据库
    logger.info("🔄 正在初始化数据库...")
    await init_db()
    logger.info("✅ 数据库初始化完成")
    
    # 确保音频存储目录存在
    audio_dir = Path(settings.AUDIO_STORAGE_PATH)
    audio_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"📁 音频存储目录: {audio_dir.absolute()}")
    
    logger.info("🎉 应用启动完成！")
    
    yield
    
    # 关闭时的清理工作
    logger.info("🔄 应用正在关闭...")


# 创建FastAPI应用实例
app = FastAPI(
    title="VoiceMatch术中语音指令播放系统",
    description="解决术中医患语言沟通问题的离线语音指令播放系统",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)

# CORS中间件配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 路由注册
app.include_router(auth_router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(patients_router, prefix="/api/v1/patients", tags=["患者管理"])
app.include_router(commands_router, prefix="/api/v1/commands", tags=["指令管理"])
app.include_router(variants_router, prefix="/api/v1", tags=["指令变体"])
app.include_router(assignments_router, prefix="/api/v1/assignments", tags=["患者分配"])
app.include_router(uploads_router, prefix="/api/v1/uploads", tags=["文件上传"])
app.include_router(playback_router, prefix="/api/v1/playback", tags=["音频播放"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["系统管理"])
app.include_router(voice_logs_router, prefix="/api/v1/voice-logs", tags=["语音日志"])


# 静态文件服务（音频文件）
if settings.STORAGE_BACKEND == "local":
    app.mount("/media", StaticFiles(directory=settings.AUDIO_STORAGE_PATH), name="media")


@app.get("/")
async def root():
    """根路径健康检查"""
    return {
        "message": "VoiceMatch术中语音指令播放系统",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "storage_backend": settings.STORAGE_BACKEND,
        "database": {
            "type": "MySQL" if settings.is_mysql else "SQLite",
            "url": settings.DATABASE_URL,
            "is_mysql": settings.is_mysql,
            "is_sqlite": settings.is_sqlite
        },
        "app_info": {
            "name": settings.APP_NAME,
            "debug": settings.DEBUG,
            "version": "1.0.0"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )
