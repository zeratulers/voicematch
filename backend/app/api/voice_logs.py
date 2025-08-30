"""
语音日志管理API

提供语音识别日志的增删改查功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.voice_log import VoiceLog
from app.schemas.voice_log import (
    VoiceLogCreate,
    VoiceLogResponse,
    VoiceLogUploadRequest,
    VoiceLogUploadResponse,
    VoiceLogListResponse
)

router = APIRouter()


@router.get("/{patient_id}", summary="获取患者的语音识别日志")
async def get_patient_voice_logs(
    patient_id: int,
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(50, ge=1, le=200, description="每页数量"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取指定患者的语音识别日志列表
    """
    # 构建查询
    query = select(VoiceLog).filter(VoiceLog.patient_id == patient_id)
    
    # 计算总数
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 分页查询
    query = query.order_by(desc(VoiceLog.created_at))
    query = query.offset((page - 1) * size).limit(size)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    # 计算分页信息
    pages = (total + size - 1) // size
    
    return VoiceLogListResponse(
        logs=[
            VoiceLogResponse(
                id=log.id,
                patient_id=log.patient_id,
                user_id=log.user_id,
                transcript=log.transcript,
                confidence=log.confidence,
                status=log.status,
                matched_command_id=log.matched_command_id,
                matched_command_content=log.matched_command_content,
                matched_confidence=log.matched_confidence,
                processing_time_ms=log.processing_time_ms,
                created_at=log.created_at,
                updated_at=log.updated_at
            )
            for log in logs
        ],
        total=total,
        page=page,
        size=size,
        pages=pages
    )


@router.post("/upload", summary="批量上传语音识别日志")
async def upload_voice_logs(
    request: VoiceLogUploadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    批量上传语音识别日志
    """
    uploaded_count = 0
    failed_count = 0
    errors = []
    
    for log_data in request.logs:
        try:
            # 创建语音日志记录
            voice_log = VoiceLog(
                patient_id=request.patient_id,
                user_id=current_user.id,
                transcript=log_data.transcript,
                confidence=log_data.confidence,
                status=log_data.status,
                matched_command_id=log_data.matched_command_id,
                matched_command_content=log_data.matched_command_content,
                matched_confidence=log_data.matched_confidence,
                processing_time_ms=log_data.processing_time_ms
            )
            
            db.add(voice_log)
            uploaded_count += 1
            
        except Exception as e:
            failed_count += 1
            errors.append(f"日志 {uploaded_count + failed_count}: {str(e)}")
    
    try:
        await db.commit()
        return VoiceLogUploadResponse(
            message="语音日志上传完成",
            uploaded_count=uploaded_count,
            failed_count=failed_count,
            errors=errors
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"保存语音日志失败: {str(e)}"
        )


@router.post("/", summary="创建单个语音识别日志")
async def create_voice_log(
    log_data: VoiceLogCreate,
    patient_id: int = Query(..., description="患者ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    创建单个语音识别日志
    """
    try:
        voice_log = VoiceLog(
            patient_id=patient_id,
            user_id=current_user.id,
            transcript=log_data.transcript,
            confidence=log_data.confidence,
            status=log_data.status,
            matched_command_id=log_data.matched_command_id,
            matched_command_content=log_data.matched_command_content,
            matched_confidence=log_data.matched_confidence,
            processing_time_ms=log_data.processing_time_ms
        )
        
        db.add(voice_log)
        await db.commit()
        await db.refresh(voice_log)
        
        return VoiceLogResponse(
            id=voice_log.id,
            patient_id=voice_log.patient_id,
            user_id=voice_log.user_id,
            transcript=voice_log.transcript,
            confidence=voice_log.confidence,
            status=voice_log.status,
            matched_command_id=voice_log.matched_command_id,
            matched_command_content=voice_log.matched_command_content,
            matched_confidence=voice_log.matched_confidence,
            processing_time_ms=voice_log.processing_time_ms,
            created_at=voice_log.created_at,
            updated_at=voice_log.updated_at
        )
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"创建语音日志失败: {str(e)}"
        )
