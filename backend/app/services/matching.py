"""
指令匹配服务

处理语音识别文本与指令的匹配逻辑
"""

import hashlib
import re
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from rapidfuzz import fuzz, process
import time

from app.core.config import settings


@dataclass
class MatchResult:
    """匹配结果"""
    command_key: str
    confidence: float
    matched_text: str
    variant_id: Optional[int] = None
    audio_url: Optional[str] = None


class CommandMatcher:
    """指令匹配器"""
    
    def __init__(self):
        self.wake_words = ["医生助手", "小医"]
        self.match_threshold = 85.0  # 最低匹配阈值
        self.window_duration = 3.0   # 唤醒后的窗口期（秒）
        self.cooldown_duration = 3.0  # 冷却时间（秒）
        
        # 指令缓存
        self.command_cache: Dict[str, str] = {}  # command_key -> 指令文本
        self.last_trigger_time: Dict[str, float] = {}  # command_key -> 上次触发时间
        
        # 同义词映射
        self.synonyms = {
            "放松": ["别紧张", "不要紧张", "放轻松", "别担心"],
            "深呼吸": ["吸气", "呼气", "慢慢呼吸"],
            "配合": ["听话", "乖乖的", "好好配合"],
            "完成": ["结束", "好了", "完毕"],
            "疼": ["痛", "疼痛", "不舒服"]
        }
    
    def generate_command_key(self, text: str) -> str:
        """
        为指令文本生成SHA1哈希键
        
        用于隐私保护，后端只存储哈希值
        """
        return hashlib.sha1(text.encode('utf-8')).hexdigest()
    
    def normalize_text(self, text: str) -> str:
        """
        标准化文本
        
        移除标点符号、空格，转为小写
        """
        # 移除标点符号和空格
        text = re.sub(r'[^\w\u4e00-\u9fff]', '', text)
        return text.lower()
    
    def detect_wake_word(self, text: str) -> bool:
        """
        检测唤醒词
        
        检查文本中是否包含任一唤醒词
        """
        normalized_text = self.normalize_text(text)
        
        for wake_word in self.wake_words:
            normalized_wake_word = self.normalize_text(wake_word)
            if normalized_wake_word in normalized_text:
                return True
        
        return False
    
    def extract_command_from_text(self, text: str) -> str:
        """
        从包含唤醒词的文本中提取指令部分
        
        移除唤醒词，返回剩余的指令文本
        """
        normalized_text = self.normalize_text(text)
        
        # 找到并移除唤醒词
        for wake_word in self.wake_words:
            normalized_wake_word = self.normalize_text(wake_word)
            if normalized_wake_word in normalized_text:
                # 移除唤醒词及其前后的文本
                parts = normalized_text.split(normalized_wake_word)
                # 取唤醒词后面的部分作为指令
                if len(parts) > 1:
                    command_part = parts[1].strip()
                    if command_part:
                        return command_part
                # 如果唤醒词后面没有内容，取前面的部分
                command_part = parts[0].strip()
                if command_part:
                    return command_part
        
        return normalized_text
    
    def expand_with_synonyms(self, text: str) -> List[str]:
        """
        使用同义词扩展文本
        
        返回包含原文本和同义词替换版本的列表
        """
        variations = [text]
        
        for original, synonyms in self.synonyms.items():
            if original in text:
                for synonym in synonyms:
                    variations.append(text.replace(original, synonym))
        
        return variations
    
    def match_command(
        self, 
        text: str, 
        command_texts: Dict[str, str],  # command_key -> 指令文本
        patient_id: Optional[int] = None
    ) -> Optional[MatchResult]:
        """
        匹配指令
        
        Args:
            text: 识别的文本
            command_texts: 可用的指令文本字典
            patient_id: 患者ID（用于个性化匹配）
        
        Returns:
            匹配结果或None
        """
        # 检测唤醒词
        if not self.detect_wake_word(text):
            return None
        
        # 提取指令部分
        command_text = self.extract_command_from_text(text)
        if not command_text:
            return None
        
        # 扩展同义词
        command_variations = self.expand_with_synonyms(command_text)
        
        best_match = None
        best_confidence = 0.0
        
        # 遍历所有可用指令进行匹配
        for command_key, stored_text in command_texts.items():
            # 检查冷却时间
            last_trigger = self.last_trigger_time.get(command_key, 0)
            if time.time() - last_trigger < self.cooldown_duration:
                continue
            
            normalized_stored = self.normalize_text(stored_text)
            
            # 对每个变体进行匹配
            for variation in command_variations:
                # 精确匹配
                if variation == normalized_stored:
                    confidence = 100.0
                elif variation in normalized_stored or normalized_stored in variation:
                    confidence = 95.0
                else:
                    # 模糊匹配
                    confidence = fuzz.ratio(variation, normalized_stored)
                
                # 更新最佳匹配
                if confidence > best_confidence and confidence >= self.match_threshold:
                    best_confidence = confidence
                    best_match = MatchResult(
                        command_key=command_key,
                        confidence=confidence,
                        matched_text=stored_text
                    )
        
        # 记录触发时间
        if best_match:
            self.last_trigger_time[best_match.command_key] = time.time()
        
        return best_match
    
    def set_wake_words(self, wake_words: List[str]):
        """设置唤醒词"""
        self.wake_words = wake_words
    
    def set_thresholds(self, match_threshold: float, cooldown_duration: float):
        """设置匹配阈值和冷却时间"""
        self.match_threshold = match_threshold
        self.cooldown_duration = cooldown_duration


# 全局匹配器实例
command_matcher = CommandMatcher()
