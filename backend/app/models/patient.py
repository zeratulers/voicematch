"""
患者模型 - 重新设计版本

存储患者基本信息，每个患者有对应的医生和多个指令
"""

from sqlalchemy import Column, Integer, String, Date, Text, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum

from app.core.database import Base


class Gender(PyEnum):
    """性别枚举"""
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class Patient(Base):
    """
    患者表模型 - 重新设计
    
    存储患者基本信息，每个患者归属于特定医生，有多个专属指令
    """
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True, comment="患者ID")
    name = Column(String(100), nullable=False, comment="患者姓名")
    gender = Column(
        Enum(Gender), 
        nullable=False,
        comment="性别：M=男，F=女，Other=其他"
    )
    date_of_birth = Column(Date, nullable=True, comment="出生日期")
    note = Column(Text, nullable=True, comment="备注信息，如语言偏好、特殊需求等")
    
    # 关联医生
    doctor_id = Column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="负责医生ID"
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
    doctor = relationship("User", back_populates="patients")
    
    # 指令分配记录
    command_assignments = relationship(
        "PatientCommandAssignment",
        back_populates="patient",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Patient(id={self.id}, name='{self.name}', doctor_id={self.doctor_id})>"