"""
患者指令分配API路由

处理患者与指令变体的绑定关系
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.patient import Patient
from app.models.command import Command
from app.models.command_variant import CommandVariant
from app.models.patient_command_assignment import PatientCommandAssignment
from app.schemas.patient_assignment import (
    PatientAssignmentCreate,
    PatientAssignmentUpdate,
    PatientAssignmentResponse,
    PatientAssignmentWithDetailsResponse,
    BatchAssignmentCreate,
    BatchAssignmentResponse
)

router = APIRouter()


@router.get("/patient/{patient_id}", response_model=List[PatientAssignmentWithDetailsResponse], summary="获取患者的指令分配")
async def get_patient_assignments(
    patient_id: int,
    is_active: Optional[bool] = Query(None, description="是否激活过滤"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取患者的所有指令分配
    """
    # 检查患者是否存在和权限
    patient_query = select(Patient).filter(Patient.id == patient_id)
    if current_user.role.value != "admin":
        patient_query = patient_query.filter(Patient.doctor_id == current_user.id)
    
    patient_result = await db.execute(patient_query)
    patient = patient_result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="患者不存在或无权访问"
        )
    
    # 获取分配记录
    query = select(PatientCommandAssignment).options(
        selectinload(PatientCommandAssignment.command),
        selectinload(PatientCommandAssignment.variant).selectinload(CommandVariant.dialect_set)
    ).filter(PatientCommandAssignment.patient_id == patient_id)
    
    if is_active is not None:
        query = query.filter(PatientCommandAssignment.is_active == is_active)
    
    query = query.order_by(desc(PatientCommandAssignment.created_at))
    
    result = await db.execute(query)
    assignments = result.scalars().all()
    
    # 构建详细响应
    detailed_assignments = []
    for assignment in assignments:
        detailed_assignments.append(PatientAssignmentWithDetailsResponse(
            **PatientAssignmentResponse.model_validate(assignment).model_dump(),
            command_content=assignment.command.content,
            command_description=assignment.command.description,
            dialect_label=assignment.variant.dialect_set.label,
            speaker_name=assignment.variant.speaker_name,
            audio_url=assignment.variant.audio_url,
            duration_ms=assignment.variant.duration_ms
        ))
    
    return detailed_assignments


@router.post("", response_model=PatientAssignmentResponse, summary="创建指令分配")
async def create_assignment(
    assignment_data: PatientAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    为患者分配指令变体
    """
    # 检查患者是否存在和权限
    patient_query = select(Patient).filter(Patient.id == assignment_data.patient_id)
    if current_user.role.value != "admin":
        patient_query = patient_query.filter(Patient.doctor_id == current_user.id)
    
    patient_result = await db.execute(patient_query)
    patient = patient_result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="患者不存在或无权访问"
        )
    
    # 检查指令是否存在
    command_result = await db.execute(
        select(Command).filter(Command.id == assignment_data.command_id)
    )
    command = command_result.scalar_one_or_none()
    
    if not command:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指令不存在"
        )
    
    # 检查变体是否存在且属于该指令
    variant_result = await db.execute(
        select(CommandVariant).filter(
            and_(
                CommandVariant.id == assignment_data.variant_id,
                CommandVariant.command_id == assignment_data.command_id
            )
        )
    )
    variant = variant_result.scalar_one_or_none()
    
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="变体不存在或不属于该指令"
        )
    
    # 检查是否已存在分配
    existing_result = await db.execute(
        select(PatientCommandAssignment).filter(
            and_(
                PatientCommandAssignment.patient_id == assignment_data.patient_id,
                PatientCommandAssignment.command_id == assignment_data.command_id
            )
        )
    )
    existing_assignment = existing_result.scalar_one_or_none()
    
    if existing_assignment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该患者已分配此指令，请使用更新接口修改变体"
        )
    
    # 创建分配
    assignment = PatientCommandAssignment(
        patient_id=assignment_data.patient_id,
        command_id=assignment_data.command_id,
        variant_id=assignment_data.variant_id,
        assigned_by=current_user.id,
        note=assignment_data.note
    )
    
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    
    return PatientAssignmentResponse.model_validate(assignment)


@router.put("/{assignment_id}", response_model=PatientAssignmentResponse, summary="更新指令分配")
async def update_assignment(
    assignment_id: int,
    assignment_data: PatientAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    更新指令分配
    """
    # 查找分配记录
    query = select(PatientCommandAssignment).filter(
        PatientCommandAssignment.id == assignment_id
    )
    
    # 权限控制：只能修改自己分配的或管理员
    if current_user.role.value != "admin":
        query = query.filter(PatientCommandAssignment.assigned_by == current_user.id)
    
    result = await db.execute(query)
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分配记录不存在或无权访问"
        )
    
    # 如果要更新变体，检查变体是否属于该指令
    if assignment_data.variant_id:
        variant_result = await db.execute(
            select(CommandVariant).filter(
                and_(
                    CommandVariant.id == assignment_data.variant_id,
                    CommandVariant.command_id == assignment.command_id
                )
            )
        )
        variant = variant_result.scalar_one_or_none()
        
        if not variant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="变体不存在或不属于该指令"
            )
    
    # 更新字段
    update_data = assignment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(assignment, field, value)
    
    await db.commit()
    await db.refresh(assignment)
    
    return PatientAssignmentResponse.model_validate(assignment)


