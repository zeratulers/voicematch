"""
数据库连接和会话管理模块

使用SQLAlchemy 2.x异步引擎和会话管理
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event
import asyncio
from typing import AsyncGenerator
from loguru import logger

from app.core.config import settings


class Base(DeclarativeBase):
    """SQLAlchemy声明性基类"""
    pass


# URL 规范化工具，避免重复添加 driver 前缀
def normalize_db_url(url: str) -> str:
    if url.startswith("mysql+"):
        # 已包含驱动，强制只保留一次 aiomysql
        # 例如：mysql+aiomysql+aiomysql:// -> mysql+aiomysql://
        url = url.replace("mysql+aiomysql+aiomysql://", "mysql+aiomysql://")
        url = url.replace("mysql+aiomysql+pymysql://", "mysql+aiomysql://")
        return url
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+aiomysql://")
    if url.startswith("sqlite+aiosqlite:///"):
        return url
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "sqlite+aiosqlite:///")
    return url

# 创建异步数据库引擎
if settings.is_mysql:
    # MySQL连接配置
    DATABASE_URL = normalize_db_url(settings.DATABASE_URL)
    logger.info(f"🔗 使用MySQL数据库")
    logger.info(f"   - 连接URL: {settings.DATABASE_URL}")
    logger.info(f"   - 异步URL: {DATABASE_URL}")
    logger.info(f"   - 数据库类型: MySQL 8.0")
    
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
elif settings.is_sqlite:
    # SQLite连接配置
    DATABASE_URL = normalize_db_url(settings.DATABASE_URL)
    logger.info(f"🔗 使用SQLite数据库")
    logger.info(f"   - 连接URL: {settings.DATABASE_URL}")
    logger.info(f"   - 异步URL: {DATABASE_URL}")
    logger.info(f"   - 数据库类型: SQLite")
    logger.info(f"   - 数据库文件: {settings.DATABASE_URL.replace('sqlite:///', '')}")
    
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False} if settings.is_sqlite else {},
    )
else:
    error_msg = f"❌ 不支持的数据库类型: {settings.DATABASE_URL}"
    logger.error(error_msg)
    raise ValueError(error_msg)


# SQLite外键约束支持
if settings.is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
        logger.info("   - 已启用SQLite外键约束支持")


# 创建异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False,
)

logger.info(f"✅ 数据库引擎初始化完成")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    数据库会话依赖注入
    
    Yields:
        AsyncSession: 数据库会话
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_db_url() -> str:
    """获取数据库连接URL"""
    if settings.is_mysql or settings.is_sqlite:
        return normalize_db_url(settings.DATABASE_URL)
    raise ValueError(f"不支持的数据库类型: {settings.DATABASE_URL}")


# 异步会话工厂别名
async_session_factory = AsyncSessionLocal


async def init_db() -> None:
    """
    初始化数据库表结构
    
    注意：生产环境应使用Alembic迁移而非此方法
    """
    logger.info("🔄 开始初始化数据库表结构...")
    
    # 导入所有模型以确保它们被注册到Base.metadata
    from app.models.user import User
    from app.models.patient import Patient
    from app.models.command import Command
    from app.models.dialect_set import DialectSet
    from app.models.command_variant import CommandVariant
    from app.models.patient_command_assignment import PatientCommandAssignment
    from app.models.system_setting import SystemSetting
    from app.models.audit_log import AuditLog
    
    logger.info(f"   - 已加载 {len(Base.metadata.tables)} 个数据模型")
    logger.info(f"   - 模型列表: {', '.join(Base.metadata.tables.keys())}")
    
    # 创建所有表（仅在开发环境使用）
    if settings.DEBUG:
        logger.info("   - 开发模式：正在创建数据库表...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("   - 数据库表创建完成")
    else:
        logger.info("   - 生产模式：跳过表创建（请使用Alembic迁移）")
    
    logger.info("✅ 数据库初始化完成")


async def close_db() -> None:
    """关闭数据库连接"""
    logger.info("🔄 正在关闭数据库连接...")
    await engine.dispose()
    logger.info("✅ 数据库连接已关闭")
