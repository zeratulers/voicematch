"""
认证API路由

处理用户登录、注册、令牌刷新等认证相关操作
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import (
    create_access_token, 
    create_refresh_token,
    create_password_hash,
    verify_password,
    verify_token,
    get_current_user
)
from app.models.user import User
from app.schemas.user import (
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
    UserRole as SchemaUserRole,
)

router = APIRouter()
@router.post("/change-password", summary="用户修改自己的密码")
async def change_password(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    当前登录用户修改自己的密码
    Body: { "old_password": str, "new_password": str }
    """
    old_password = payload.get("old_password")
    new_password = payload.get("new_password")
    if not old_password or not new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="参数不完整")

    # 校验旧密码
    if not verify_password(old_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="旧密码不正确")

    # 更新新密码
    current_user.password_hash = create_password_hash(new_password)
    await db.commit()

    return {"message": "密码修改成功"}


def build_user_response(user: User) -> UserResponse:
    """将ORM用户对象转换为API响应，规范化角色为小写（Schema期望'admin'/'doctor'）。"""
    role_lower = str(user.role).lower() if user.role is not None else "doctor"
    return UserResponse(
        id=user.id,
        username=user.username,
        role=SchemaUserRole(role_lower),
        is_active=user.is_active,
        created_at=user.created_at,
    )

@router.post("/login", response_model=LoginResponse, summary="用户登录")
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    用户登录接口
    
    验证用户名密码，返回访问令牌和刷新令牌
    """
    # 查询用户
    result = await db.execute(
        select(User).filter(User.username == login_data.username)
    )
    user = result.scalar_one_or_none()
    
    # 验证用户和密码
    if not user or not verify_password(login_data.password, user.password_hash):
        # 返回401，前端已有针对性提示
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    if not user.is_active:
        # 返回401，前端已有针对性提示
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户未激活"
        )
    
    # 创建令牌
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=build_user_response(user),
    )


@router.post("/refresh", response_model=TokenResponse, summary="刷新访问令牌")
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    刷新访问令牌
    
    使用有效的刷新令牌获取新的访问令牌
    """
    # 验证刷新令牌
    payload = verify_token(refresh_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的刷新令牌"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌格式错误"
        )
    
    # 验证用户是否存在且激活
    result = await db.execute(select(User).filter(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或未激活"
        )
    
    # 创建新的访问令牌
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserResponse, summary="获取当前用户信息")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """
    获取当前登录用户的信息
    """
    return build_user_response(current_user)


@router.post("/logout", summary="用户登出")
async def logout():
    """
    用户登出
    
    注意：由于JWT是无状态的，实际的登出需要在客户端删除令牌
    """
    return {"message": "登出成功"}
