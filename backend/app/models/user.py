"""
用户模型 - 重新设计版本

支持医生和管理员两种角色的用户管理，医生可以有多个患者和指令
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum

from app.core.database import Base


class UserRole(PyEnum):
    """用户角色枚举"""
    ADMIN = "admin"
    DOCTOR = "doctor"


class User(Base):
    """
    用户表模型 - 重新设计
    
    存储系统用户信息，医生可以管理患者和指令
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, comment="用户ID")
    username = Column(
        String(50), 
        unique=True, 
        index=True, 
        nullable=False,
        comment="用户名"
    )
    password_hash = Column(String(255), nullable=False, comment="密码哈希")
    role = Column(
        Enum(UserRole), 
        nullable=False, 
        default=UserRole.DOCTOR,
        comment="用户角色：admin或doctor"
    )
    is_active = Column(Boolean, default=True, comment="是否激活")
    
    # 医生个人信息
    full_name = Column(String(100), nullable=True, comment="医生真实姓名")
    department = Column(String(100), nullable=True, comment="科室")
    
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
    
    # 关系 - 医生管理的患者
    patients = relationship(
        "Patient", 
        back_populates="doctor",
        cascade="all, delete-orphan"
    )
    
    # 关系 - 医生创建的指令  
    commands = relationship(
        "Command", 
        back_populates="doctor",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"
