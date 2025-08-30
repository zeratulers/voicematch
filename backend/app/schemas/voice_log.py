"""
语音识别日志相关的Pydantic模型
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class VoiceLogBase(BaseModel):
    """语音日志基础模型"""
    transcript: str = Field(..., description="识别的文本内容")
    confidence: float = Field(..., ge=0, le=1, description="识别置信度 (0-1)")
    status: str = Field(..., description="识别状态: success, no_match, error, aborted")
    matched_command_id: Optional[str] = Field(None, description="匹配到的指令ID")
    matched_command_content: Optional[str] = Field(None, description="匹配到的指令内容")
    matched_confidence: Optional[float] = Field(None, ge=0, le=1, description="指令匹配置信度")
    processing_time_ms: Optional[int] = Field(None, ge=0, description="处理时间(毫秒)")


class VoiceLogCreate(VoiceLogBase):
    """创建语音日志"""
    pass


class VoiceLogUpdate(BaseModel):
    """更新语音日志"""
    transcript: Optional[str] = None
    confidence: Optional[float] = None
    status: Optional[str] = None
    matched_command_id: Optional[str] = None
    matched_command_content: Optional[str] = None
    matched_confidence: Optional[float] = None
    processing_time_ms: Optional[int] = None


class VoiceLogResponse(VoiceLogBase):
    """语音日志响应模型"""
    id: int
    patient_id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class VoiceLogWithDetails(VoiceLogResponse):
    """带详细信息的语音日志"""
    patient_name: Optional[str] = None
    user_name: Optional[str] = None


class VoiceLogUploadRequest(BaseModel):
    """批量上传语音日志请求"""
    patient_id: int = Field(..., description="患者ID")
    logs: List[VoiceLogCreate] = Field(..., description="语音日志列表")


class VoiceLogUploadResponse(BaseModel):
    """批量上传语音日志响应"""
    message: str
    uploaded_count: int
    failed_count: int = 0
    errors: List[str] = []


class VoiceLogListResponse(BaseModel):
    """语音日志列表响应"""
    logs: List[VoiceLogResponse]
    total: int
    page: int
    size: int
    pages: int
