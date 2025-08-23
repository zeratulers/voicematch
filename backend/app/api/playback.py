"""
音频播放API路由 - 重新设计版本

处理手动播放触发和播放解析，适配新的患者-指令分配架构
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.patient import Patient
from app.models.command import Command
from app.models.command_variant import CommandVariant
from app.models.dialect_set import DialectSet
from app.models.patient_command_assignment import PatientCommandAssignment
from app.models.audit_log import AuditLog

router = APIRouter()


class PlaybackTriggerRequest(BaseModel):
    """手动播放触发请求"""
    patient_id: int
    command_id: str


class PlaybackByContentRequest(BaseModel):
    """根据内容播放请求"""
    patient_id: int
    command_content: str


class PlaybackTriggerResponse(BaseModel):
    """手动播放触发响应"""
    audio_url: str
    command_id: str
    command_content: str
    variant_id: int
    dialect_label: str
    duration_ms: Optional[int] = None


@router.post("/trigger", response_model=PlaybackTriggerResponse, summary="手动触发播放")
async def trigger_playback(
    request: PlaybackTriggerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    手动触发指定患者和指令的音频播放
    
    根据患者的指令分配记录选择对应的变体进行播放
    """
    # 检查患者权限
    patient_result = await db.execute(
        select(Patient).filter(Patient.id == request.patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="患者不存在"
        )
    
    # 权限检查：普通医生只能操作自己的患者
    if (current_user.role.value != "admin" and 
        patient.doctor_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此患者"
        )
    
    # 在新架构中，通过患者分配记录查询指令和变体
    assignment_result = await db.execute(
        select(PatientCommandAssignment)
        .options(
            selectinload(PatientCommandAssignment.command),
            selectinload(PatientCommandAssignment.variant).selectinload(CommandVariant.dialect_set)
        )
        .filter(
            PatientCommandAssignment.command_id == request.command_id,
            PatientCommandAssignment.patient_id == request.patient_id,
            PatientCommandAssignment.is_active == True
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该患者没有分配此指令或指令已禁用"
        )
    
    if not assignment.variant or not assignment.variant.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该指令没有可播放的音频变体"
        )
    
    command = assignment.command
    variant = assignment.variant
    
    # 记录播放日志
    audit_log = AuditLog(
        user_id=current_user.id,
        action="manual_playback",
        entity="command",
        entity_id=command.id,
        payload={
            "command_id": command.id,
            "variant_id": variant.id,
            "patient_id": request.patient_id,
            "dialect": variant.dialect_set.key,
            "command_content": command.content[:50]  # 只记录前50个字符
        }
    )
    db.add(audit_log)
    await db.commit()
    
    return PlaybackTriggerResponse(
        audio_url=variant.audio_url,
        command_id=command.id,
        command_content=command.content,
        variant_id=variant.id,
        dialect_label=variant.dialect_set.label,
        duration_ms=variant.duration_ms
    )


@router.post("/trigger-by-content", response_model=PlaybackTriggerResponse, summary="根据内容触发播放")
async def trigger_playback_by_content(
    request: PlaybackByContentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    根据指令内容触发播放
    
    用于语音识别后的自动播放
    """
    # 检查患者权限
    patient_result = await db.execute(
        select(Patient).filter(Patient.id == request.patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="患者不存在"
        )
    
    # 权限检查
    if (current_user.role.value != "admin" and 
        patient.doctor_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此患者"
        )
    
    # 根据内容查找指令（通过分配记录查找）
    assignment_result = await db.execute(
        select(PatientCommandAssignment)
        .options(
            selectinload(PatientCommandAssignment.command),
            selectinload(PatientCommandAssignment.variant).selectinload(CommandVariant.dialect_set)
        )
        .join(Command, PatientCommandAssignment.command_id == Command.id)
        .filter(
            PatientCommandAssignment.patient_id == request.patient_id,
            Command.content.like(f"%{request.command_content}%"),
            PatientCommandAssignment.is_active == True
        )
        .limit(1)
    )
    assignment = assignment_result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="未找到匹配的指令"
        )
    
    # 检查是否有激活的变体
    if not assignment.variant or not assignment.variant.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该指令没有配置音频变体"
        )
    
    command = assignment.command
    variant = assignment.variant
    
    # 记录播放日志
    audit_log = AuditLog(
        user_id=current_user.id,
        action="auto_playback",
        entity="command",
        entity_id=command.id,
        payload={
            "command_id": command.id,
            "variant_id": variant.id,
            "patient_id": request.patient_id,
            "matched_content": request.command_content,
            "trigger_type": "voice_recognition"
        }
    )
    db.add(audit_log)
    await db.commit()
    
    return PlaybackTriggerResponse(
        audio_url=variant.audio_url,
        command_id=command.id,
        command_content=command.content,
        variant_id=variant.id,
        dialect_label=variant.dialect_set.label,
        duration_ms=variant.duration_ms
    )


@router.get("/resolve/{patient_id}", summary="获取患者的所有可播放指令")
async def resolve_patient_commands(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取患者的所有可播放指令
    
    用于前端预加载或展示
    """
    # 检查患者权限
    patient_result = await db.execute(
        select(Patient).filter(Patient.id == patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="患者不存在"
        )
    
    # 权限检查
    if (current_user.role.value != "admin" and 
        patient.doctor_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问此患者"
        )
    
    # 获取患者的所有激活分配
    assignments_result = await db.execute(
        select(PatientCommandAssignment)
        .options(
            selectinload(PatientCommandAssignment.command),
            selectinload(PatientCommandAssignment.variant).selectinload(CommandVariant.dialect_set)
        )
        .filter(
            PatientCommandAssignment.patient_id == patient_id,
            PatientCommandAssignment.is_active == True
        )
        .order_by(PatientCommandAssignment.created_at)
    )
    assignments = assignments_result.scalars().all()
    
    # 构建响应
    playable_commands = []
    for assignment in assignments:
        if assignment.variant and assignment.variant.is_active:
            playable_commands.append({
                "command_id": assignment.command.id,
                "content": assignment.command.content,
                "description": assignment.command.description,
                "audio_url": assignment.variant.audio_url,
                "duration_ms": assignment.variant.duration_ms,
                "dialect_label": assignment.variant.dialect_set.label,
                "speaker_name": assignment.variant.speaker_name,
                "variant_id": assignment.variant.id
            })
    
    return {
        "patient_id": patient_id,
        "patient_name": patient.name,
        "total_commands": len(playable_commands),
        "commands": playable_commands
    }


@router.post("/log", summary="记录播放事件")
async def log_playback(
    request: PlaybackByContentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    记录播放事件到审计日志
    
    用于前端离线播放后上报事件
    """
    # 简单的事件记录
    audit_log = AuditLog(
        user_id=current_user.id,
        action="logged_playback",
        entity="patient",
        entity_id=str(request.patient_id),
        payload={
            "patient_id": request.patient_id,
            "command_content": request.command_content,
            "trigger_type": "frontend_report"
        }
    )
    
    db.add(audit_log)
    await db.commit()
    
    return {"message": "播放事件已记录"}