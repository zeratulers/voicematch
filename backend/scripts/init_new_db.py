#!/usr/bin/env python3
"""
重新初始化数据库 - 新架构

根据新的业务逻辑重新创建数据库表和初始数据
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from app.core.database import Base, get_db_url
from app.models import (
    User, UserRole, Patient, Gender, Command, CommandVariant, 
    DialectSet, PatientCommandAssignment, SystemSetting, AuditLog
)


async def init_database():
    """初始化数据库"""
    print("开始初始化数据库...")
    
    # 创建数据库引擎
    engine = create_async_engine(get_db_url())
    
    # 创建所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("数据库表创建完成！")
    
    # 关闭引擎
    await engine.dispose()


async def create_initial_data():
    """创建初始数据"""
    from app.core.database import async_session_factory
    from app.core.security import create_password_hash
    
    print("开始创建初始数据...")
    
    async with async_session_factory() as session:
        # 1. 创建方言集
        dialect_sets = [
            DialectSet(key="zh-cn", label="普通话", notes="标准普通话", is_default=True),
            DialectSet(key="zh-yue", label="粤语", notes="广东话"),
            DialectSet(key="zh-wu", label="吴语", notes="上海话/苏州话"),
            DialectSet(key="zh-min", label="闽语", notes="福建话/台湾话"),
            DialectSet(key="zh-hakka", label="客家话", notes="客家方言"),
            DialectSet(key="en-us", label="英语", notes="美式英语"),
        ]
        
        for dialect in dialect_sets:
            session.add(dialect)
        
        await session.flush()  # 刷新以获取ID
        
        # 2. 创建管理员用户
        admin_user = User(
            username="admin",
            password_hash=create_password_hash("admin123"),
            full_name="系统管理员",
            role=UserRole.ADMIN,
            is_active=True
        )
        session.add(admin_user)
        
        # 3. 创建测试医生
        doctor_user = User(
            username="doctor",
            password_hash=create_password_hash("doctor123"),
            full_name="测试医生",
            role=UserRole.DOCTOR,
            is_active=True
        )
        session.add(doctor_user)
        
        await session.flush()  # 刷新以获取用户ID
        
        # 4. 创建模板指令（管理员创建的默认指令库）
        template_commands = [
            {
                "content": "请放松，不要紧张",
                "description": "术前安抚指令",
            },
            {
                "content": "请深呼吸，保持平静",
                "description": "呼吸引导指令",
            },
            {
                "content": "手术即将开始，请配合医生",
                "description": "手术开始提醒",
            },
            {
                "content": "请不要移动，保持当前姿势",
                "description": "体位固定指令",
            },
            {
                "content": "手术进行顺利，请继续配合",
                "description": "术中鼓励指令",
            },
            {
                "content": "手术已经完成，感谢您的配合",
                "description": "手术结束指令",
            }
        ]
        
        created_commands = []
        for cmd_data in template_commands:
            command = Command(
                content=cmd_data["content"],
                description=cmd_data["description"],
                doctor_id=admin_user.id,
                is_template=True,
                is_active=True
            )
            session.add(command)
            created_commands.append(command)
        
        await session.flush()  # 刷新以获取指令ID
        
        # 5. 为每个模板指令创建默认的普通话变体
        default_dialect = next(d for d in dialect_sets if d.key == "zh-cn")
        
        for command in created_commands:
            variant = CommandVariant(
                command_id=command.id,
                dialect_set_id=default_dialect.id,
                audio_url=f"/media/template/{command.id}_zh-cn.mp3",
                speaker_name="系统默认",
                speaker_note="标准女声",
                created_by=admin_user.id,
                is_template=True,
                is_active=True
            )
            session.add(variant)
        
        # 6. 创建测试患者
        test_patient = Patient(
            name="张三",
            gender=Gender.MALE,
            doctor_id=doctor_user.id,
            note="测试患者"
        )
        session.add(test_patient)
        
        await session.commit()
        print("初始数据创建完成！")
        
        # 打印创建的数据统计
        print(f"创建了 {len(dialect_sets)} 个方言集")
        print(f"创建了 2 个用户（admin, doctor）")
        print(f"创建了 {len(template_commands)} 个模板指令")
        print(f"创建了 {len(template_commands)} 个模板变体")
        print(f"创建了 1 个测试患者")


async def main():
    """主函数"""
    try:
        await init_database()
        await create_initial_data()
        print("\n🎉 数据库初始化完成！")
        print("\n登录信息:")
        print("管理员: admin / admin123")
        print("医生: doctor / doctor123")
        
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
