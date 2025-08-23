"""
文件上传API路由

处理音频文件上传和存储
"""

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status, Form
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import uuid
import os
import aiofiles
from pathlib import Path
import mimetypes
import subprocess
import json
from mutagen import File as MutagenFile

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.core.config import settings
from app.models.user import User

router = APIRouter()


def get_audio_duration_ms(file_path: Path) -> Optional[int]:
    """
    获取音频文件时长（毫秒）
    支持多种方法：mutagen -> ffprobe -> None
    """
    # 方法1: 尝试使用 mutagen
    try:
        audio = MutagenFile(file_path)
        if audio and audio.info and hasattr(audio.info, 'length'):
            return int(audio.info.length * 1000)
    except Exception as e:
        print(f"Mutagen failed for {file_path}: {e}")
    
    # 方法2: 尝试使用 ffprobe（如果可用）
    try:
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', str(file_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            duration = float(data['format']['duration'])
            return int(duration * 1000)
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError, KeyError, ValueError) as e:
        print(f"FFprobe failed for {file_path}: {e}")
    
    # 如果都失败了，返回 None
    print(f"Could not determine duration for {file_path}")
    return None


class UploadResponse(BaseModel):
    """文件上传响应"""
    audio_url: str
    filename: str
    size: int
    duration_ms: Optional[int] = None


@router.post("/audio", response_model=UploadResponse, summary="上传音频文件")
async def upload_audio(
    file: UploadFile = File(..., description="音频文件"),
    current_user: User = Depends(get_current_active_user)
):
    """
    上传音频文件到服务器
    
    支持的格式：WAV, MP3, Opus, M4A
    最大文件大小：50MB
    """
    # 验证文件类型
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件名不能为空"
        )
    
    # 获取文件扩展名
    file_ext = Path(file.filename).suffix.lower().lstrip('.')
    
    if file_ext not in settings.ALLOWED_AUDIO_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的文件格式。支持的格式：{', '.join(settings.ALLOWED_AUDIO_FORMATS)}"
        )
    
    # 验证文件大小
    content = await file.read()
    file_size = len(content)
    
    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"文件大小超过限制（{settings.MAX_UPLOAD_SIZE // (1024*1024)}MB）"
        )
    
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件不能为空"
        )
    
    # 生成唯一文件名
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    
    # 根据存储后端处理文件
    if settings.STORAGE_BACKEND == "local":
        # 本地存储
        storage_path = Path(settings.AUDIO_STORAGE_PATH)
        storage_path.mkdir(parents=True, exist_ok=True)
        
        # 按用户ID创建子目录
        user_dir = storage_path / str(current_user.id)
        user_dir.mkdir(exist_ok=True)
        
        file_path = user_dir / unique_filename
        
        # 保存文件
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        # 分析音频时长
        duration_ms = get_audio_duration_ms(file_path)
        
        # 构建访问URL
        audio_url = f"/media/{current_user.id}/{unique_filename}"
        
    elif settings.STORAGE_BACKEND == "minio":
        # MinIO存储 (暂时不实现，返回错误)
        duration_ms = None  # MinIO暂时不支持时长分析
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="MinIO存储暂未实现"
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="无效的存储后端配置"
        )
    
    print(f"Audio upload completed: {unique_filename}, duration_ms: {duration_ms}")
    
    return UploadResponse(
        audio_url=audio_url,
        filename=file.filename,
        size=file_size,
        duration_ms=duration_ms
    )


@router.delete("/{filename}", summary="删除音频文件")
async def delete_audio(
    filename: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    删除指定的音频文件
    
    只能删除当前用户上传的文件
    """
    if settings.STORAGE_BACKEND == "local":
        # 构建文件路径
        file_path = Path(settings.AUDIO_STORAGE_PATH) / str(current_user.id) / filename
        
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文件不存在"
            )
        
        # 检查文件是否属于当前用户
        if not str(file_path).startswith(str(Path(settings.AUDIO_STORAGE_PATH) / str(current_user.id))):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权删除此文件"
            )
        
        try:
            os.remove(file_path)
            return {"message": "文件删除成功"}
        except OSError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除文件失败：{str(e)}"
            )
    
    else:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="当前存储后端不支持删除操作"
        )


@router.get("/info/{filename}", summary="获取文件信息")
async def get_file_info(
    filename: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    获取文件的详细信息
    """
    if settings.STORAGE_BACKEND == "local":
        file_path = Path(settings.AUDIO_STORAGE_PATH) / str(current_user.id) / filename
        
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文件不存在"
            )
        
        # 获取文件统计信息
        stat = file_path.stat()
        
        return {
            "filename": filename,
            "size": stat.st_size,
            "created_at": stat.st_ctime,
            "modified_at": stat.st_mtime,
            "mime_type": mimetypes.guess_type(str(file_path))[0]
        }
    
    else:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="当前存储后端不支持此操作"
        )
