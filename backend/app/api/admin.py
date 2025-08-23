"""
管理员API路由

处理系统管理功能：用户管理、系统设置、全局配置等
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_active_user, create_password_hash, require_admin
from app.models.user import User, UserRole
from app.models.dialect_set import DialectSet
from app.models.system_setting import SystemSetting
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.schemas.command_variant import DialectSetResponse

router = APIRouter()


class DialectSetCreate(BaseModel):
    """创建方言集请求"""
    key: str
    label: str
    notes: Optional[str] = None
    is_default: bool = False


class DialectSetUpdate(BaseModel):
    """更新方言集请求"""
    label: Optional[str] = None
    notes: Optional[str] = None
    is_default: Optional[bool] = None


class SystemSettingRequest(BaseModel):
    """系统设置请求"""
    key: str
    value: str
    description: Optional[str] = None
    is_sensitive: bool = False


class SystemSettingResponse(BaseModel):
    """系统设置响应"""
    key: str
    value: str
    description: Optional[str]
    is_sensitive: bool


class UserListResponse(BaseModel):
    """用户列表响应"""
    items: List[UserResponse]
    total: int
    page: int
    size: int
    pages: int


# 用户管理
@router.get("/users", response_model=UserListResponse, summary="获取用户列表")
async def get_users(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    role: Optional[UserRole] = Query(None, description="角色过滤"),
    is_active: Optional[bool] = Query(None, description="激活状态过滤"),
    search: Optional[str] = Query(None, description="搜索用户名"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    获取用户列表（仅管理员）
    """
    query = select(User)
    
    # 角色过滤
    if role:
        query = query.filter(User.role == role)
    
    # 激活状态过滤
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    # 搜索过滤
    if search:
        query = query.filter(User.username.like(f"%{search}%"))
    
    # 计算总数
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar()
    
    # 分页查询
    query = query.order_by(desc(User.created_at))
    query = query.offset((page - 1) * size).limit(size)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    pages = (total + size - 1) // size
    
    return UserListResponse(
        items=[UserResponse.model_validate(user) for user in users],
        total=total,
        page=page,
        size=size,
        pages=pages
    )


@router.post("/users", response_model=UserResponse, summary="创建用户")
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    创建新用户（仅管理员）
    """
    # 检查用户名是否已存在
    existing_result = await db.execute(
        select(User).filter(User.username == user_data.username)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 创建用户
    user = User(
        username=user_data.username,
        password_hash=create_password_hash(user_data.password),
        role=user_data.role,
        is_active=user_data.is_active
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}", response_model=UserResponse, summary="更新用户")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    更新用户信息（仅管理员）
    """
    # 查询用户
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 检查用户名唯一性
    if user_data.username and user_data.username != user.username:
        existing_result = await db.execute(
            select(User).filter(User.username == user_data.username)
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名已存在"
            )
    
    # 更新字段
    update_data = user_data.model_dump(exclude_unset=True)
    
    # 处理密码更新
    if "password" in update_data:
        update_data["password_hash"] = create_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse.model_validate(user)


# 方言集管理
@router.get("/dialect-sets", response_model=List[DialectSetResponse], summary="获取方言集列表")
async def get_dialect_sets_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    获取所有方言集（管理员视图）
    """
    result = await db.execute(
        select(DialectSet).order_by(DialectSet.is_default.desc(), DialectSet.label)
    )
    dialect_sets = result.scalars().all()
    
    return [DialectSetResponse.model_validate(ds) for ds in dialect_sets]


@router.post("/dialect-sets", response_model=DialectSetResponse, summary="创建方言集")
async def create_dialect_set(
    dialect_data: DialectSetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    创建新方言集（仅管理员）
    """
    # 检查key是否已存在
    existing_result = await db.execute(
        select(DialectSet).filter(DialectSet.key == dialect_data.key)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="方言代码已存在"
        )
    
    # 如果设置为默认方言，取消其他默认设置
    if dialect_data.is_default:
        await db.execute(
            select(DialectSet).filter(DialectSet.is_default == True)
        )
        # 更新所有现有默认方言为非默认
        existing_defaults = await db.execute(
            select(DialectSet).filter(DialectSet.is_default == True)
        )
        for default_dialect in existing_defaults.scalars():
            default_dialect.is_default = False
    
    dialect_set = DialectSet(**dialect_data.model_dump())
    db.add(dialect_set)
    await db.commit()
    await db.refresh(dialect_set)
    
    return DialectSetResponse.model_validate(dialect_set)


@router.put("/dialect-sets/{dialect_id}", response_model=DialectSetResponse, summary="更新方言集")
async def update_dialect_set(
    dialect_id: int,
    dialect_data: DialectSetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    更新方言集（仅管理员）
    """
    result = await db.execute(select(DialectSet).filter(DialectSet.id == dialect_id))
    dialect_set = result.scalar_one_or_none()
    
    if not dialect_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="方言集不存在"
        )
    
    # 如果设置为默认方言，取消其他默认设置
    if dialect_data.is_default:
        existing_defaults = await db.execute(
            select(DialectSet).filter(
                DialectSet.is_default == True,
                DialectSet.id != dialect_id
            )
        )
        for default_dialect in existing_defaults.scalars():
            default_dialect.is_default = False
    
    # 更新字段
    update_data = dialect_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dialect_set, field, value)
    
    await db.commit()
    await db.refresh(dialect_set)
    
    return DialectSetResponse.model_validate(dialect_set)


# 系统设置管理
@router.get("/settings", response_model=List[SystemSettingResponse], summary="获取系统设置")
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    获取所有系统设置（仅管理员）
    """
    result = await db.execute(select(SystemSetting).order_by(SystemSetting.key))
    settings = result.scalars().all()
    
    return [
        SystemSettingResponse(
            key=setting.key,
            value=setting.value if not setting.is_sensitive else "[HIDDEN]",
            description=setting.description,
            is_sensitive=setting.is_sensitive
        )
        for setting in settings
    ]


@router.put("/settings/{setting_key}", summary="更新系统设置")
async def update_system_setting(
    setting_key: str,
    setting_data: SystemSettingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    更新系统设置（仅管理员）
    """
    result = await db.execute(select(SystemSetting).filter(SystemSetting.key == setting_key))
    setting = result.scalar_one_or_none()
    
    if not setting:
        # 创建新设置
        setting = SystemSetting(
            key=setting_data.key,
            value=setting_data.value,
            description=setting_data.description,
            is_sensitive=setting_data.is_sensitive
        )
        db.add(setting)
    else:
        # 更新现有设置
        setting.value = setting_data.value
        if setting_data.description is not None:
            setting.description = setting_data.description
        setting.is_sensitive = setting_data.is_sensitive
    
    await db.commit()
    
    return {"message": "系统设置已更新"}

