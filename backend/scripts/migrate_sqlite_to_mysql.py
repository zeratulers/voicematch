#!/usr/bin/env python3
"""
SQLite到MySQL数据迁移脚本

将现有的SQLite数据库数据迁移到MySQL数据库
"""

import sqlite3
import mysql.connector
import os
import sys
from pathlib import Path
import logging

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def connect_sqlite(db_path):
    """连接SQLite数据库"""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        logger.error(f"连接SQLite数据库失败: {e}")
        return None

def connect_mysql(host, user, password, database):
    """连接MySQL数据库"""
    try:
        conn = mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            database=database
        )
        return conn
    except Exception as e:
        logger.error(f"连接MySQL数据库失败: {e}")
        return None

def get_table_names(sqlite_conn):
    """获取SQLite数据库中的所有表名"""
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row['name'] for row in cursor.fetchall()]
    cursor.close()
    return tables

def get_table_schema(sqlite_conn, table_name):
    """获取表结构"""
    cursor = sqlite_conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    cursor.close()
    return columns

def create_mysql_table(mysql_conn, table_name, columns):
    """在MySQL中创建表"""
    cursor = mysql_conn.cursor()
    
    # 构建CREATE TABLE语句
    column_definitions = []
    for col in columns:
        name = col['name']
        type_name = col['type'].upper()
        # 更稳健的类型映射与特殊列处理
        if name in ('created_at', 'updated_at'):
            mysql_type = 'DATETIME'
        elif 'INT' in type_name:
            # 将SQLite的 INTEGER 映射为 MySQL 的 INT
            mysql_type = 'INT'
        elif 'REAL' in type_name:
            mysql_type = 'DOUBLE'
        elif 'BLOB' in type_name:
            mysql_type = 'LONGBLOB'
        elif 'CHAR' in type_name or 'CLOB' in type_name or 'TEXT' in type_name:
            # 文本类型
            if table_name == 'commands' and name == 'id':
                # commands.id 在SQLite为UUID文本，MySQL用VARCHAR(36)
                mysql_type = 'VARCHAR(36)'
            else:
                mysql_type = 'TEXT'
        else:
            mysql_type = 'TEXT'

        # 主键与自增：仅整数型主键才自增；文本主键不自增
        pk_suffix = ''
        if col['pk']:
            if mysql_type.startswith('INT'):
                pk_suffix = ' PRIMARY KEY AUTO_INCREMENT'
            else:
                pk_suffix = ' PRIMARY KEY'

        # NULL/NOT NULL
        null_suffix = ' NOT NULL' if col['notnull'] else ' NULL'

        column_definitions.append(f"`{name}` {mysql_type}{pk_suffix}{null_suffix}")
    
    create_sql = f"CREATE TABLE IF NOT EXISTS `{table_name}` (\n"
    create_sql += ",\n".join(column_definitions)
    create_sql += "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    
    try:
        cursor.execute(create_sql)
        mysql_conn.commit()
        logger.info(f"表 {table_name} 创建成功")
        return True
    except Exception as e:
        logger.error(f"创建表 {table_name} 失败: {e}")
        return False
    finally:
        cursor.close()

def migrate_table_data(sqlite_conn, mysql_conn, table_name):
    """迁移表数据"""
    cursor_sqlite = sqlite_conn.cursor()
    cursor_mysql = mysql_conn.cursor()
    
    try:
        # 获取所有数据
        cursor_sqlite.execute(f"SELECT * FROM {table_name}")
        rows = cursor_sqlite.fetchall()
        
        if not rows:
            logger.info(f"表 {table_name} 没有数据")
            return True
        
        # 获取列名
        columns = [description[0] for description in cursor_sqlite.description]
        placeholders = ', '.join(['%s'] * len(columns))
        column_names = ', '.join([f"`{col}`" for col in columns])
        
        # 插入数据（处理DATETIME字段字符串）
        insert_sql = f"INSERT INTO `{table_name}` ({column_names}) VALUES ({placeholders})"
        
        for row in rows:
            values = []
            for col in columns:
                v = row[col]
                if col in ('created_at', 'updated_at') and isinstance(v, str):
                    # 兼容 "YYYY-MM-DD HH:MM:SS" / 带Z 结尾
                    try:
                        if v.endswith('Z'):
                            v = v.replace('Z', '')
                    except Exception:
                        pass
                values.append(v)
            cursor_mysql.execute(insert_sql, values)
        
        mysql_conn.commit()
        logger.info(f"表 {table_name} 数据迁移完成，共 {len(rows)} 条记录")
        return True
        
    except Exception as e:
        logger.error(f"迁移表 {table_name} 数据失败: {e}")
        mysql_conn.rollback()
        return False
    finally:
        cursor_sqlite.close()
        cursor_mysql.close()

