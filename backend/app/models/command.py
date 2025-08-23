"""
指令模型 - 重新设计版本

存储医生创建的指令库，不绑定特定患者
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Command(Base):
    """
    指令表模型 - 指令库
    
    医生创建的指令库，包含所有可能的指令（不绑定特定患者）
    """
    __tablename__ = "commands"
    
    id = Column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4()),
        comment="指令UUID"
    )
    
    # 指令内容（明文存储）
    content = Column(
        Text, 
        nullable=False,
        comment="指令内容明文，如'请放松，不要紧张'"
    )
    
    # 指令描述或备注
    description = Column(
        Text,
        nullable=True,
        comment="指令描述或使用场景"
    )
    
    # 创建医生
    doctor_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="创建该指令的医生ID"
    )
    
    # 状态
    is_active = Column(Boolean, default=True, comment="是否激活")
    
    # 是否为模板（管理员创建的默认指令）
    is_template = Column(Boolean, default=False, comment="是否为系统模板")
    
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
    doctor = relationship("User", back_populates="commands")
    
    # 该指令下的所有方言变体
    variants = relationship(
        "CommandVariant",
        back_populates="command",
        cascade="all, delete-orphan"
    )
    
    # 患者分配记录
    patient_assignments = relationship(
        "PatientCommandAssignment",
        back_populates="command",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Command(id='{self.id}', content='{self.content[:20]}...', doctor_id={self.doctor_id})>"


# 索引
Index(
    "idx_command_doctor",
    Command.doctor_id
)

Index(
    "idx_command_template",
    Command.is_template
)

Index(
    "idx_command_active",
    Command.is_active
)