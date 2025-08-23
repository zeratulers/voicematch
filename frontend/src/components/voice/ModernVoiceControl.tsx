/**
 * 现代化语音控制组件
 * 
 * 功能特性：
 * - 实时音频波形可视化
 * - 中文唤醒词识别
 * - 智能音频切割与分类
 * - 多级音量检测
 * - 状态机管理
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { AudioVisualizer } from 'react-audio-visualize'
import annyang from 'annyang'
import { AudioClassifier, type ClassificationResult } from './AudioClassifier'
import { pinyin } from 'pinyin-pro'
import '../../types/speech.d.ts'

// 语音控制状态
type VoiceControlState = 
  | 'idle'        // 空闲状态
  | 'listening'   // 监听唤醒词
  | 'awakened'    // 已唤醒，等待命令
  | 'capturing'   // 捕获命令音频
  | 'processing'  // 处理分类
  | 'playing'     // 播放指令

// 指令接口
interface Command {
  command_id: string
  content: string
  description?: string
  audio_url: string
  duration_ms?: number
  dialect_label: string
  speaker_name: string
  variant_id: number
}

// 移除本地定义的接口，使用导入的类型

// 组件属性
interface ModernVoiceControlProps {
  commands: Command[]
  onPlayCommand: (commandId: string, content: string) => void
  onStateChange?: (state: VoiceControlState) => void
  onTranscriptChange?: (transcript: string) => void
  onCommandPlayed?: (content: string) => void
  wakeWords?: string[]
  enabled?: boolean
  className?: string
  enableWakeWordPinyin?: boolean // 是否启用唤醒词拼音匹配
  wakeWordPinyinThreshold?: number // 唤醒词拼音匹配阈值
}

const ModernVoiceControl: React.FC<ModernVoiceControlProps> = ({
  commands,
  onPlayCommand,
  onStateChange,
  onTranscriptChange,
  onCommandPlayed,
  wakeWords = ['发出指令', '播放指令', '开始指令', '测试拼音'],
  enabled = true,
  className = '',
  enableWakeWordPinyin = true, // 默认启用拼音匹配
  wakeWordPinyinThreshold = 0.6 // 默认拼音匹配阈值
}) => {
  // 状态管理
  const [state, setState] = useState<VoiceControlState>('idle')
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [classificationResults, setClassificationResults] = useState<ClassificationResult[]>([])
  const [lastCommand, setLastCommand] = useState<string>('')
  const [isRestarting, setIsRestarting] = useState(false)

  // 引用
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const recognitionRef = useRef<any>(null)
  const animationFrameRef = useRef<number>(0)
  const audioChunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const captureStartTimeRef = useRef<number>(0)
  const classifierRef = useRef<AudioClassifier | null>(null)
  const stateRef = useRef<VoiceControlState>('idle')
  const isRecordingRef = useRef<boolean>(false)
  const isRestartingRef = useRef<boolean>(false)
  const awakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 音频阈值配置
  const VOLUME_THRESHOLD = 0.1  // 音量检测阈值
  const SILENCE_DURATION = 1500 // 静音时长（毫秒）
  const MAX_CAPTURE_DURATION = 5000 // 最大捕获时长（毫秒）

  // 状态变更处理
  const updateState = useCallback((newState: VoiceControlState) => {
    setState(newState)
    stateRef.current = newState  // 同步到ref
    onStateChange?.(newState)
    console.log(`🔄 语音控制状态: ${newState}`)
  }, [onStateChange])

  // [NEW] 创建一个集中的、健壮的语音识别重启函数
  const restartRecognition = useCallback(() => {
    if (!isRecordingRef.current || !recognitionRef.current) {
      console.log('🔄 跳过重启 - 不在录音状态或识别器未初始化');
      return;
    }

    setIsRestarting(true);
    console.log('🔄 准备重启语音识别...');

    try {
      recognitionRef.current.abort();
      console.log('⏹️ 已中止旧的识别会话');
    } catch (e) {
      console.warn('中止识别会话时出错:', e);
    }

    setTimeout(() => {
      if (isRecordingRef.current) {
        try {
          recognitionRef.current.start();
          console.log('✅ 语音识别已成功重启');
        } catch (error) {
          console.error('❌ 重启语音识别失败:', error);
        } finally {
          setIsRestarting(false);
        }
      } else {
        console.log('❌ 用户已停止录音，取消重启');
        setIsRestarting(false);
      }
    }, 100);
  }, []);

  // [NEW] 创建一个专门用于重置到唤醒状态并重启监听的函数
  const resetToAwakenedState = useCallback((message: string) => {
    console.log(`⏰ 准备重置到 awakened 状态: ${message}`);
    setTranscript(message);
    setClassificationResults([]); // 清空之前的结果
    updateState('awakened');

    // 这是关键修复：重启语音识别以接收新指令
    restartRecognition();

    // 设置超时，如果长时间没收到指令，则返回 listening 状态
    if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);
    awakeTimeoutRef.current = setTimeout(() => {
      if (stateRef.current === 'awakened') {
        console.log('⏰ 长时间未收到指令，回到 listening 状态');
        setTranscript('');
        updateState('listening');
        restartRecognition(); // 回到 listening 状态也需要重启
      }
    }, 30000);
  }, [updateState, restartRecognition]);

  // 获取状态样式
  const getStateStyle = (currentState: VoiceControlState) => {
    const styles = {
      idle: 'bg-gray-100 border-gray-300 text-gray-700',
      listening: 'bg-blue-100 border-blue-300 text-blue-700',
      awakened: 'bg-orange-100 border-orange-300 text-orange-700',
      capturing: 'bg-purple-100 border-purple-300 text-purple-700',
      processing: 'bg-yellow-100 border-yellow-300 text-yellow-700',
      playing: 'bg-green-100 border-green-300 text-green-700'
    }
    return styles[currentState] || styles.idle
  }

  // 获取状态图标
  const getStateIcon = (currentState: VoiceControlState) => {
    switch (currentState) {
      case 'idle':
        return <MicOff className="h-5 w-5" />
      case 'listening':
        return <Mic className="h-5 w-5 animate-pulse" />
      case 'awakened':
        return <Volume2 className="h-5 w-5 animate-bounce" />
      case 'capturing':
        return <Mic className="h-5 w-5 text-purple-600" />
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin" />
      case 'playing':
        return <CheckCircle2 className="h-5 w-5" />
      default:
        return <AlertCircle className="h-5 w-5" />
    }
  }

  // 获取状态文本
  const getStateText = (currentState: VoiceControlState) => {
    const texts = {
      idle: '等待启动',
      listening: '监听唤醒词...',
      awakened: '请说出指令内容',
      capturing: '正在录制指令...',
      processing: '智能分析中...',
      playing: '播放指令完成'
    }
    return texts[currentState] || '未知状态'
  }

  // 文本转拼音（用于唤醒词匹配）
  const textToPinyin = (text: string): string => {
    try {
      // 使用 pinyin-pro 库进行准确的拼音转换
      const pinyinArray = pinyin(text, { 
        toneType: 'none',  // 不带声调
        type: 'array'      // 返回数组格式
      })
      
      // 将拼音数组合并成字符串
      return pinyinArray.join('').toLowerCase()
    } catch (error) {
      console.warn('拼音转换失败，使用原文本:', error)
      // 如果拼音转换失败，返回原文本的小写形式
      return text.toLowerCase()
    }
  }

  // 计算两个拼音字符串的相似度
  const calculatePinyinSimilarity = (pinyin1: string, pinyin2: string): number => {
    if (pinyin1 === pinyin2) return 1.0
    
    const len1 = pinyin1.length
    const len2 = pinyin2.length
    
    if (len1 === 0 || len2 === 0) return 0.0
    
    // 使用编辑距离计算相似度
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null))
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i
    for (let j = 0; j <= len2; j++) matrix[0][j] = j
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = pinyin1[i - 1] === pinyin2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // 删除
          matrix[i][j - 1] + 1,      // 插入
          matrix[i - 1][j - 1] + cost // 替换
        )
      }
    }
    
    const maxLen = Math.max(len1, len2)
    return maxLen === 0 ? 1.0 : (maxLen - matrix[len1][len2]) / maxLen
  }

  // 检查唤醒词匹配（支持拼音匹配）
  const checkWakeWordMatch = (transcript: string, wakeWord: string): { matched: boolean, similarity: number, matchType: 'exact' | 'pinyin' | 'none' } => {
    // 1. 精确匹配
    if (transcript.includes(wakeWord)) {
      return { matched: true, similarity: 1.0, matchType: 'exact' }
    }
    
    // 2. 拼音匹配（如果启用）
    if (enableWakeWordPinyin) {
      const transcriptPinyin = textToPinyin(transcript)
      const wakeWordPinyin = textToPinyin(wakeWord)
      
      const similarity = calculatePinyinSimilarity(transcriptPinyin, wakeWordPinyin)
      
      if (similarity >= wakeWordPinyinThreshold) {
        console.log(`🔤 拼音匹配: "${transcript}" -> "${wakeWord}" (相似度: ${(similarity * 100).toFixed(1)}%)`)
        return { matched: true, similarity, matchType: 'pinyin' }
      }
    }
    
    return { matched: false, similarity: 0.0, matchType: 'none' }
  }

  // 初始化音频上下文
  const initAudioContext = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      })

      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      
      analyserRef.current.fftSize = 512
      analyserRef.current.smoothingTimeConstant = 0.8
      
      microphoneRef.current.connect(analyserRef.current)

      // 创建录音器
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        audioChunksRef.current = []
        processAudioBlob(audioBlob)
      }

      return true
    } catch (error) {
      console.error('初始化音频上下文失败:', error)
      return false
    }
  }, [])

  // 音频级别监控
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    const normalizedLevel = average / 255
    
    setAudioLevel(normalizedLevel)

    // 在 awakened 状态下检测音量触发录制
    if (state === 'awakened' && normalizedLevel > VOLUME_THRESHOLD) {
      startCapturing()
    }

    // 在 capturing 状态下检测静音
    if (state === 'capturing') {
      if (normalizedLevel < VOLUME_THRESHOLD) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stopCapturing()
          }, SILENCE_DURATION)
        }
      } else {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = null
        }
      }

      // 检查最大录制时长
      const duration = Date.now() - captureStartTimeRef.current
      if (duration > MAX_CAPTURE_DURATION) {
        stopCapturing()
      }
    }

    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel)
  }, [state])

  // 初始化语音识别
  const initSpeechRecognition = useCallback(() => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
      console.error('浏览器不支持语音识别')
      return false
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SpeechRecognition) {
      console.error('浏览器不支持语音识别')
      return false
    }
    recognitionRef.current = new SpeechRecognition()
    
    const recognition = recognitionRef.current
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      const fullTranscript = finalTranscript || interimTranscript
      console.log('🎤 语音识别结果:', {
        state,
        finalTranscript: `"${finalTranscript}"`,
        interimTranscript: `"${interimTranscript}"`,
        fullTranscript: `"${fullTranscript}"`
      })
      
      setTranscript(fullTranscript)
      onTranscriptChange?.(fullTranscript)

      // 检查唤醒词（使用ref获取最新状态）
      console.log('🔍 检查唤醒词条件:', { 
        state: stateRef.current,
        displayState: state,
        fullTranscript: `"${fullTranscript}"`, 
        hasText: !!fullTranscript,
        shouldCheck: stateRef.current === 'listening' && !!fullTranscript
      })
      
      if (stateRef.current === 'listening' && fullTranscript) {
        // 使用新的拼音匹配逻辑检查唤醒词
        let bestMatch: { word: string, similarity: number, matchType: 'exact' | 'pinyin' | 'none' } | null = null
        
        for (const word of wakeWords) {
          const matchResult = checkWakeWordMatch(fullTranscript, word)
          console.log(`🔎 检查唤醒词 "${word}": ${matchResult.matched ? '匹配' : '不匹配'} (类型: ${matchResult.matchType}, 相似度: ${(matchResult.similarity * 100).toFixed(1)}%)`)
          
          if (matchResult.matched && (!bestMatch || matchResult.similarity > bestMatch.similarity)) {
            bestMatch = { word, similarity: matchResult.similarity, matchType: matchResult.matchType }
          }
        }
        
        if (bestMatch) {
          console.log(`🎯 检测到唤醒词: "${bestMatch.word}" (类型: ${bestMatch.matchType}, 相似度: ${(bestMatch.similarity * 100).toFixed(1)}%) 在文本: "${fullTranscript}"`)
          playNotificationSound('awakened')
          
          // [REFACTORED] 直接调用 resetToAwakenedState
          resetToAwakenedState('已唤醒，请说出指令...');
          return; // 唤醒后，直接返回，等待下一次 onresult
        } else {
          console.log('❌ 没有匹配的唤醒词')
        }
      } else {
        console.log('⏸️ 跳过唤醒词检查 - 条件不满足')
      }

      // 在awakened状态下检测指令内容（使用ref获取最新状态）
      console.log('🔍 检查指令内容条件:', {
        state: stateRef.current,
        hasText: !!(finalTranscript || interimTranscript),
        finalTranscript: `"${finalTranscript}"`,
        interimTranscript: `"${interimTranscript}"`,
        shouldCheck: stateRef.current === 'awakened'
      })
      
      if (stateRef.current === 'awakened' && (finalTranscript || (interimTranscript && interimTranscript.length >= 2))) {
        const textToProcess = finalTranscript || interimTranscript
        console.log('📝 处理awakened状态下的文本:', textToProcess)
        
        // 检查是否是新的语音内容（不包含唤醒词）
        const hasWakeWord = wakeWords.some(word => {
          const matchResult = checkWakeWordMatch(textToProcess, word)
          return matchResult.matched
        })
        
        if (hasWakeWord) {
          console.log('⏸️ 检测到唤醒词，跳过处理（等待新的指令内容）')
        } else {
          // 这是新的指令内容
          let commandText = textToProcess.trim()
          console.log('🎯 检测到新的指令内容:', `"${commandText}"`, '长度:', commandText.length)
          
          if (commandText.length > 0) {
            console.log('🎤 捕获到指令内容:', commandText)
            updateState('processing')
            setTranscript(`正在处理: "${commandText}"`)
            
            // 停止当前识别，准备处理
            if (recognitionRef.current) {
              recognitionRef.current.stop()
            }
            
            // 立即进行指令分类
            processCommandText(commandText)
          } else {
            console.log('⏸️ 指令内容为空，继续等待')
          }
        }
      } else {
        console.log('⏸️ 跳过指令检查 - 条件不满足')
      }
    }

    recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error)
    }

         // [REFACTORED] 简化 onend 逻辑
     recognition.onend = () => {
       console.log('🎤 语音识别结束', { 
         state: stateRef.current, 
         isRecording: isRecordingRef.current, 
         isRestarting: isRestartingRef.current 
       });
       
       // 只要还在录音模式，并且不是我们主动发起的重启，就尝试恢复
       if (isRecordingRef.current && !isRestartingRef.current) {
         console.log('🔄 识别意外结束，自动重启...');
         // 这里直接调用 start，因为 abort 已经在 restartRecognition 中处理了
         // 这是一个备用保险，主要的重启逻辑在其他地方
         try {
           recognitionRef.current.start();
         } catch (e) {
           console.error("❌ onend 中恢复失败", e);
         }
       }
     };

         return true
   }, [wakeWords, updateState, onTranscriptChange, checkWakeWordMatch, resetToAwakenedState]) // [MODIFIED] 更新依赖

  // 播放提示音
  const playNotificationSound = (type: 'start' | 'awakened' | 'error') => {
    const frequencies = {
      start: 800,
      awakened: 1000,
      error: 400
    }
    
    try {
      // 创建新的AudioContext用于提示音
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime)
      oscillator.type = 'sine'
      
      // 设置音量包络
      gainNode.gain.setValueAtTime(0, audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
      
      // 清理资源
      oscillator.onended = () => {
        audioContext.close()
      }
      
      console.log(`🔔 播放提示音: ${type} (${frequencies[type]}Hz)`)
    } catch (error) {
      console.error('提示音播放失败:', error)
    }
  }

  // 开始录制
  const startRecording = async () => {
    if (!enabled || isRecording) return

    const audioInitialized = await initAudioContext()
    const speechInitialized = initSpeechRecognition()

    if (!audioInitialized || !speechInitialized) {
      console.error('初始化失败')
      return
    }

    setIsRecording(true)
    isRecordingRef.current = true  // 同步到ref
    updateState('listening')
    
    // 开始语音识别
    if (recognitionRef.current) {
      recognitionRef.current.start()
    }

    // 开始音频监控
    monitorAudioLevel()
    
    playNotificationSound('start')
    console.log('🎤 开始语音监听')
  }

  // 停止录制
  const stopRecording = () => {
    setIsRecording(false)
    isRecordingRef.current = false  // 同步到ref
    updateState('idle')

    // 停止语音识别
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    // 停止录音
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    // 停止音频监控
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // 清理定时器
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    // 关闭音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setTranscript('')
    setAudioLevel(0)
    setClassificationResults([])
    
    console.log('🛑 停止语音监听')
  }

  // 开始捕获命令
  const startCapturing = () => {
    if (state !== 'awakened') return

    updateState('capturing')
    captureStartTimeRef.current = Date.now()
    
    if (mediaRecorderRef.current) {
      audioChunksRef.current = []
      mediaRecorderRef.current.start()
    }

    console.log('🎯 开始捕获指令音频')
  }

  // 停止捕获
  const stopCapturing = () => {
    if (state !== 'capturing') return

    updateState('processing')
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    console.log('✂️ 完成音频捕获，开始处理')
  }

  // 处理指令文本（新增）
  const processCommandText = async (commandText: string) => {
    if (!classifierRef.current) {
      console.error('分类器未初始化')
      playNotificationSound('error')
      updateState('listening')
      return
    }

    try {
      console.log('🔍 开始分类指令文本:', commandText)
      const results = await classifierRef.current.classifyTranscript(commandText)
      setClassificationResults(results)

      if (results.length > 0) {
        const bestMatch = results[0]
        console.log('🎯 分类结果:', { content: bestMatch.content, confidence: bestMatch.confidence, type: bestMatch.matchType })
        
        if (bestMatch.confidence > 0.4) {
          // 置信度足够，直接播放
          console.log('✅ 置信度足够，直接播放:', bestMatch.content)
          await executeCommand(bestMatch)
        } else {
          // [MODIFIED] 置信度不够，使用新的重置函数
          console.log('❓ 置信度不够，请重新说一遍')
          playNotificationSound('error')
          setClassificationResults([]); // 清除旧结果
          
          // 延迟后回到 awakened 状态并重启监听
          setTimeout(() => {
            resetToAwakenedState('识别不够准确，请重新说出指令');
          }, 1500);
        }
      } else {
        // [MODIFIED] 没有匹配指令，也回到 awakened 状态并重启
        console.log('❌ 没有找到匹配的指令')
        playNotificationSound('error')
        setClassificationResults([]);
        
        setTimeout(() => {
          resetToAwakenedState('没有匹配的指令，请重试');
        }, 1500);
      }
    } catch (error) {
      // [MODIFIED] 分类失败，也回到 awakened 状态并重启
      console.error('指令分类失败:', error)
      playNotificationSound('error')
      
      setTimeout(() => {
        resetToAwakenedState('处理出错，请重试');
      }, 1500);
    }
  }

  // 处理音频数据
  const processAudioBlob = async (audioBlob: Blob) => {
    try {
      // 这里将集成音频分类器
      const results = await classifyAudio(audioBlob)
      setClassificationResults(results)

      if (results.length > 0) {
        const bestMatch = results[0]
        
        if (bestMatch.confidence > 0.6) {
          // 置信度足够，直接播放
          console.log('🎯 置信度足够，直接播放:', bestMatch.content)
          await executeCommand(bestMatch)
        } else {
          // [MODIFIED] 置信度不够，使用新的重置函数
          console.log('❓ 置信度不够，请重新说一遍')
          playNotificationSound('error')
          setClassificationResults([]); // 清除旧结果
          
          // 延迟后回到 awakened 状态并重启监听
          setTimeout(() => {
            resetToAwakenedState('识别不够准确，请重新说出指令');
          }, 1500);
        }
      } else {
        // [MODIFIED] 没有结果，回到 awakened 状态
        setTimeout(() => {
          resetToAwakenedState('没有识别到指令内容，请重试');
        }, 1500);
      }
    } catch (error) {
      // [MODIFIED] 处理失败，回到 awakened 状态
      console.error('音频处理失败:', error)
      playNotificationSound('error')
      
      setTimeout(() => {
        resetToAwakenedState('音频处理出错，请重试');
      }, 1500);
    }
  }

  // 音频分类（集成真实的分类器）
  const classifyAudio = async (audioBlob: Blob): Promise<ClassificationResult[]> => {
    if (!classifierRef.current) {
      console.error('分类器未初始化')
      return []
    }

    try {
      // 优先使用转录文本进行分类
      if (transcript) {
        console.log('🔍 使用转录文本进行分类:', transcript)
        return await classifierRef.current.classifyTranscript(transcript)
      }

      // 如果没有转录文本，使用音频文件分类（预留功能）
      console.log('🎵 使用音频文件进行分类')
      return await classifierRef.current.classifyAudio(audioBlob)
    } catch (error) {
      console.error('分类器错误:', error)
      return []
    }
  }

  // 执行命令
  const executeCommand = async (result: ClassificationResult) => {
    updateState('playing')
    setLastCommand(result.content)
    
    // 清除唤醒超时
    if (awakeTimeoutRef.current) {
      clearTimeout(awakeTimeoutRef.current)
      awakeTimeoutRef.current = null
      console.log('🔄 清除唤醒超时')
    }
    
    onPlayCommand(result.command_id, result.content)
    onCommandPlayed?.(result.content)
    
    // [REFACTORED] 播放完成后，延迟回到 listening 状态并重启识别
    setTimeout(() => {
      if (isRecordingRef.current) {
        console.log('▶️ 播放完成，回到 listening 状态');
        updateState('listening')
        setTranscript('')
        restartRecognition(); // [FIX] 使用统一的重启函数
      }
    }, 2000)
    

  }

  // 手动选择命令
  const selectCommand = (result: ClassificationResult) => {
    executeCommand(result)
  }

  // 同步状态到ref
  useEffect(() => {
    isRecordingRef.current = isRecording
    console.log('📊 录音状态同步:', isRecording)
  }, [isRecording])

  useEffect(() => {
    isRestartingRef.current = isRestarting
    console.log('🔄 重启状态同步:', isRestarting)
  }, [isRestarting])

  // 初始化分类器
  useEffect(() => {
    if (commands.length > 0) {
      classifierRef.current = new AudioClassifier(commands, {
        minConfidence: 0.2, // 降低最小置信度，让更多结果进入候选
        maxResults: 1,       // 只需要最佳匹配结果
        enablePinyinMatch: true,
        enableSemanticMatch: true,
        enableFuzzyMatch: true
      })
      console.log('🤖 分类器已初始化，指令数量:', commands.length)
    }
  }, [commands])

  // 组件卸载清理
  useEffect(() => {
    return () => {
      stopRecording()
      // 清理超时
      if (awakeTimeoutRef.current) {
        clearTimeout(awakeTimeoutRef.current)
      }
    }
  }, [])

  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            {getStateIcon(state)}
            <span className="ml-2">智能语音控制</span>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStateStyle(state)}`}>
            {getStateText(state)}
          </div>
        </CardTitle>
        <CardDescription>
          现代化中文语音识别系统 - {commands.length} 个可用指令
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 主控制按钮 */}
        <div className="flex justify-center">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={!enabled || commands.length === 0}
              size="lg"
              className="w-32 h-32 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              <div className="text-center">
                <Mic className="h-8 w-8 mx-auto mb-2" />
                <span className="text-sm">开始录音</span>
              </div>
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              size="lg"
              variant="destructive"
              className="w-32 h-32 rounded-full"
            >
              <div className="text-center">
                <MicOff className="h-8 w-8 mx-auto mb-2" />
                <span className="text-sm">停止录音</span>
              </div>
            </Button>
          )}
        </div>

        {/* 状态展示和音频波形可视化 */}
        {isRecording && (
          <div className={`p-4 rounded-lg border-2 ${
            state === 'listening' ? 'bg-blue-50 border-blue-300' :
            state === 'awakened' ? 'bg-orange-50 border-orange-300' :
            state === 'processing' ? 'bg-purple-50 border-purple-300' :
            state === 'playing' ? 'bg-green-50 border-green-300' :
            'bg-gray-50 border-gray-300'
          }`}>
            <div className="flex items-center justify-center mb-3">
              {getStateIcon(state)}
              <span className={`text-sm font-medium ml-2 ${
                state === 'listening' ? 'text-blue-700' :
                state === 'awakened' ? 'text-orange-700' :
                state === 'processing' ? 'text-purple-700' :
                state === 'playing' ? 'text-green-700' :
                'text-gray-700'
              }`}>
                {getStateText(state)}
              </span>
            </div>
            
            {/* 状态特定的视觉反馈 */}
            {(state === 'listening' || state === 'awakened') && (
              <>
                {/* 波形显示 */}
                <div className="flex items-center justify-center space-x-1 h-16">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-75 ${
                        state === 'listening' ? 'bg-blue-400' : 'bg-orange-400'
                      }`}
                      style={{
                        width: '4px',
                        height: `${Math.max(4, audioLevel * 60 * (Math.random() * 0.5 + 0.5))}px`,
                        opacity: audioLevel > 0.05 ? 0.8 : 0.3
                      }}
                    />
                  ))}
                </div>
                <div className={`text-center mt-2 text-xs ${
                  state === 'listening' ? 'text-blue-600' : 'text-orange-600'
                }`}>
                  音量: {Math.round(audioLevel * 100)}% | {
                    state === 'listening' ? '请说出唤醒词' : '请说出指令内容'
                  }
                </div>
              </>
            )}

            {state === 'awakened' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-orange-200 rounded-full flex items-center justify-center">
                  <Volume2 className="h-8 w-8 text-orange-600 animate-pulse" />
                </div>
                <p className="text-orange-700 font-medium">系统已唤醒，请说出指令内容</p>
                <p className="text-sm text-orange-600 mt-1">例如：深呼吸、放松肩膀、保持冷静</p>
              </div>
            )}

            {state === 'processing' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-200 rounded-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
                </div>
                <p className="text-purple-700 font-medium">正在智能分析指令...</p>
              </div>
            )}

            {state === 'playing' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-200 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-green-700 font-medium">指令播放完成</p>
                <p className="text-sm text-green-600 mt-1">准备下一个指令...</p>
              </div>
            )}
          </div>
        )}

        {/* 实时转录 - 始终显示，即使为空 */}
        {isRecording && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              <Mic className="h-4 w-4 mr-2 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">实时转录</span>
            </div>
            <p className="text-blue-700 min-h-[1.5rem]">
              {transcript || (
                <span className="text-gray-400 italic">
                  {state === 'listening' ? '等待语音输入...' : 
                   state === 'awakened' ? '请说出指令内容...' :
                   state === 'processing' ? '处理中...' : '等待中...'}
                </span>
              )}
            </p>
          </div>
        )}

        {/* 识别结果 - 仅显示信息，无需用户操作 */}
        {classificationResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">识别结果</h4>
            <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
              <div className="flex-1">
                <p className="font-medium text-blue-800">{classificationResults[0].content}</p>
                <div className="flex space-x-4 text-xs text-blue-600 mt-1">
                  <span>置信度: {Math.round(classificationResults[0].confidence * 100)}%</span>
                  <span>相似度: {Math.round(classificationResults[0].similarity * 100)}%</span>
                  <span className={`px-1 rounded ${
                    classificationResults[0].matchType === 'exact' ? 'bg-green-100 text-green-800' :
                    classificationResults[0].matchType === 'semantic' ? 'bg-blue-100 text-blue-800' :
                    classificationResults[0].matchType === 'pinyin' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {classificationResults[0].matchType}
                  </span>
                </div>
                <div className="mt-2 text-xs text-blue-500">
                  💡 系统将自动处理此指令
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 最后播放的指令 */}
        {lastCommand && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
              <span className="text-sm font-medium text-green-800">最近播放</span>
            </div>
            <p className="text-green-700">{lastCommand}</p>
          </div>
        )}

        {/* 唤醒词提示 */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">支持的唤醒词</h4>
            {enableWakeWordPinyin && (
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                🔤 拼音匹配已启用
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {wakeWords.map((word, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600"
              >
                "{word}"
              </span>
            ))}
          </div>
          {enableWakeWordPinyin && (
            <div className="mt-2 text-xs text-gray-500">
              💡 支持发音相似但文字不同的唤醒词识别
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ModernVoiceControl