def main():
    """主函数"""
    # 配置参数
    sqlite_db_path = "./voicematch.db"
    mysql_host = os.getenv("MYSQL_HOST", "db")
    mysql_user = os.getenv("MYSQL_USER", "voicematch")
    mysql_password = os.getenv("MYSQL_PASSWORD", "voicematch123")
    mysql_database = os.getenv("MYSQL_DATABASE", "voicematch")
    
    logger.info("🚀 开始SQLite到MySQL数据迁移...")
    logger.info("=" * 60)
    logger.info("📊 迁移配置信息:")
    logger.info(f"   - 源数据库: SQLite ({sqlite_db_path})")
    logger.info(f"   - 目标数据库: MySQL ({mysql_user}@{mysql_host}/{mysql_database})")
    logger.info(f"   - MySQL主机: {mysql_host}")
    logger.info(f"   - MySQL用户: {mysql_user}")
    logger.info(f"   - MySQL数据库: {mysql_database}")
    logger.info("=" * 60)
    
    # 检查SQLite数据库文件
    if not os.path.exists(sqlite_db_path):
        logger.error(f"❌ SQLite数据库文件不存在: {sqlite_db_path}")
        sys.exit(1)
    
    # 获取SQLite文件大小
    file_size = os.path.getsize(sqlite_db_path)
    logger.info(f"📁 SQLite数据库文件大小: {file_size / (1024*1024):.2f} MB")
    
    # 连接数据库
    logger.info("🔗 正在连接数据库...")
    sqlite_conn = connect_sqlite(sqlite_db_path)
    if not sqlite_conn:
        logger.error("❌ 连接SQLite数据库失败")
        sys.exit(1)
    logger.info("✅ SQLite数据库连接成功")
    
    mysql_conn = connect_mysql(mysql_host, mysql_user, mysql_password, mysql_database)
    if not mysql_conn:
        logger.error("❌ 连接MySQL数据库失败")
        sqlite_conn.close()
        sys.exit(1)
    logger.info("✅ MySQL数据库连接成功")
    
    try:
        # 获取所有表
        tables = get_table_names(sqlite_conn)
        logger.info(f"📋 发现 {len(tables)} 个表: {', '.join(tables)}")
        
        # 迁移每个表
        success_count = 0
        total_records = 0
        
        for i, table_name in enumerate(tables, 1):
            logger.info(f"🔄 正在迁移表 {i}/{len(tables)}: {table_name}")
            
            # 获取表结构
            columns = get_table_schema(sqlite_conn, table_name)
            logger.info(f"   - 表结构: {len(columns)} 个字段")
            
            # 创建MySQL表
            if create_mysql_table(mysql_conn, table_name, columns):
                # 迁移数据
                if migrate_table_data(sqlite_conn, mysql_conn, table_name):
                    success_count += 1
                    # 获取记录数
                    cursor = sqlite_conn.cursor()
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                    record_count = cursor.fetchone()[0]
                    total_records += record_count
                    cursor.close()
                    logger.info(f"   ✅ 表 {table_name} 迁移成功，{record_count} 条记录")
                else:
                    logger.error(f"   ❌ 表 {table_name} 数据迁移失败")
            else:
                logger.error(f"   ❌ 表 {table_name} 创建失败")
        
        logger.info("=" * 60)
        logger.info(f"🎉 迁移完成！")
        logger.info(f"   - 成功迁移: {success_count}/{len(tables)} 个表")
        logger.info(f"   - 总记录数: {total_records} 条")
        logger.info(f"   - 源数据库: SQLite ({sqlite_db_path})")
        logger.info(f"   - 目标数据库: MySQL ({mysql_user}@{mysql_host}/{mysql_database})")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ 迁移过程中发生错误: {e}")
        sys.exit(1)
    finally:
        sqlite_conn.close()
        mysql_conn.close()
        logger.info("🔒 数据库连接已关闭")

if __name__ == "__main__":
    main()
