"""
患者相关的Pydantic模式 - 重新设计版本

定义患者数据的输入输出格式
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class Gender(str, Enum):
    """性别枚举"""
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class PatientBase(BaseModel):
    """患者基础模式"""
    name: str = Field(..., min_length=1, max_length=100, description="患者姓名")
    gender: Gender = Field(..., description="性别")
    date_of_birth: Optional[date] = Field(None, description="出生日期")
    note: Optional[str] = Field(None, max_length=1000, description="备注信息")


class PatientCreate(PatientBase):
    """创建患者模式"""
    pass  # 医生ID会从当前登录用户获取


class PatientUpdate(BaseModel):
    """更新患者模式"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="患者姓名")
    gender: Optional[Gender] = Field(None, description="性别")
    date_of_birth: Optional[date] = Field(None, description="出生日期")
    note: Optional[str] = Field(None, max_length=1000, description="备注信息")


class PatientResponse(BaseModel):
    """患者响应模式"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    gender: Gender
    date_of_birth: Optional[date]
    note: Optional[str]
    doctor_id: int
    created_at: datetime
    updated_at: datetime


class PatientWithDoctorResponse(PatientResponse):
    """包含医生信息的患者响应"""
    doctor_name: str = Field(..., description="医生姓名")
    doctor_username: str = Field(..., description="医生用户名")
    department: Optional[str] = Field(None, description="科室")


class PatientWithAssignmentsResponse(PatientResponse):
    """包含分配信息的患者响应"""
    assignments: List[dict] = Field(default=[], description="患者的指令分配列表")
    total_assignments: int = Field(default=0, description="分配总数")
    active_assignments: int = Field(default=0, description="激活分配数")


class PatientListResponse(BaseModel):
    """患者列表响应模式"""
    items: List[PatientResponse]
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页数量")
    pages: int = Field(..., description="总页数")





class PatientStats(BaseModel):
    """患者统计信息"""
    id: int
    name: str
    gender: Gender
    total_commands: int = Field(..., description="指令总数")
    active_commands: int = Field(..., description="激活指令数")
    commands_with_variants: int = Field(..., description="有变体的指令数")
    last_command_created: Optional[datetime] = Field(None, description="最后指令创建时间")


class PatientOverview(BaseModel):
    """仪表盘患者概览（最近操作的患者）"""
    id: int
    name: str
    gender: Gender
    total_commands: int = Field(..., description="该医生为此患者已分配的指令数量")