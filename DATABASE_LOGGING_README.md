# VoiceMatch 数据库日志和检查功能

本文档说明VoiceMatch项目中的数据库日志输出和检查功能。

## 功能概述

VoiceMatch项目现在在初始化时会输出详细的数据库配置信息，包括：
- 当前使用的数据库类型（MySQL或SQLite）
- 数据库连接URL
- 数据库配置详情
- 存储后端配置
- 环境变量状态

## 日志输出位置

### 1. 应用启动日志

当应用启动时，会在控制台输出详细的数据库配置信息：

```bash
🚀 VoiceMatch应用正在启动...
============================================================
📊 数据库配置信息:
   - 数据库类型: MySQL
   - 连接URL: mysql+aiomysql://voicematch:voicematch123@db:3306/voicematch
   - 存储后端: local
   - 调试模式: false
============================================================
```

### 2. 数据库初始化日志

数据库引擎初始化时会显示详细信息：

```bash
🔗 使用MySQL数据库
   - 连接URL: mysql+aiomysql://voicematch:voicematch123@db:3306/voicematch
   - 异步URL: mysql+aiomysql://voicematch:voicematch123@db:3306/voicematch
   - 数据库类型: MySQL 8.0
✅ 数据库引擎初始化完成
```

### 3. 表结构初始化日志

```bash
🔄 开始初始化数据库表结构...
   - 已加载 8 个数据模型
   - 模型列表: users, patients, commands, dialect_sets, command_variants, patient_command_assignments, system_settings, audit_logs
   - 生产模式：跳过表创建（请使用Alembic迁移）
✅ 数据库初始化完成
```

## 数据库检查命令

### 使用Makefile命令

```bash
# 检查当前数据库配置
make check-db
```

### 直接运行Python脚本

```bash
# 进入后端目录
cd backend

# 运行检查脚本
python check_db.py
```

## 检查脚本输出示例

### MySQL配置示例

```bash
🔍 VoiceMatch 数据库配置检查
============================================================
📊 基本配置:
   - 应用名称: VoiceMatch术中语音指令播放系统
   - 调试模式: false
   - 存储后端: local

🗄️ 数据库配置:
   - 数据库类型: MySQL
   - 原始连接URL: mysql+aiomysql://voicematch:voicematch123@db:3306/voicematch
   - 异步连接URL: mysql+aiomysql://voicematch:voicematch123@db:3306/voicematch
   - MySQL主机: db
   - MySQL端口: 3306
   - MySQL用户: voicematch
   - MySQL密码: ***
   - MySQL数据库: voicematch

🌍 环境变量:
   - MYSQL_HOST: db
   - MYSQL_USER: voicematch
   - MYSQL_PASSWORD: ***
   - MYSQL_DATABASE: voicematch
   - DATABASE_URL: mysql+aiomysql://voicematch:voicematch123@db:3306/voicematch
   - STORAGE_BACKEND: local
   - DEBUG: false

✅ 配置验证:
   - ✅ 使用MySQL数据库
   - ✅ MySQL连接URL格式正确
   - ✅ 本地存储路径存在: /app/data/audio

============================================================
🎯 总结:
   当前配置使用 MySQL 数据库
   适用于生产环境部署
============================================================
```

### SQLite配置示例

```bash
🔍 VoiceMatch 数据库配置检查
============================================================
📊 基本配置:
   - 应用名称: VoiceMatch术中语音指令播放系统
   - 调试模式: true
   - 存储后端: local

🗄️ 数据库配置:
   - 数据库类型: SQLite
   - 原始连接URL: sqlite:///./voicematch.db
   - 异步连接URL: sqlite+aiosqlite:///./voicematch.db
   - SQLite文件路径: /app/voicematch.db
   - SQLite文件大小: 2.45 MB

🌍 环境变量:
   - DATABASE_URL: sqlite:///./voicematch.db
   - STORAGE_BACKEND: local
   - DEBUG: true

✅ 配置验证:
   - ✅ 使用SQLite数据库
   - ✅ SQLite连接URL格式正确
   - ✅ 本地存储路径存在: /app/data/audio

============================================================
🎯 总结:
   当前配置使用 SQLite 数据库
   适用于开发环境或单机部署
============================================================
```

## 健康检查端点

应用还提供了增强的健康检查端点 `/api/health`，返回详细的数据库信息：

```json
{
  "status": "healthy",
  "storage_backend": "local",
  "database": {
    "type": "MySQL",
    "url": "mysql+aiomysql://voicematch:voicematch123@db:3306/voicematch",
    "is_mysql": true,
    "is_sqlite": false
  },
  "app_info": {
    "name": "VoiceMatch术中语音指令播放系统",
    "debug": false,
    "version": "1.0.0"
  }
}
```

## 数据迁移日志

当执行SQLite到MySQL的数据迁移时，会显示详细的迁移进度：

```bash
🚀 开始SQLite到MySQL数据迁移...
============================================================
📊 迁移配置信息:
   - 源数据库: SQLite (./voicematch.db)
   - 目标数据库: MySQL (voicematch@db/voicematch)
   - MySQL主机: db
   - MySQL用户: voicematch
   - MySQL数据库: voicematch
============================================================
📁 SQLite数据库文件大小: 2.45 MB
🔗 正在连接数据库...
✅ SQLite数据库连接成功
✅ MySQL数据库连接成功
📋 发现 8 个表: users, patients, commands, dialect_sets, command_variants, patient_command_assignments, system_settings, audit_logs
🔄 正在迁移表 1/8: users
   - 表结构: 6 个字段
   - ✅ 表 users 迁移成功，3 条记录
...
============================================================
🎉 迁移完成！
   - 成功迁移: 8/8 个表
   - 总记录数: 156 条
   - 源数据库: SQLite (./voicematch.db)
   - 目标数据库: MySQL (voicematch@db/voicematch)
============================================================
```

## 环境变量配置

### 开发环境（SQLite）

```bash
# .env 文件
DATABASE_URL=sqlite:///./voicematch.db
STORAGE_BACKEND=local
DEBUG=true
```

### 生产环境（MySQL）

```bash
# .env 文件
DATABASE_URL=mysql+aiomysql://voicematch:voicematch123@db:3306/voicematch
STORAGE_BACKEND=local
DEBUG=false
MYSQL_HOST=db
MYSQL_USER=voicematch
MYSQL_PASSWORD=voicematch123
MYSQL_DATABASE=voicematch
```

## 故障排除

### 常见问题

1. **数据库类型识别错误**
   - 检查 `DATABASE_URL` 环境变量
   - 确保URL格式正确

2. **日志输出不完整**
   - 检查 `loguru` 配置
   - 确保日志级别设置正确

3. **检查脚本运行失败**
   - 确保在正确的目录下运行
   - 检查Python路径配置

### 调试建议

1. 使用 `make check-db` 命令快速检查配置
2. 查看应用启动日志了解数据库初始化过程
3. 使用健康检查端点验证运行时状态
4. 检查环境变量是否正确设置

## 总结

通过这些增强的日志输出和检查功能，您现在可以：

- 🎯 清楚地知道应用正在使用哪种数据库
- 📊 查看详细的数据库配置信息
- 🔍 快速诊断配置问题
- 📈 监控数据迁移进度
- ✅ 验证生产环境配置

这些功能大大提高了系统的可观测性和可维护性。
