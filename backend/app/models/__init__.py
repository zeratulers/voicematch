"""
数据模型包

确保所有模型按正确的依赖顺序导入
"""

# 基础模型（无外键依赖）
from .user import User, UserRole
from .dialect_set import DialectSet
from .system_setting import SystemSetting

# 依赖基础模型的模型
from .patient import Patient, Gender

# 依赖多个模型的复杂模型
from .command import Command
from .command_variant import CommandVariant
from .patient_command_assignment import PatientCommandAssignment

# 审计日志模型
from .audit_log import AuditLog

# 语音日志模型
from .voice_log import VoiceLog

__all__ = [
    "User",
    "UserRole", 
    "Patient",
    "Gender",
    "Command",
    "CommandVariant",
    "DialectSet",
    "PatientCommandAssignment",
    "SystemSetting",
    "AuditLog",
    "VoiceLog",
]
