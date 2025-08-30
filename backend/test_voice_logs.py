#!/usr/bin/env python3
"""
测试语音日志功能
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent))

from app.core.database import async_session_factory
from app.models.voice_log import VoiceLog
from app.models.user import User
from app.models.patient import Patient
from app.schemas.voice_log import VoiceLogCreate


async def test_voice_logs():
    """测试语音日志功能"""
    print("开始测试语音日志功能...")
    
    async with async_session_factory() as session:
        # 获取测试用户和患者
        user = await session.get(User, 1)  # 假设ID为1的用户存在
        patient = await session.get(Patient, 1)  # 假设ID为1的患者存在
        
        if not user or not patient:
            print("❌ 测试用户或患者不存在，请先运行数据库初始化脚本")
            return
        
        print(f"✅ 使用测试用户: {user.username}")
        print(f"✅ 使用测试患者: {patient.name}")
        
        # 创建测试语音日志
        test_log = VoiceLog(
            patient_id=patient.id,
            user_id=user.id,
            transcript="请放松，不要紧张",
            confidence=0.95,
            status="success",
            matched_command_id="test-command-123",
            matched_command_content="请放松，不要紧张",
            matched_confidence=0.95,
            processing_time_ms=150
        )
        
        session.add(test_log)
        await session.commit()
        
        print(f"✅ 创建语音日志成功，ID: {test_log.id}")
        
        # 查询语音日志
        logs = await session.execute(
            "SELECT * FROM voice_logs WHERE patient_id = :patient_id",
            {"patient_id": patient.id}
        )
        
        print(f"✅ 查询到 {len(logs.fetchall())} 条语音日志")
        
        print("🎉 语音日志功能测试完成！")


if __name__ == "__main__":
    asyncio.run(test_voice_logs())
