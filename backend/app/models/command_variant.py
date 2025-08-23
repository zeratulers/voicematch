"""
指令变体模型 - 重新设计版本

存储指令的不同方言音频变体
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class CommandVariant(Base):
    """
    指令变体表模型 - 重新设计
    
    存储指令的不同方言音频变体，每个指令可以有多个变体
    """
    __tablename__ = "command_variants"
    
    id = Column(Integer, primary_key=True, index=True, comment="变体ID")
    
    # 关联信息
    command_id = Column(
        String(36),
        ForeignKey("commands.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属指令ID"
    )
    
    dialect_set_id = Column(
        Integer,
        ForeignKey("dialect_sets.id", ondelete="RESTRICT"),
        nullable=False,
        comment="方言类型ID"
    )
    
    # 音频信息
    audio_url = Column(
        String(500), 
        nullable=False,
        comment="音频文件URL或路径"
    )
    
    duration_ms = Column(
        Integer,
        nullable=True,
        comment="音频时长（毫秒）"
    )
    
    # 说话人信息
    speaker_name = Column(
        String(100),
        nullable=True,
        comment="说话人姓名"
    )
    
    speaker_note = Column(
        Text,
        nullable=True,
        comment="说话人备注，如'女声，温柔语调'"
    )
    
    # 创建信息
    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="创建人ID（通常是医生）"
    )
    
    # 状态
    is_active = Column(Boolean, default=True, comment="是否可用")
    
    # 是否为模板（管理员创建的默认变体）
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
    command = relationship("Command", back_populates="variants")
    dialect_set = relationship("DialectSet", back_populates="variants")
    creator = relationship("User", foreign_keys=[created_by])
    
    # 患者分配记录
    patient_assignments = relationship(
        "PatientCommandAssignment",
        back_populates="variant",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<CommandVariant(id={self.id}, command_id='{self.command_id}', dialect='{self.dialect_set_id}')>"


# 索引
Index(
    "idx_variant_command",
    CommandVariant.command_id
)

Index(
    "idx_variant_dialect",
    CommandVariant.dialect_set_id
)

Index(
    "idx_variant_template",
    CommandVariant.is_template
)

# 唯一约束：一个指令在同一方言下相同说话人只能有一个变体
Index(
    "idx_variant_speaker_unique",
    CommandVariant.command_id,
    CommandVariant.dialect_set_id,
    CommandVariant.speaker_name,
    unique=True
)