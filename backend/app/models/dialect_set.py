"""
方言集模型

管理不同方言和语言变体
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class DialectSet(Base):
    """
    方言集表模型
    
    管理系统支持的方言和语言变体
    如：普通话(zh-cn)、粤语(zh-yue)、吴语(wu)等
    """
    __tablename__ = "dialect_sets"
    
    id = Column(Integer, primary_key=True, index=True, comment="方言集ID")
    key = Column(
        String(20), 
        unique=True, 
        nullable=False,
        comment="方言代码，如：zh-cn, zh-yue, wu, hak, en-us"
    )
    label = Column(String(100), nullable=False, comment="方言显示名称")
    notes = Column(Text, nullable=True, comment="方言说明")
    is_default = Column(Boolean, default=False, comment="是否为默认方言")
    
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
    variants = relationship("CommandVariant", back_populates="dialect_set")
    
    def __repr__(self) -> str:
        return f"<DialectSet(id={self.id}, key='{self.key}', label='{self.label}')>"
