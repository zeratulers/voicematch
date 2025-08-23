"""
数据库连接和会话管理模块

使用SQLAlchemy 2.x异步引擎和会话管理
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event
import asyncio
from typing import AsyncGenerator

from app.core.config import settings


class Base(DeclarativeBase):
    """SQLAlchemy声明性基类"""
    pass


# 创建异步数据库引擎
if settings.is_mysql:
    # MySQL连接配置
    DATABASE_URL = settings.DATABASE_URL.replace("mysql://", "mysql+aiomysql://")
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
elif settings.is_sqlite:
    # SQLite连接配置
    DATABASE_URL = settings.DATABASE_URL.replace("sqlite:///", "sqlite+aiosqlite:///")
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False} if settings.is_sqlite else {},
    )
else:
    raise ValueError(f"不支持的数据库类型: {settings.DATABASE_URL}")


# SQLite外键约束支持
if settings.is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


# 创建异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False,
)


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
    if settings.is_mysql:
        return settings.DATABASE_URL.replace("mysql://", "mysql+aiomysql://")
    elif settings.is_sqlite:
        return settings.DATABASE_URL.replace("sqlite:///", "sqlite+aiosqlite:///")
    else:
        raise ValueError(f"不支持的数据库类型: {settings.DATABASE_URL}")


# 异步会话工厂别名
async_session_factory = AsyncSessionLocal


async def init_db() -> None:
    """
    初始化数据库表结构
    
    注意：生产环境应使用Alembic迁移而非此方法
    """
    # 导入所有模型以确保它们被注册到Base.metadata
    from app.models.user import User
    from app.models.patient import Patient
    from app.models.command import Command
    from app.models.dialect_set import DialectSet
    from app.models.command_variant import CommandVariant
    from app.models.patient_command_assignment import PatientCommandAssignment
    from app.models.system_setting import SystemSetting
    from app.models.audit_log import AuditLog
    
    # 创建所有表（仅在开发环境使用）
    if settings.DEBUG:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """关闭数据库连接"""
    await engine.dispose()
