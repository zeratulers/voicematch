"""
患者管理API路由 - 重新设计版本

处理患者的CRUD操作、指令管理等
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, date

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.patient import Patient, Gender
from app.models.command import Command
from app.models.command_variant import CommandVariant
from app.models.patient_command_assignment import PatientCommandAssignment
from app.models.dialect_set import DialectSet
from app.schemas.patient import (
    PatientCreate,
    PatientUpdate,
    PatientResponse,
    PatientListResponse,
    PatientWithAssignmentsResponse
)
from app.schemas.command import CommandResponse

router = APIRouter()


def _to_iso8601(value):
    """将 datetime/date/字符串 安全地转换为 ISO8601 字符串。"""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, str):
        # 尝试解析常见格式；失败则原样返回
        try:
            # 兼容结尾 Z 的UTC格式
            v = value.replace('Z', '+00:00')
            return datetime.fromisoformat(v).isoformat()
        except Exception:
            return value
    return str(value)

async def _auto_assign_active_commands(db: AsyncSession, patient_id: int, doctor_id: int):
    """
    自动为患者分配所有启用的指令的默认变体
    """
    # 获取所有启用的指令（医生自己的 + 模板指令）
    active_commands_result = await db.execute(
        select(Command).filter(
            Command.is_active == True,
            or_(
                Command.doctor_id == doctor_id,
                Command.is_template == True
            )
        )
    )
    active_commands = active_commands_result.scalars().all()
    
    # 为每个指令分配默认变体
    for command in active_commands:
        # 查找该指令的默认方言变体（优先选择默认方言）
        default_variant_result = await db.execute(
            select(CommandVariant)
            .join(DialectSet, CommandVariant.dialect_set_id == DialectSet.id)
            .filter(
                CommandVariant.command_id == command.id,
                CommandVariant.is_active == True
            )
            .order_by(DialectSet.is_default.desc(), CommandVariant.created_at)
            .limit(1)
        )
        default_variant = default_variant_result.scalar_one_or_none()
        
        if default_variant:
            # 检查是否已经分配过
            existing_assignment = await db.execute(
                select(PatientCommandAssignment).filter(
                    PatientCommandAssignment.patient_id == patient_id,
                    PatientCommandAssignment.command_id == command.id
                )
            )
            if not existing_assignment.scalar_one_or_none():
                # 创建分配记录
                assignment = PatientCommandAssignment(
                    patient_id=patient_id,
                    command_id=command.id,
                    variant_id=default_variant.id,
                    assigned_by=doctor_id,
                    note="自动分配"
                )
                db.add(assignment)
    
    await db.commit()


@router.get("", response_model=PatientListResponse, summary="获取患者列表")
async def get_patients(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（姓名）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取患者列表，支持分页和搜索
    """
    # 构建查询
    query = select(Patient)
    
    # 权限控制：普通医生只能看到自己的患者
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if str(current_role).lower() != "admin":
        query = query.filter(Patient.doctor_id == current_user.id)
    
    # 搜索过滤
    if search:
        query = query.filter(Patient.name.like(f"%{search}%"))
    
    # 计算总数
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar()
    
    # 分页查询
    query = query.order_by(desc(Patient.created_at))
    query = query.offset((page - 1) * size).limit(size)
    
    result = await db.execute(query)
    patients = result.scalars().all()
    
    # 计算总页数
    pages = (total + size - 1) // size
    
    return PatientListResponse(
        items=[PatientResponse.model_validate(patient) for patient in patients],
        total=total,
        page=page,
        size=size,
        pages=pages
    )


@router.post("", response_model=PatientResponse, summary="创建患者")
async def create_patient(
    patient_data: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    创建新患者
    """
    # 处理性别字段的兼容性
    patient_dict = patient_data.model_dump()
    if "gender" in patient_dict and isinstance(patient_dict["gender"], str):
        # 处理前端可能传来的旧值
        gender_mapping = {"M": "MALE", "F": "FEMALE", "Other": "OTHER"}
        if patient_dict["gender"] in gender_mapping:
            patient_dict["gender"] = Gender(gender_mapping[patient_dict["gender"]])
        else:
            patient_dict["gender"] = Gender(patient_dict["gender"])
    
    patient = Patient(
        **patient_dict,
        doctor_id=current_user.id  # 患者归属于当前医生
    )
    
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    
    # 自动分配启用的指令的默认变体
    await _auto_assign_active_commands(db, patient.id, current_user.id)
    
    return PatientResponse.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientWithAssignmentsResponse, summary="获取患者详情")
async def get_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取患者详细信息，包含所有指令分配
    """
    query = select(Patient).filter(Patient.id == patient_id)
    
    # 权限控制
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if str(current_role).lower() != "admin":
        query = query.filter(Patient.doctor_id == current_user.id)
    
    result = await db.execute(query)
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="患者不存在或无权访问"
        )
    
    # 获取患者的所有分配记录
    from app.models.patient_command_assignment import PatientCommandAssignment
    assignments_query = select(PatientCommandAssignment).options(
        selectinload(PatientCommandAssignment.command),
        selectinload(PatientCommandAssignment.variant)
    ).filter(PatientCommandAssignment.patient_id == patient_id).order_by(
        PatientCommandAssignment.created_at
    )
    
    assignments_result = await db.execute(assignments_query)
    assignments = assignments_result.scalars().all()
    
    # 统计信息
    total_assignments = len(assignments)
    active_assignments = len([a for a in assignments if a.is_active])
    
    return PatientWithAssignmentsResponse(
        **PatientResponse.model_validate(patient).model_dump(),
        assignments=[{
            "id": a.id,
            "command_id": a.command_id,
            "command_content": a.command.content,
            "variant_id": a.variant_id,
            "is_active": a.is_active,
            "created_at": _to_iso8601(a.created_at)
        } for a in assignments],
        total_assignments=total_assignments,
        active_assignments=active_assignments
    )


@router.put("/{patient_id}", response_model=PatientResponse, summary="更新患者")
async def update_patient(
    patient_id: int,
    patient_data: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    更新患者信息
    """
    query = select(Patient).filter(Patient.id == patient_id)
    
    # 权限控制
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if str(current_role).lower() != "admin":
        query = query.filter(Patient.doctor_id == current_user.id)
    
    result = await db.execute(query)
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="患者不存在或无权访问"
        )
    
    # 更新字段
    update_data = patient_data.model_dump(exclude_unset=True)
    
    # 性别字段：确保是 Enum，并处理前端传来的旧值
    if "gender" in update_data and update_data["gender"] is not None:
        g = update_data["gender"]
        if isinstance(g, str):
            # 处理前端可能传来的旧值
            gender_mapping = {"M": "MALE", "F": "FEMALE", "Other": "OTHER"}
            if g in gender_mapping:
                g = gender_mapping[g]
            g = Gender(g)
        update_data["gender"] = g
    
    for field, value in update_data.items():
        setattr(patient, field, value)
    
    await db.commit()
    await db.refresh(patient)
    
    return PatientResponse.model_validate(patient)


@router.delete("/{patient_id}", summary="删除患者")
async def delete_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    删除患者（会同时删除患者的所有分配记录）
    """
    query = select(Patient).filter(Patient.id == patient_id)
    
    # 权限控制
    current_role = (current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if str(current_role).lower() != "admin":
        query = query.filter(Patient.doctor_id == current_user.id)
    
    result = await db.execute(query)
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="患者不存在或无权访问"
        )
    
    await db.delete(patient)
    await db.commit()
    
    return {"message": "患者已删除"}