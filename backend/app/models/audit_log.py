"""
审计日志模型

记录系统操作日志，用于审计和追踪
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class AuditLog(Base):
    """
    审计日志表模型
    
    记录用户操作日志，仅包含command_key等非敏感信息
    不记录明文指令内容
    """
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True, comment="日志ID")
    action = Column(String(50), nullable=False, comment="操作类型")
    entity = Column(String(50), nullable=False, comment="操作实体")
    entity_id = Column(String(100), nullable=True, comment="实体ID")
    payload = Column(
        JSON, 
        nullable=True, 
        comment="操作载荷（仅含command_key等非敏感信息）"
    )
    ip_address = Column(String(45), nullable=True, comment="客户端IP地址")
    user_agent = Column(Text, nullable=True, comment="用户代理")
    
    # 外键关联
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="操作用户ID"
    )
    
    # 时间戳
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="创建时间"
    )
    
    # 关系
    user = relationship("User", back_populates=None)
    
    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action='{self.action}', entity='{self.entity}', user_id={self.user_id})>"
