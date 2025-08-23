"""
指令变体相关的Pydantic模式

定义指令变体数据的输入输出格式
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class CommandVariantBase(BaseModel):
    """指令变体基础模式"""
    audio_url: str = Field(..., description="音频文件URL")
    duration_ms: Optional[int] = Field(None, description="音频时长（毫秒）")
    speaker_name: str = Field(..., max_length=100, description="说话人姓名")
    speaker_note: Optional[str] = Field(None, max_length=500, description="说话人备注")
    is_active: bool = Field(default=True, description="是否激活")


class CommandVariantCreate(CommandVariantBase):
    """创建指令变体模式"""
    dialect_set_id: int = Field(..., description="方言集ID")


class CommandVariantUpdate(BaseModel):
    """更新指令变体模式"""
    audio_url: Optional[str] = Field(None, description="音频文件URL")
    duration_ms: Optional[int] = Field(None, description="音频时长（毫秒）")
    speaker_name: Optional[str] = Field(None, max_length=100, description="说话人姓名")
    speaker_note: Optional[str] = Field(None, max_length=500, description="说话人备注")
    is_active: Optional[bool] = Field(None, description="是否激活")


class CommandVariantResponse(CommandVariantBase):
    """指令变体响应模式"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    command_id: str
    dialect_set_id: int
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime


class DialectSetResponse(BaseModel):
    """方言集响应模式"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    key: str
    label: str
    notes: Optional[str]
    is_default: bool
    created_at: datetime


class CommandVariantWithDialectResponse(CommandVariantResponse):
    """包含方言信息的变体响应模式"""
    dialect_set: DialectSetResponse = Field(..., description="方言集信息")
