"""
用户相关的Pydantic模式

定义用户数据的输入输出格式
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    """用户角色枚举"""
    ADMIN = "admin"
    DOCTOR = "doctor"


class UserBase(BaseModel):
    """用户基础模式"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    role: UserRole = Field(default=UserRole.DOCTOR, description="用户角色")
    is_active: bool = Field(default=True, description="是否激活")


class UserCreate(UserBase):
    """创建用户模式"""
    password: str = Field(..., min_length=6, max_length=128, description="密码")


class UserUpdate(BaseModel):
    """更新用户模式"""
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="用户名")
    password: Optional[str] = Field(None, min_length=6, max_length=128, description="新密码")
    role: Optional[UserRole] = Field(None, description="用户角色")
    is_active: Optional[bool] = Field(None, description="是否激活")


class UserInDB(UserBase):
    """数据库中的用户模式"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    updated_at: datetime


class UserResponse(UserBase):
    """用户响应模式"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime


class LoginRequest(BaseModel):
    """登录请求模式"""
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")


class LoginResponse(BaseModel):
    """登录响应模式"""
    access_token: str = Field(..., description="访问令牌")
    refresh_token: str = Field(..., description="刷新令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
    user: UserResponse = Field(..., description="用户信息")


class RefreshTokenRequest(BaseModel):
    """刷新令牌请求模式"""
    refresh_token: str = Field(..., description="刷新令牌")


class TokenResponse(BaseModel):
    """令牌响应模式"""
    access_token: str = Field(..., description="访问令牌")
    token_type: str = Field(default="bearer", description="令牌类型")


class UserListResponse(BaseModel):
    """用户列表响应模式"""
    users: List[UserResponse] = Field(..., description="用户列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")