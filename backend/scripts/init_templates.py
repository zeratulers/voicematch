#!/usr/bin/env python3
"""
初始化数据库模板指令和方言设置

这个脚本用于在数据库中创建默认的模板指令和方言变体，
新用户创建时会自动复制这些模板。
"""

import asyncio
import sys
import os
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.database import get_db
from app.models.dialect_set import DialectSet
from app.models.command import Command
from app.models.command_variant import CommandVariant
from app.models.user import User, UserRole
from app.core.security import create_password_hash
from app.core.config import settings

# 默认方言设置
DEFAULT_DIALECTS = [
    {
        "key": "zh-cn",
        "label": "普通话",
        "notes": "标准普通话，适用于全国大部分地区",
        "is_default": True
    },
    {
        "key": "zh-yue",
        "label": "粤语",
        "notes": "广东话，适用于广东、香港、澳门等地区",
        "is_default": False
    },
    {
        "key": "zh-wu",
        "label": "吴语",
        "notes": "上海话、苏州话等，适用于江浙沪地区",
        "is_default": False
    },
    {
        "key": "zh-hak",
        "label": "客家话",
        "notes": "客家方言，适用于广东、福建、江西等地区",
        "is_default": False
    },
    {
        "key": "en-us",
        "label": "美式英语",
        "notes": "美式英语发音，适用于国际交流",
        "is_default": False
    }
]

# 默认模板指令
DEFAULT_COMMANDS = [
    {
        "content": "请深呼吸",
        "description": "指导患者进行深呼吸练习，放松身心",
        "variants": [
            {
                "dialect_key": "zh-cn",
                "speaker_name": "女医生",
                "speaker_note": "温柔女声，语调平缓",
                "audio_url": "/templates/zh-cn/请深呼吸_女医生.mp3"
            },
            {
                "dialect_key": "zh-yue",
                "speaker_name": "男医生",
                "speaker_note": "温和男声，粤语发音",
                "audio_url": "/templates/zh-yue/请深呼吸_男医生.mp3"
            }
        ]
    },
    {
        "content": "请放松，不要紧张",
        "description": "安抚患者情绪，缓解紧张状态",
        "variants": [
            {
                "dialect_key": "zh-cn",
                "speaker_name": "女医生",
                "speaker_note": "温柔女声，语调舒缓",
                "audio_url": "/templates/zh-cn/请放松不要紧张_女医生.mp3"
            }
        ]
    },
    {
        "content": "请保持这个姿势",
        "description": "指导患者保持特定体位或姿势",
        "variants": [
            {
                "dialect_key": "zh-cn",
                "speaker_name": "男医生",
                "speaker_note": "清晰男声，语调坚定",
                "audio_url": "/templates/zh-cn/请保持这个姿势_男医生.mp3"
            }
        ]
    },
    {
        "content": "请配合一下",
        "description": "请求患者配合医疗操作",
        "variants": [
            {
                "dialect_key": "zh-cn",
                "speaker_name": "女医生",
                "speaker_note": "温和女声，语调友好",
                "audio_url": "/templates/zh-cn/请配合一下_女医生.mp3"
            }
        ]
    },
    {
        "content": "请告诉我您的感受",
        "description": "询问患者的主观感受和症状",
        "variants": [
            {
                "dialect_key": "zh-cn",
                "speaker_name": "女医生",
                "speaker_note": "关切女声，语调温和",
                "audio_url": "/templates/zh-cn/请告诉我您的感受_女医生.mp3"
            }
        ]
    }
]

async def init_database():
    """初始化数据库"""
    # 创建数据库引擎
    engine = create_async_engine(settings.DATABASE_URL)
    
    # 创建会话工厂
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        try:
            print("🚀 开始初始化数据库模板...")
            
            # 1. 创建默认方言
            print("📝 创建默认方言...")
            dialect_map = {}
            for dialect_data in DEFAULT_DIALECTS:
                # 检查方言是否已存在
                existing = await session.execute(
                    f"SELECT id FROM dialect_sets WHERE key = '{dialect_data['key']}'"
                )
                if existing.scalar_one_or_none():
                    print(f"   ⚠️  方言 {dialect_data['label']} 已存在，跳过")
                    continue
                
                dialect = DialectSet(**dialect_data)
                session.add(dialect)
                await session.flush()
                dialect_map[dialect_data['key']] = dialect.id
                print(f"   ✅ 创建方言: {dialect_data['label']} ({dialect_data['key']})")
            
            # 2. 创建默认模板指令
            print("📝 创建默认模板指令...")
            for command_data in DEFAULT_COMMANDS:
                # 检查指令是否已存在
                existing = await session.execute(
                    f"SELECT id FROM commands WHERE content = '{command_data['content']}' AND is_template = true"
                )
                if existing.scalar_one_or_none():
                    print(f"   ⚠️  指令 '{command_data['content']}' 已存在，跳过")
                    continue
                
                # 创建指令
                command = Command(
                    content=command_data['content'],
                    description=command_data['description'],
                    doctor_id=1,  # 假设ID为1的是管理员用户
                    is_active=True,
                    is_template=True
                )
                session.add(command)
                await session.flush()
                
                print(f"   ✅ 创建指令: {command_data['content']}")
                
                # 创建指令变体
                for variant_data in command_data['variants']:
                    dialect_id = dialect_map.get(variant_data['dialect_key'])
                    if not dialect_id:
                        print(f"   ⚠️  方言 {variant_data['dialect_key']} 不存在，跳过变体")
                        continue
                    
                    variant = CommandVariant(
                        command_id=command.id,
                        dialect_set_id=dialect_id,
                        audio_url=variant_data['audio_url'],
                        speaker_name=variant_data['speaker_name'],
                        speaker_note=variant_data['speaker_note'],
                        created_by=1,  # 假设ID为1的是管理员用户
                        is_active=True,
                        is_template=True
                    )
                    session.add(variant)
                    print(f"      ✅ 创建变体: {variant_data['speaker_name']} ({variant_data['dialect_key']})")
            
            # 3. 创建默认管理员用户（如果不存在）
            print("👤 检查默认管理员用户...")
            admin_user = await session.execute(
                "SELECT id FROM users WHERE username = 'admin'"
            )
            if not admin_user.scalar_one_or_none():
                admin = User(
                    username='admin',
                    password_hash=create_password_hash('admin123'),
                    role=UserRole.ADMIN,
                    is_active=True,
                    full_name='系统管理员',
                    department='系统管理'
                )
                session.add(admin)
                print("   ✅ 创建默认管理员用户: admin/admin123")
            else:
                print("   ⚠️  默认管理员用户已存在")
            
            # 提交所有更改
            await session.commit()
            print("🎉 数据库模板初始化完成！")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ 初始化失败: {e}")
            raise
        finally:
            await session.close()
    
    await engine.dispose()

async def main():
    """主函数"""
    try:
        await init_database()
    except Exception as e:
        print(f"❌ 程序执行失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
