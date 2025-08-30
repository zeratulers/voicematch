"""
语音识别日志模型

记录语音识别的详细信息和结果
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class VoiceLog(Base):
    """
    语音识别日志表模型
    
    记录每次语音识别的详细信息，包括识别结果、匹配状态等
    """
    __tablename__ = "voice_logs"
    
    id = Column(Integer, primary_key=True, index=True, comment="日志ID")
    
    # 关联信息
    patient_id = Column(
        Integer,
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        comment="患者ID"
    )
    
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="操作用户ID（医生）"
    )
    
    # 识别结果
    transcript = Column(
        Text,
        nullable=False,
        comment="识别的文本内容"
    )
    
    confidence = Column(
        Float,
        nullable=False,
        comment="识别置信度 (0-1)"
    )
    
    status = Column(
        String(50),
        nullable=False,
        comment="识别状态: success, no_match, error"
    )
    
    # 指令匹配信息
    matched_command_id = Column(
        String(36),
        nullable=True,
        comment="匹配到的指令ID"
    )
    
    matched_command_content = Column(
        Text,
        nullable=True,
        comment="匹配到的指令内容"
    )
    
    matched_confidence = Column(
        Float,
        nullable=True,
        comment="指令匹配置信度"
    )
    
    # 性能信息
    processing_time_ms = Column(
        Integer,
        nullable=True,
        comment="处理时间(毫秒)"
    )
    
    # 时间戳
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="创建时间"
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间"
    )
    
    # 关系
    patient = relationship("Patient", back_populates=None)
    user = relationship("User", back_populates=None)
    
    def __repr__(self) -> str:
        return f"<VoiceLog(id={self.id}, patient_id={self.patient_id}, status='{self.status}')>"
