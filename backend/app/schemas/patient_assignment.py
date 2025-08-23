"""
患者指令分配相关的Pydantic模式

定义患者与指令变体绑定关系的输入输出格式
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class PatientAssignmentBase(BaseModel):
    """患者分配基础模式"""
    command_id: str = Field(..., description="指令ID")
    variant_id: int = Field(..., description="变体ID")
    note: Optional[str] = Field(None, max_length=500, description="分配备注")


class PatientAssignmentCreate(PatientAssignmentBase):
    """创建患者分配模式"""
    patient_id: int = Field(..., description="患者ID")


class PatientAssignmentUpdate(BaseModel):
    """更新患者分配模式"""
    variant_id: Optional[int] = Field(None, description="变体ID")
    is_active: Optional[bool] = Field(None, description="是否激活")
    note: Optional[str] = Field(None, max_length=500, description="分配备注")


class PatientAssignmentResponse(BaseModel):
    """患者分配响应模式"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    patient_id: int
    command_id: str
    variant_id: int
    assigned_by: Optional[int]
    is_active: bool
    note: Optional[str]
    created_at: datetime
    updated_at: datetime


class PatientAssignmentWithDetailsResponse(PatientAssignmentResponse):
    """包含详细信息的患者分配响应"""
    command_content: str = Field(..., description="指令内容")
    command_description: Optional[str] = Field(None, description="指令描述")
    dialect_label: str = Field(..., description="方言名称")
    speaker_name: str = Field(..., description="说话人姓名")
    audio_url: str = Field(..., description="音频URL")
    duration_ms: Optional[int] = Field(None, description="音频时长")


class BatchAssignmentCreate(BaseModel):
    """批量分配模式"""
    patient_id: int = Field(..., description="患者ID")
    assignments: List[PatientAssignmentBase] = Field(..., description="分配列表")


class BatchAssignmentResponse(BaseModel):
    """批量分配响应"""
    success_count: int = Field(..., description="成功数量")
    failed_count: int = Field(..., description="失败数量")
    assignments: List[PatientAssignmentResponse] = Field(default=[], description="成功的分配")
    errors: List[str] = Field(default=[], description="错误信息")
