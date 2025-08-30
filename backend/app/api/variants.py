"""
指令变体API路由 - 重新设计版本

处理指令变体的CRUD操作，适配新的数据库结构
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.command import Command
from app.models.command_variant import CommandVariant
from app.models.dialect_set import DialectSet
from app.models.patient import Patient
from app.schemas.command_variant import (
    CommandVariantCreate,
    CommandVariantUpdate,
    CommandVariantResponse,
    DialectSetResponse
)

router = APIRouter()


@router.get("/dialect-sets", response_model=List[DialectSetResponse], summary="获取方言集列表")
async def get_dialect_sets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取所有可用的方言集
    """
    result = await db.execute(
        select(DialectSet).order_by(DialectSet.is_default.desc(), DialectSet.label)
    )
    dialect_sets = result.scalars().all()
    
    return [DialectSetResponse.model_validate(ds) for ds in dialect_sets]


@router.get("/commands/{command_id}/variants", response_model=List[dict], summary="获取指令的所有变体")
async def get_command_variants(
    command_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取指定指令的所有变体
    """
    # 检查指令是否存在和权限
    command_result = await db.execute(
        select(Command).filter(Command.id == command_id)
    )
    command = command_result.scalar_one_or_none()
    
    if not command:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指令不存在"
        )
    
    # 权限检查
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if (str(current_role).lower() != "admin" and 
        command.doctor_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问此指令"
        )
    
    # 获取变体列表
    result = await db.execute(
        select(CommandVariant, DialectSet)
        .join(DialectSet, CommandVariant.dialect_set_id == DialectSet.id)
        .filter(CommandVariant.command_id == command_id)

        .order_by(DialectSet.is_default.desc(), DialectSet.label)
    )
    
    variants_with_dialects = result.all()
    
    return [
        {
            **CommandVariantResponse.model_validate(variant).model_dump(),
            "dialect_set": DialectSetResponse.model_validate(dialect_set).model_dump()
        }
        for variant, dialect_set in variants_with_dialects
    ]


@router.post("/commands/{command_id}/variants", response_model=CommandVariantResponse, summary="创建指令变体")
async def create_command_variant(
    command_id: str,
    variant_data: CommandVariantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    为指定指令创建新的变体
    """
    # 检查指令是否存在和权限
    command_result = await db.execute(
        select(Command).filter(Command.id == command_id)
    )
    command = command_result.scalar_one_or_none()
    
    if not command:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指令不存在"
        )
    
    # 权限检查：只能为自己创建的指令添加变体
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if (str(current_role).lower() != "admin" and 
        command.doctor_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只能为自己创建的指令添加变体"
        )
    
    # 检查方言集是否存在
    dialect_result = await db.execute(
        select(DialectSet).filter(DialectSet.id == variant_data.dialect_set_id)
    )
    if not dialect_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="方言集不存在"
        )
    
    # 检查是否已存在相同方言和说话人的变体
    existing_result = await db.execute(
        select(CommandVariant).filter(
            CommandVariant.command_id == command_id,
            CommandVariant.dialect_set_id == variant_data.dialect_set_id,
            CommandVariant.speaker_name == variant_data.speaker_name,
            CommandVariant.is_active == True
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该指令已存在相同方言和说话人的变体"
        )
    
    # 创建变体
    variant_dict = variant_data.model_dump()
    print(f"Creating variant with data: {variant_dict}")  # 调试日志
    
    variant = CommandVariant(
        command_id=command_id,
        created_by=current_user.id,
        **variant_dict
    )
    
    print(f"Variant object before save: duration_ms={variant.duration_ms}")  # 调试日志
    
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    
    print(f"Variant object after save: duration_ms={variant.duration_ms}")  # 调试日志
    
    return CommandVariantResponse.model_validate(variant)


@router.put("/variants/{variant_id}", response_model=CommandVariantResponse, summary="更新指令变体")
async def update_command_variant(
    variant_id: int,
    variant_data: CommandVariantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    更新指令变体信息
    """
    # 查询变体
    result = await db.execute(
        select(CommandVariant).filter(CommandVariant.id == variant_id)
    )
    variant = result.scalar_one_or_none()
    
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="变体不存在"
        )
    
    # 权限检查
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if (str(current_role).lower() != "admin" and 
        variant.created_by != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只能修改自己创建的变体"
        )
    
    # 更新字段（仅管理员可修改 is_template）
    update_data = variant_data.model_dump(exclude_unset=True)
    for field, value in list(update_data.items()):
        if field == 'is_template':
            if str(current_role).lower() != 'admin':
                update_data.pop('is_template')
                continue
        setattr(variant, field, value)
    
    await db.commit()
    await db.refresh(variant)
    
    return CommandVariantResponse.model_validate(variant)


@router.delete("/variants/{variant_id}", summary="删除指令变体")
async def delete_command_variant(
    variant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    删除指令变体（真删除）
    """
    # 查询变体
    result = await db.execute(
        select(CommandVariant).filter(CommandVariant.id == variant_id)
    )
    variant = result.scalar_one_or_none()
    
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="变体不存在"
        )
    
    # 权限检查
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if (str(current_role).lower() != "admin" and 
        variant.created_by != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只能删除自己创建的变体"
        )
    
    # 检查是否有患者正在使用此变体
    from app.models.patient_command_assignment import PatientCommandAssignment
    assignment_result = await db.execute(
        select(PatientCommandAssignment).filter(PatientCommandAssignment.variant_id == variant_id)
    )
    assignments = assignment_result.scalars().all()
    
    if assignments:
        # 获取患者信息
        patient_names = []
        for assignment in assignments:
            patient_result = await db.execute(
                select(Patient.name).filter(Patient.id == assignment.patient_id)
            )
            patient_name = patient_result.scalar()
            if patient_name:
                patient_names.append(patient_name)
        
        patient_list = "、".join(patient_names[:5])  # 最多显示5个患者
        if len(patient_names) > 5:
            patient_list += f"等{len(patient_names)}名患者"
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"该变体正在被以下患者使用，无法删除：{patient_list}"
        )
    
    # 真删除：从数据库中删除
    await db.delete(variant)
    await db.commit()
    
    return {"message": "变体已永久删除"}


@router.post("/variants/{variant_id}/set-active/{command_id}", summary="设置指令的激活变体")
async def set_active_variant(
    variant_id: int,
    command_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    将指定变体设置为指令的激活变体
    """
    # 检查指令权限
    command_result = await db.execute(
        select(Command).filter(Command.id == command_id)
    )
    command = command_result.scalar_one_or_none()
    
    if not command:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指令不存在"
        )
    
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if (str(current_role).lower() != "admin" and 
        command.doctor_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此指令"
        )
    
    # 检查变体是否存在并属于此指令
    variant_result = await db.execute(
        select(CommandVariant).filter(
            CommandVariant.id == variant_id,
            CommandVariant.command_id == command_id,
            CommandVariant.is_active == True
        )
    )
    variant = variant_result.scalar_one_or_none()
    
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="变体不存在或不属于此指令"
        )
    
    # 更新指令的激活变体
    command.active_variant_id = variant_id
    await db.commit()
    
    return {"message": f"已将变体 {variant_id} 设置为指令 {command_id} 的激活变体"}