@router.delete("/{assignment_id}", summary="删除指令分配")
async def delete_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    删除指令分配
    """
    # 查找分配记录
    query = select(PatientCommandAssignment).filter(
        PatientCommandAssignment.id == assignment_id
    )
    
    # 权限控制
    if current_user.role.value != "admin":
        query = query.filter(PatientCommandAssignment.assigned_by == current_user.id)
    
    result = await db.execute(query)
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分配记录不存在或无权访问"
        )
    
    await db.delete(assignment)
    await db.commit()
    
    return {"message": "分配已删除"}


@router.post("/batch", response_model=BatchAssignmentResponse, summary="批量分配指令")
async def batch_create_assignments(
    batch_data: BatchAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    批量为患者分配指令变体
    """
    # 检查患者是否存在和权限
    patient_query = select(Patient).filter(Patient.id == batch_data.patient_id)
    if current_user.role.value != "admin":
        patient_query = patient_query.filter(Patient.doctor_id == current_user.id)
    
    patient_result = await db.execute(patient_query)
    patient = patient_result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="患者不存在或无权访问"
        )
    
    successful_assignments = []
    errors = []
    
    for assignment_data in batch_data.assignments:
        try:
            # 检查指令和变体是否存在
            variant_result = await db.execute(
                select(CommandVariant).filter(
                    and_(
                        CommandVariant.id == assignment_data.variant_id,
                        CommandVariant.command_id == assignment_data.command_id
                    )
                )
            )
            variant = variant_result.scalar_one_or_none()
            
            if not variant:
                errors.append(f"指令 {assignment_data.command_id} 的变体 {assignment_data.variant_id} 不存在")
                continue
            
            # 检查是否已存在分配
            existing_result = await db.execute(
                select(PatientCommandAssignment).filter(
                    and_(
                        PatientCommandAssignment.patient_id == batch_data.patient_id,
                        PatientCommandAssignment.command_id == assignment_data.command_id
                    )
                )
            )
            existing_assignment = existing_result.scalar_one_or_none()
            
            if existing_assignment:
                errors.append(f"指令 {assignment_data.command_id} 已分配给该患者")
                continue
            
            # 创建分配
            assignment = PatientCommandAssignment(
                patient_id=batch_data.patient_id,
                command_id=assignment_data.command_id,
                variant_id=assignment_data.variant_id,
                assigned_by=current_user.id,
                note=assignment_data.note
            )
            
            db.add(assignment)
            successful_assignments.append(assignment)
            
        except Exception as e:
            errors.append(f"分配指令 {assignment_data.command_id} 时出错: {str(e)}")
    
    await db.commit()
    
    # 刷新对象获取ID
    for assignment in successful_assignments:
        await db.refresh(assignment)
    
    return BatchAssignmentResponse(
        success_count=len(successful_assignments),
        failed_count=len(errors),
        assignments=[PatientAssignmentResponse.model_validate(a) for a in successful_assignments],
        errors=errors
    )
