"""
系统设置模型

存储系统配置参数
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class SystemSetting(Base):
    """
    系统设置表模型
    
    存储系统配置参数，如存储后端、保留期限等
    """
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True, comment="设置ID")
    key = Column(String(100), unique=True, nullable=False, comment="设置键")
    value = Column(Text, nullable=True, comment="设置值")
    description = Column(Text, nullable=True, comment="设置描述")
    is_sensitive = Column(Boolean, default=False, comment="是否为敏感信息")
    
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
    
    def __repr__(self) -> str:
        return f"<SystemSetting(key='{self.key}', value='{self.value if not self.is_sensitive else '[HIDDEN]'}')>"
