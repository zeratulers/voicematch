"""
指令管理API路由 - 重新设计版本

处理指令库的CRUD操作（不绑定特定患者）
"""

from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, case
from sqlalchemy.orm import selectinload
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.command import Command
from app.models.command_variant import CommandVariant
from app.models.patient import Patient
from app.models.patient_command_assignment import PatientCommandAssignment
from app.schemas.command import (
    CommandCreate,
    CommandUpdate,
    CommandResponse,
    CommandListResponse,
    CommandWithVariantsResponse,
    DoctorCommandStats
)
from app.schemas.patient import PatientOverview, Gender as SchemaGender

router = APIRouter()


@router.get("", response_model=CommandListResponse, summary="获取指令列表")
async def get_commands(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    is_active: Optional[bool] = Query(None, description="是否激活过滤"),
    is_template: Optional[bool] = Query(None, description="是否模板过滤"),
    search: Optional[str] = Query(None, description="搜索关键词（指令内容）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取指令列表，支持分页、过滤和搜索
    """
    # 构建查询
    query = select(Command)
    
    # 权限控制：普通医生只能看到自己创建的指令和模板指令
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if str(current_role).lower() != "admin":
        query = query.filter(
            or_(
                Command.doctor_id == current_user.id,
                Command.is_template == True
            )
        )
    
    # 激活状态过滤
    if is_active is not None:
        query = query.filter(Command.is_active == is_active)
    
    # 模板过滤
    if is_template is not None:
        query = query.filter(Command.is_template == is_template)
    
    # 搜索过滤
    if search:
        query = query.filter(Command.content.like(f"%{search}%"))
    
    # 计算总数
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar()
    
    # 分页查询
    query = query.order_by(desc(Command.created_at))
    query = query.offset((page - 1) * size).limit(size)
    
    result = await db.execute(query)
    commands = result.scalars().all()
    
    # 计算总页数
    pages = (total + size - 1) // size
    
    return CommandListResponse(
        items=[CommandResponse.model_validate(command) for command in commands],
        total=total,
        page=page,
        size=size,
        pages=pages
    )


@router.post("", response_model=CommandResponse, summary="创建指令")
async def create_command(
    command_data: CommandCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    创建新指令（加入指令库）
    """
    # 检查是否已存在相同内容的指令
    existing_query = select(Command).filter(
        Command.doctor_id == current_user.id,
        Command.content == command_data.content,
        Command.is_active == True
    )
    result = await db.execute(existing_query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="您已经创建了相同内容的指令"
        )
    
    # 只有管理员可以创建模板指令
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if command_data.is_template and str(current_role).lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有管理员可以创建模板指令"
        )
    
    command = Command(
        content=command_data.content,
        description=command_data.description,
        doctor_id=current_user.id,
        is_template=command_data.is_template
    )
    
    db.add(command)
    await db.commit()
    await db.refresh(command)
    
    return CommandResponse.model_validate(command)


@router.get("/{command_id}", response_model=CommandWithVariantsResponse, summary="获取指令详情")
async def get_command(
    command_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取指令详细信息，包含所有变体和分配统计
    """
    query = select(Command).options(
        selectinload(Command.variants).selectinload(CommandVariant.dialect_set)
    ).filter(Command.id == command_id)
    
    # 权限控制
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if str(current_role).lower() != "admin":
        query = query.filter(
            or_(
                Command.doctor_id == current_user.id,
                Command.is_template == True
            )
        )
    
    result = await db.execute(query)
    command = result.scalar_one_or_none()
    
    if not command:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指令不存在或无权访问"
        )
    
    # 统计分配给患者的数量
    assignment_count_result = await db.execute(
        select(func.count(PatientCommandAssignment.id))
        .filter(PatientCommandAssignment.command_id == command_id)
    )
    assignment_count = assignment_count_result.scalar() or 0
    
    from app.schemas.command_variant import CommandVariantWithDialectResponse
    
    return CommandWithVariantsResponse(
        **CommandResponse.model_validate(command).model_dump(),
        variants=[
            CommandVariantWithDialectResponse.model_validate(v) for v in command.variants
        ],
        variant_count=len(command.variants),
        patient_assignment_count=assignment_count
    )


@router.put("/{command_id}", response_model=CommandResponse, summary="更新指令")
async def update_command(
    command_id: str,
    command_data: CommandUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    更新指令信息
    """
    query = select(Command).filter(Command.id == command_id)
    
    # 权限控制：只能修改自己创建的指令或管理员修改模板
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if str(current_role).lower() != "admin":
        query = query.filter(Command.doctor_id == current_user.id)
    
    result = await db.execute(query)
    command = result.scalar_one_or_none()
    
    if not command:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指令不存在或无权访问"
        )
    
    # 更新字段（仅管理员可修改 is_template）
    update_data = command_data.model_dump(exclude_unset=True)
    for field, value in list(update_data.items()):
        if field == 'is_template':
            if str(current_role).lower() != 'admin':
                update_data.pop('is_template')
                continue
        setattr(command, field, value)
    
    await db.commit()
    await db.refresh(command)
    
    return CommandResponse.model_validate(command)


@router.delete("/{command_id}", summary="删除指令（管理员可删除模板）")
async def delete_command(
    command_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    删除指令（真删除）
    """
    query = select(Command).filter(Command.id == command_id)
    
    # 权限控制
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if str(current_role).lower() != "admin":
        query = query.filter(Command.doctor_id == current_user.id)
    
    result = await db.execute(query)
    command = result.scalar_one_or_none()
    
    if not command:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指令不存在或无权访问"
        )
    
    # 模板删除：仅管理员允许
    if command.is_template and str(current_role).lower() != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有管理员可以删除模板指令"
        )
    
    # 检查是否有患者正在使用此指令
    from app.models.patient_command_assignment import PatientCommandAssignment
    assignment_result = await db.execute(
        select(PatientCommandAssignment).filter(PatientCommandAssignment.command_id == command_id)
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
            detail=f"该指令正在被以下患者使用，无法删除：{patient_list}"
        )
    
    # 真删除：从数据库中删除
    await db.delete(command)
    await db.commit()
    
    return {"message": "指令已永久删除"}


@router.get("/stats/doctor", response_model=DoctorCommandStats, summary="获取医生指令统计")
async def get_doctor_command_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取当前医生的指令统计信息
    """
    # 获取指令统计
    commands_result = await db.execute(
        select(
            func.count(Command.id).label('total'),
            func.coalesce(func.sum(case((Command.is_active == True, 1), else_=0)), 0).label('active'),
            func.coalesce(func.sum(case((Command.is_template == True, 1), else_=0)), 0).label('template')
        ).filter(
            or_(
                Command.doctor_id == current_user.id,
                Command.is_template == True
            ) if (str((current_user.role.value if hasattr(current_user.role, "value") else current_user.role)).lower() != "admin") else True
        )
    )
    commands_stats = commands_result.first()
    
    # 获取变体统计
    variants_result = await db.execute(
        select(func.count(CommandVariant.id))
        .select_from(CommandVariant)
        .join(Command, CommandVariant.command_id == Command.id)
        .filter(
            or_(
                Command.doctor_id == current_user.id,
                Command.is_template == True
            ) if (str((current_user.role.value if hasattr(current_user.role, "value") else current_user.role)).lower() != "admin") else True
        )
    )
    total_variants = variants_result.scalar() or 0
    
    # 获取患者数量
    patients_result = await db.execute(
        select(func.count(Patient.id)).filter(Patient.doctor_id == current_user.id)
    )
    total_patients = patients_result.scalar() or 0
    
    # 获取分配数量
    assignments_result = await db.execute(
        select(func.count(PatientCommandAssignment.id))
        .filter(PatientCommandAssignment.assigned_by == current_user.id)
    )
    total_assignments = assignments_result.scalar() or 0
    
    return DoctorCommandStats(
        doctor_id=current_user.id,
        doctor_name=current_user.full_name or current_user.username,
        total_commands=commands_stats.total or 0,
        active_commands=commands_stats.active or 0,
        template_commands=commands_stats.template or 0,
        total_variants=total_variants,
        total_patients=total_patients,
        total_assignments=total_assignments
    )


@router.get("/stats/doctor/recent-patients", response_model=List[PatientOverview], summary="获取医生最近操作的患者")
async def get_recent_patients_for_doctor(
    limit: int = 3,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    返回当前医生最近操作过（在分配表中有记录）的患者，默认3个；并附带每个患者的指令分配数量
    """
    # 最近操作的患者ID，按分配更新时间倒序
    recent_q = (
        select(
            PatientCommandAssignment.patient_id,
            func.max(PatientCommandAssignment.updated_at).label("last_time")
        )
        .filter(PatientCommandAssignment.assigned_by == current_user.id)
        .group_by(PatientCommandAssignment.patient_id)
        .order_by(desc("last_time"))
        .limit(limit)
    )

    recent_rows = (await db.execute(recent_q)).all()
    patient_ids = [row.patient_id for row in recent_rows]
    if not patient_ids:
        return []

    # 患者信息
    patients_map = {
        p.id: p for p in (await db.execute(select(Patient).filter(Patient.id.in_(patient_ids)))).scalars().all()
    }

    # 统计每个患者的指令分配数量
    counts_map = {
        pid: cnt for pid, cnt in (
            await db.execute(
                select(
                    PatientCommandAssignment.patient_id,
                    func.count(PatientCommandAssignment.id)
                )
                .filter(
                    PatientCommandAssignment.assigned_by == current_user.id,
                    PatientCommandAssignment.patient_id.in_(patient_ids)
                )
                .group_by(PatientCommandAssignment.patient_id)
            )
        ).all()
    }

    # 保持最近顺序
    overviews: List[PatientOverview] = []
    for row in recent_rows:
        p = patients_map.get(row.patient_id)
        if not p:
            continue
        gender_value = p.gender.value if hasattr(p.gender, "value") else p.gender
        overviews.append(PatientOverview(
            id=p.id,
            name=p.name,
            gender=SchemaGender(gender_value),
            total_commands=counts_map.get(p.id, 0)
        ))

    return overviews