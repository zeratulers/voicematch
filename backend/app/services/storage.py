"""
存储服务

抽象化本地文件系统和MinIO对象存储
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO, Optional
import uuid
import aiofiles
import os

from app.core.config import settings


class StorageBackend(ABC):
    """存储后端抽象基类"""
    
    @abstractmethod
    async def upload_file(self, file_content: bytes, filename: str, user_id: int) -> str:
        """上传文件并返回访问URL"""
        pass
    
    @abstractmethod
    async def delete_file(self, file_url: str, user_id: int) -> bool:
        """删除文件"""
        pass
    
    @abstractmethod
    async def get_file_url(self, file_path: str) -> str:
        """获取文件访问URL"""
        pass


class LocalStorageBackend(StorageBackend):
    """本地文件系统存储后端"""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    async def upload_file(self, file_content: bytes, filename: str, user_id: int) -> str:
        """
        上传文件到本地存储
        
        文件路径结构：{base_path}/{user_id}/{unique_filename}
        """
        # 生成唯一文件名
        file_ext = Path(filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        
        # 创建用户目录
        user_dir = self.base_path / str(user_id)
        user_dir.mkdir(exist_ok=True)
        
        # 保存文件
        file_path = user_dir / unique_filename
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_content)
        
        # 返回相对URL
        return f"/media/{user_id}/{unique_filename}"
    
    async def delete_file(self, file_url: str, user_id: int) -> bool:
        """删除本地文件"""
        try:
            # 从URL解析文件路径
            if file_url.startswith("/media/"):
                relative_path = file_url[7:]  # 移除 "/media/" 前缀
                file_path = self.base_path / relative_path
                
                # 安全检查：确保文件在允许的目录内
                if not str(file_path).startswith(str(self.base_path / str(user_id))):
                    return False
                
                if file_path.exists():
                    os.remove(file_path)
                    return True
            
            return False
        except Exception:
            return False
    
    async def get_file_url(self, file_path: str) -> str:
        """获取本地文件URL"""
        return file_path


class MinIOStorageBackend(StorageBackend):
    """MinIO对象存储后端（暂未实现）"""
    
    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str):
        self.endpoint = endpoint
        self.access_key = access_key
        self.secret_key = secret_key
        self.bucket = bucket
        # TODO: 初始化MinIO客户端
    
    async def upload_file(self, file_content: bytes, filename: str, user_id: int) -> str:
        """上传文件到MinIO"""
        # TODO: 实现MinIO上传逻辑
        raise NotImplementedError("MinIO存储后端暂未实现")
    
    async def delete_file(self, file_url: str, user_id: int) -> bool:
        """从MinIO删除文件"""
        # TODO: 实现MinIO删除逻辑
        raise NotImplementedError("MinIO存储后端暂未实现")
    
    async def get_file_url(self, file_path: str) -> str:
        """获取MinIO文件URL"""
        # TODO: 实现MinIO URL生成逻辑
        raise NotImplementedError("MinIO存储后端暂未实现")


def get_storage_backend() -> StorageBackend:
    """获取配置的存储后端实例"""
    if settings.STORAGE_BACKEND == "local":
        return LocalStorageBackend(settings.AUDIO_STORAGE_PATH)
    elif settings.STORAGE_BACKEND == "minio":
        if not all([settings.MINIO_ENDPOINT, settings.MINIO_ACCESS_KEY, settings.MINIO_SECRET_KEY]):
            raise ValueError("MinIO存储后端配置不完整")
        
        return MinIOStorageBackend(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            bucket=settings.MINIO_BUCKET
        )
    else:
        raise ValueError(f"不支持的存储后端：{settings.STORAGE_BACKEND}")
