"""
患者指令分配模型

管理患者与指令变体的绑定关系
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class PatientCommandAssignment(Base):
    """
    患者指令分配表
    
    管理哪个患者使用哪个指令的哪个方言变体
    """
    __tablename__ = "patient_command_assignments"
    
    id = Column(Integer, primary_key=True, index=True, comment="分配ID")
    
    # 关联信息
    patient_id = Column(
        Integer,
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        comment="患者ID"
    )
    
    command_id = Column(
        String(36),
        ForeignKey("commands.id", ondelete="CASCADE"),
        nullable=False,
        comment="指令ID"
    )
    
    variant_id = Column(
        Integer,
        ForeignKey("command_variants.id", ondelete="CASCADE"),
        nullable=False,
        comment="使用的变体ID"
    )
    
    # 分配信息
    assigned_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="分配人（医生）ID"
    )
    
    # 状态
    is_active = Column(Boolean, default=True, comment="是否激活")
    
    # 备注
    note = Column(
        Text,
        nullable=True,
        comment="分配备注"
    )
    
    # 时间戳
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="分配时间"
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间"
    )
    
    # 关系
    patient = relationship("Patient", back_populates="command_assignments")
    command = relationship("Command", back_populates="patient_assignments")
    variant = relationship("CommandVariant", back_populates="patient_assignments")
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])
    
    def __repr__(self) -> str:
        return f"<PatientCommandAssignment(id={self.id}, patient_id={self.patient_id}, command_id='{self.command_id}', variant_id={self.variant_id})>"


# 索引
Index(
    "idx_assignment_patient",
    PatientCommandAssignment.patient_id
)

Index(
    "idx_assignment_command",
    PatientCommandAssignment.command_id
)

Index(
    "idx_assignment_variant",
    PatientCommandAssignment.variant_id
)

Index(
    "idx_assignment_active",
    PatientCommandAssignment.is_active
)

# 唯一约束：一个患者不能重复分配同一个指令
Index(
    "idx_assignment_unique",
    PatientCommandAssignment.patient_id,
    PatientCommandAssignment.command_id,
    unique=True
)
