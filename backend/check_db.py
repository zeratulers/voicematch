#!/usr/bin/env python3
"""
数据库配置检查脚本

检查当前使用的数据库类型和配置信息
"""

import os
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings
from app.core.database import get_db_url
from loguru import logger

def check_database_config():
    """检查数据库配置"""
    logger.info("🔍 VoiceMatch 数据库配置检查")
    logger.info("=" * 60)
    
    # 基本配置信息
    logger.info("📊 基本配置:")
    logger.info(f"   - 应用名称: {settings.APP_NAME}")
    logger.info(f"   - 调试模式: {settings.DEBUG}")
    logger.info(f"   - 存储后端: {settings.STORAGE_BACKEND}")
    
    # 数据库配置
    logger.info("\n🗄️ 数据库配置:")
    logger.info(f"   - 数据库类型: {'MySQL' if settings.is_mysql else 'SQLite'}")
    logger.info(f"   - 原始连接URL: {settings.DATABASE_URL}")
    logger.info(f"   - 异步连接URL: {get_db_url()}")
    
    if settings.is_sqlite:
        db_file = settings.DATABASE_URL.replace('sqlite:///', '')
        db_path = Path(db_file)
        if db_path.exists():
            file_size = db_path.stat().st_size
            logger.info(f"   - SQLite文件路径: {db_path.absolute()}")
            logger.info(f"   - SQLite文件大小: {file_size / (1024*1024):.2f} MB")
        else:
            logger.warning(f"   - ⚠️ SQLite文件不存在: {db_path.absolute()}")
    
    elif settings.is_mysql:
        # 解析MySQL连接信息
        url_parts = settings.DATABASE_URL.replace('mysql://', '').split('@')
        if len(url_parts) == 2:
            user_pass = url_parts[0].split(':')
            host_db = url_parts[1].split('/')
            if len(user_pass) == 2 and len(host_db) == 2:
                user = user_pass[0]
                password = user_pass[1] if user_pass[1] else '***'
                host_port = host_db[0].split(':')
                host = host_port[0]
                port = host_port[1] if len(host_port) > 1 else '3306'
                database = host_db[1]
                
                logger.info(f"   - MySQL主机: {host}")
                logger.info(f"   - MySQL端口: {port}")
                logger.info(f"   - MySQL用户: {user}")
                logger.info(f"   - MySQL密码: {'***' if password != '***' else '未设置'}")
                logger.info(f"   - MySQL数据库: {database}")
    
    # 环境变量检查
    logger.info("\n🌍 环境变量:")
    env_vars = [
        'MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE',
        'DATABASE_URL', 'STORAGE_BACKEND', 'DEBUG'
    ]
    
    for var in env_vars:
        value = os.getenv(var)
        if value:
            if 'PASSWORD' in var:
                logger.info(f"   - {var}: ***")
            else:
                logger.info(f"   - {var}: {value}")
        else:
            logger.info(f"   - {var}: 未设置")
    
    # 配置验证
    logger.info("\n✅ 配置验证:")
    try:
        if settings.is_mysql:
            logger.info("   - ✅ 使用MySQL数据库")
            if 'mysql' in settings.DATABASE_URL.lower():
                logger.info("   - ✅ MySQL连接URL格式正确")
            else:
                logger.warning("   - ⚠️ MySQL连接URL格式可能不正确")
        elif settings.is_sqlite:
            logger.info("   - ✅ 使用SQLite数据库")
            if 'sqlite' in settings.DATABASE_URL.lower():
                logger.info("   - ✅ SQLite连接URL格式正确")
            else:
                logger.warning("   - ⚠️ SQLite连接URL格式可能不正确")
        
        # 检查存储配置
        if settings.STORAGE_BACKEND == 'local':
            storage_path = Path(settings.AUDIO_STORAGE_PATH)
            if storage_path.exists():
                logger.info(f"   - ✅ 本地存储路径存在: {storage_path.absolute()}")
            else:
                logger.warning(f"   - ⚠️ 本地存储路径不存在: {storage_path.absolute()}")
        elif settings.STORAGE_BACKEND == 'minio':
            logger.info("   - ✅ 使用MinIO对象存储")
            if settings.MINIO_ENDPOINT:
                logger.info(f"   - ✅ MinIO端点已配置: {settings.MINIO_ENDPOINT}")
            else:
                logger.warning("   - ⚠️ MinIO端点未配置")
        
    except Exception as e:
        logger.error(f"   - ❌ 配置验证失败: {e}")
    
    logger.info("=" * 60)
    logger.info("🎯 总结:")
    if settings.is_mysql:
        logger.info("   当前配置使用 MySQL 数据库")
        logger.info("   适用于生产环境部署")
    elif settings.is_sqlite:
        logger.info("   当前配置使用 SQLite 数据库")
        logger.info("   适用于开发环境或单机部署")
    
    logger.info("=" * 60)

def main():
    """主函数"""
    try:
        check_database_config()
    except Exception as e:
        logger.error(f"检查过程中发生错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
