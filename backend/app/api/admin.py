"""
管理员API路由

处理系统管理功能：用户管理、系统设置、全局配置等
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.core.security import get_current_active_user, create_password_hash, require_admin
from app.models.user import User, UserRole
from app.models.dialect_set import DialectSet
from app.models.system_setting import SystemSetting
from app.models.command import Command
from app.models.command_variant import CommandVariant
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse, UserRole as SchemaUserRole
from app.schemas.command_variant import DialectSetResponse

router = APIRouter()
def build_user_response(user: User) -> UserResponse:
    """将ORM用户对象转换为API响应，规范化角色为小写字符串以兼容前端与Schema。"""
    return UserResponse(
        id=user.id,
        username=user.username,
        role=SchemaUserRole(user.role.lower()),
        is_active=user.is_active,
        created_at=user.created_at,
    )


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


async def copy_template_commands_for_user(db: AsyncSession, user_id: int):
    """
    为新用户复制所有模板指令和变体
    
    Args:
        db: 数据库会话
        user_id: 新用户ID
    """
    # 查询所有模板指令
    template_commands_result = await db.execute(
        select(Command).filter(Command.is_template == True)
    )
    template_commands = template_commands_result.scalars().all()
    
    for template_command in template_commands:
        # 创建新的指令副本
        new_command = Command(
            content=template_command.content,
            description=template_command.description,
            doctor_id=user_id,
            is_active=True,
            is_template=False  # 新创建的指令不是模板
        )
        db.add(new_command)
        await db.flush()  # 获取新指令的ID
        
        # 复制该指令下的所有模板变体
        template_variants_result = await db.execute(
            select(CommandVariant).filter(
                CommandVariant.command_id == template_command.id,
                CommandVariant.is_template == True
            )
        )
        template_variants = template_variants_result.scalars().all()
        
        for template_variant in template_variants:
            new_variant = CommandVariant(
                command_id=new_command.id,
                dialect_set_id=template_variant.dialect_set_id,
                audio_url=template_variant.audio_url,
                duration_ms=template_variant.duration_ms,
                speaker_name=template_variant.speaker_name,
                speaker_note=template_variant.speaker_note,
                created_by=user_id,
                is_active=True,
                is_template=False  # 新创建的变体不是模板
            )
            db.add(new_variant)


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
        # role 为 schemas.UserRole，数据库存储为大写
        query = query.filter(User.role == role.value.upper())
    
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
        items=[build_user_response(user) for user in users],
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
        role=user_data.role.value.upper(),
        is_active=user_data.is_active,
        full_name=user_data.full_name,
        department=user_data.department
    )
    
    db.add(user)
    await db.flush()  # 获取用户ID
    
    # 为新用户复制模板指令和变体
    await copy_template_commands_for_user(db, user.id)
    
    await db.commit()
    await db.refresh(user)
    
    return build_user_response(user)


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
    # 规范化角色为大写存储
    if "role" in update_data and update_data["role"] is not None:
        update_data["role"] = update_data["role"].upper() if isinstance(update_data["role"], str) else update_data["role"].value.upper()
    
    # 处理密码更新
    if "password" in update_data:
        update_data["password_hash"] = create_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    return build_user_response(user)


@router.put("/users/{user_id}/toggle-status", summary="切换用户状态")
async def toggle_user_status(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    启用/禁用用户（仅管理员）
    """
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 不能禁用自己
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能禁用自己的账户"
        )
    
    user.is_active = not user.is_active
    await db.commit()
    
    return {
        "message": f"用户已{'启用' if user.is_active else '禁用'}",
        "user_id": user.id,
        "is_active": user.is_active
    }


@router.put("/users/{user_id}/reset-password", summary="重置用户密码")
async def reset_user_password(
    user_id: int,
    password_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    重置用户密码（仅管理员）
    """
    new_password = password_data.get("password")
    if not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="新密码不能为空"
        )
    
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    user.password_hash = create_password_hash(new_password)
    await db.commit()
    
    return {"message": "密码已重置"}


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


@router.delete("/dialect-sets/{dialect_id}", summary="删除方言集")
async def delete_dialect_set(
    dialect_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    删除方言集（仅管理员）
    """
    result = await db.execute(select(DialectSet).filter(DialectSet.id == dialect_id))
    dialect_set = result.scalar_one_or_none()
    
    if not dialect_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="方言集不存在"
        )
    
    # 检查是否有关联的变体
    variants_result = await db.execute(
        select(CommandVariant).filter(CommandVariant.dialect_set_id == dialect_id)
    )
    if variants_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该方言集下有关联的指令变体，无法删除"
        )
    
    await db.delete(dialect_set)
    await db.commit()
    
    return {"message": "方言集已删除"}


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


# 审计日志管理
@router.get("/audit-logs", summary="获取审计日志")
async def get_audit_logs(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    action: Optional[str] = Query(None, description="操作类型过滤"),
    entity: Optional[str] = Query(None, description="实体类型过滤"),
    user_id: Optional[int] = Query(None, description="用户ID过滤"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    获取审计日志（仅管理员）
    """
    from app.models.audit_log import AuditLog
    
    query = select(AuditLog)
    
    # 过滤条件
    if action:
        query = query.filter(AuditLog.action == action)
    if entity:
        query = query.filter(AuditLog.entity == entity)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    
    # 计算总数
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar()
    
    # 分页查询
    query = query.order_by(desc(AuditLog.created_at))
    query = query.offset((page - 1) * size).limit(size)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    pages = (total + size - 1) // size
    
    return {
        "items": [
            {
                "id": log.id,
                "action": log.action,
                "entity": log.entity,
                "entity_id": log.entity_id,
                "payload": log.payload,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "user_id": log.user_id,
                "created_at": log.created_at.isoformat() if log.created_at else None
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }

