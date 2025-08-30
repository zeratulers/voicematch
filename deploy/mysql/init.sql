-- VoiceMatch MySQL 数据库初始化脚本
-- 创建数据库和用户权限

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS voicematch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE voicematch;

-- 创建用户（如果不存在）
CREATE USER IF NOT EXISTS 'voicematch'@'%' IDENTIFIED BY 'voicematch123';

-- 授予权限
GRANT ALL PRIVILEGES ON voicematch.* TO 'voicematch'@'%';

-- 刷新权限
FLUSH PRIVILEGES;

-- 设置字符集
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET character_set_connection=utf8mb4;

-- 显示数据库信息
SELECT 'VoiceMatch database initialized successfully!' as status;

