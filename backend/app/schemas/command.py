"""
指令相关的Pydantic模式 - 重新设计版本

定义指令库的输入输出格式（不绑定特定患者）
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.command_variant import CommandVariantWithDialectResponse


class CommandBase(BaseModel):
    """指令基础模式"""
    content: str = Field(..., min_length=1, max_length=500, description="指令内容明文")
    description: Optional[str] = Field(None, max_length=1000, description="指令描述或使用场景")


class CommandCreate(CommandBase):
    """创建指令模式"""
    is_template: bool = Field(default=False, description="是否为模板指令")


class CommandUpdate(BaseModel):
    """更新指令模式"""
    content: Optional[str] = Field(None, min_length=1, max_length=500, description="指令内容")
    description: Optional[str] = Field(None, max_length=1000, description="指令描述")
    is_active: Optional[bool] = Field(None, description="是否激活")
    is_template: Optional[bool] = Field(None, description="是否为系统模板（仅管理员可修改）")


class CommandResponse(BaseModel):
    """指令响应模式"""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    content: str
    description: Optional[str]
    doctor_id: int
    is_active: bool
    is_template: bool
    created_at: datetime
    updated_at: datetime


class CommandWithVariantsResponse(CommandResponse):
    """包含变体信息的指令响应"""
    variants: List['CommandVariantWithDialectResponse'] = Field(default=[], description="所有变体")
    variant_count: int = Field(default=0, description="变体数量")
    patient_assignment_count: int = Field(default=0, description="分配给患者的数量")


class CommandListResponse(BaseModel):
    """指令列表响应模式"""
    items: List[CommandResponse]
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页数量")
    pages: int = Field(..., description="总页数")


class DoctorCommandStats(BaseModel):
    """医生指令统计"""
    doctor_id: int
    doctor_name: str
    total_commands: int = Field(..., description="指令总数")
    active_commands: int = Field(..., description="激活指令数")
    template_commands: int = Field(..., description="模板指令数")
    total_variants: int = Field(..., description="变体总数")
    total_patients: int = Field(..., description="患者总数")
    total_assignments: int = Field(..., description="指令分配总数")

# 触发前向引用解析（使用模块命名空间）
CommandWithVariantsResponse.model_rebuild()