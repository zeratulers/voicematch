"""
配置管理模块

使用Pydantic Settings管理环境变量和应用配置
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os
from pathlib import Path


class Settings(BaseSettings):
    """应用配置类"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # 基本应用设置
    APP_NAME: str = "VoiceMatch术中语音指令播放系统"
    DEBUG: bool = Field(default=False, description="调试模式")
    SECRET_KEY: str = Field(..., description="应用密钥，用于JWT签名")
    
    # 数据库配置
    DATABASE_URL: str = Field(
        default="sqlite:///./voicematch.db",
        description="数据库连接URL，支持MySQL或SQLite"
    )
    
    # JWT配置
    JWT_SECRET_KEY: str = Field(..., description="JWT密钥")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="访问令牌过期时间（分钟）")
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, description="刷新令牌过期时间（天）")
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT签名算法")
    
    # CORS配置
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"],
        description="允许的CORS源"
    )
    
    # 存储配置
    STORAGE_BACKEND: str = Field(default="local", description="存储后端：local或minio")
    AUDIO_STORAGE_PATH: str = Field(default="./data/audio", description="本地音频存储路径")
    
    # MinIO配置（当STORAGE_BACKEND为minio时使用）
    MINIO_ENDPOINT: Optional[str] = Field(default=None, description="MinIO端点")
    MINIO_ACCESS_KEY: Optional[str] = Field(default=None, description="MinIO访问密钥")
    MINIO_SECRET_KEY: Optional[str] = Field(default=None, description="MinIO密钥")
    MINIO_BUCKET: str = Field(default="voicematch-audio", description="MinIO存储桶")
    MINIO_SECURE: bool = Field(default=False, description="是否使用HTTPS连接MinIO")
    
    # 文件上传限制
    MAX_UPLOAD_SIZE: int = Field(default=50 * 1024 * 1024, description="最大上传文件大小（字节）")
    MAX_AUDIO_DURATION: int = Field(default=300, description="最大音频时长（秒）")
    ALLOWED_AUDIO_FORMATS: List[str] = Field(
        default=["wav", "mp3", "opus", "m4a", "webm"],
        description="允许的音频格式"
    )
    
    # 数据保留配置
    RETENTION_DAYS: int = Field(default=365, description="数据保留天数")
    
    # 安全配置
    BCRYPT_ROUNDS: int = Field(default=12, description="bcrypt加密轮数")
    
    @property
    def is_mysql(self) -> bool:
        """判断是否使用MySQL数据库"""
        return self.DATABASE_URL.startswith("mysql")
    
    @property
    def is_sqlite(self) -> bool:
        """判断是否使用SQLite数据库"""
        return self.DATABASE_URL.startswith("sqlite")


# 创建全局配置实例
settings = Settings()
