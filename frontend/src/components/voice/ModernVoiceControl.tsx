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
}

const ModernVoiceControl: React.FC<ModernVoiceControlProps> = ({
  commands,
  onPlayCommand,
  onStateChange,
  onTranscriptChange,
  onCommandPlayed,
  wakeWords = ['发出指令', '播放指令', '开始指令'],
  enabled = true,
  className = ''
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
        const matchedWord = wakeWords.find(word => {
          const hasMatch = fullTranscript.includes(word)
          console.log(`🔎 检查唤醒词 "${word}": ${hasMatch ? '匹配' : '不匹配'}`)
          return hasMatch
        })
        
        if (matchedWord) {
          console.log('🎯 检测到唤醒词:', matchedWord, '在文本:', fullTranscript)
          updateState('awakened')
          setTranscript('已唤醒，请说出指令...')
          
          // 播放提示音
          playNotificationSound('awakened')
          
          // 停止当前识别，准备重新开始
          if (recognitionRef.current) {
            recognitionRef.current.stop()
          }
          
          // 设置重启状态，防止onend事件重复启动
          setIsRestarting(true)
          
          // 清除之前的超时
          if (awakeTimeoutRef.current) {
            clearTimeout(awakeTimeoutRef.current)
            awakeTimeoutRef.current = null
          }
          
          // 短暂延迟后重新开始识别，准备捕获指令内容
          setTimeout(() => {
            console.log('🔄 唤醒后重启识别，准备捕获指令内容')
            setTranscript('') // 清除唤醒词文本
            if (recognitionRef.current && isRecordingRef.current) {
              try {
                recognitionRef.current.start()
                console.log('✅ 重启识别成功，等待指令内容')
                setIsRestarting(false) // 重启完成
                
                // 设置超时，如果30秒内没有指令则回到监听状态
                awakeTimeoutRef.current = setTimeout(() => {
                  if (stateRef.current === 'awakened') {
                    console.log('⏰ 超时未收到指令，回到监听状态')
                    updateState('listening')
                    setTranscript('')
                  }
                }, 30000) // 增加到30秒
                
              } catch (error) {
                console.error('❌ 重启识别失败:', error)
                setIsRestarting(false)
                // 识别启动失败，回到监听状态
                updateState('listening')
              }
            } else {
              console.log('❌ 无法重启识别，recording:', isRecordingRef.current)
              setIsRestarting(false)
              updateState('listening')
            }
          }, 1500) // 增加延迟时间，确保状态稳定
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
        const hasWakeWord = wakeWords.some(word => textToProcess.includes(word))
        
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
            
            // 停止当前识别
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

    recognition.onend = () => {
      console.log('🎤 语音识别结束，当前状态:', stateRef.current, '显示状态:', state, '录音中:', isRecordingRef.current, '重启中:', isRestartingRef.current)
      
      // 在 listening 状态下自动重启，playing 状态交给 executeCommand 处理
      if (stateRef.current === 'listening' && isRecordingRef.current && !isRestartingRef.current) {
        console.log('🔄 自动重启语音识别（listening状态）')
        setTimeout(() => {
          if (recognitionRef.current && isRecordingRef.current && !isRestartingRef.current) {
            try {
              recognitionRef.current.start()
              console.log('✅ 语音识别重启成功')
            } catch (error) {
              console.error('❌ 重启语音识别失败:', error)
            }
          }
        }, 100)
      } else if (stateRef.current === 'playing') {
        console.log('📀 playing状态下识别结束，由executeCommand负责重启')
      } else if (stateRef.current === 'processing') {
        console.log('🔄 processing状态下识别结束，由processCommandText负责重启')
      } else {
        console.log('⏸️ 跳过自动重启 - 状态:', stateRef.current, '录音中:', isRecordingRef.current, '重启中:', isRestartingRef.current)
      }
    }

    return true
  }, [state, wakeWords, isRecording, updateState, onTranscriptChange])

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
        
        if (bestMatch.confidence > 0.6) {
          // 高置信度，直接播放
          console.log('✅ 高置信度匹配，直接播放:', bestMatch.content)
          await executeCommand(bestMatch)
        } else if (bestMatch.confidence > 0.25) {
          // 中等置信度，显示候选列表
          console.log('🤔 中等置信度，显示候选列表')
          updateState('idle') // 让用户选择
          setTranscript(`找到 ${results.length} 个候选指令，请选择`)
          setClassificationResults(results.slice(0, 3)) // 显示前3个候选
        } else {
          // 低置信度，提示重试
          console.log('❓ 识别不确定，请重试')
          playNotificationSound('error')
          setTranscript('识别不确定，请重新说一遍')
          setTimeout(() => {
            updateState('listening')
            setTranscript('')
          }, 2000)
        }
      } else {
        console.log('❌ 没有找到匹配的指令')
        playNotificationSound('error')
        setTranscript('没有找到匹配的指令，请重试')
        setTimeout(() => {
          updateState('listening')
          setTranscript('')

          // 添加健壮的重启逻辑
          if (recognitionRef.current && isRecordingRef.current) {
            console.log('🔄 指令匹配失败，重启识别...')
            recognitionRef.current.abort()

            setTimeout(() => {
              if (isRecordingRef.current) { // 再次检查以防用户手动停止
                try {
                  recognitionRef.current.start()
                  console.log('✅ 匹配失败后重启识别成功')
                } catch (error) {
                  console.error('❌ 匹配失败后重启识别失败:', error)
                }
              }
            }, 100)
          }
        }, 2000)
      }
    } catch (error) {
      console.error('指令分类失败:', error)
      playNotificationSound('error')
      updateState('listening')
      
      // 分类失败时也需要重启语音识别
      if (recognitionRef.current && isRecordingRef.current) {
        console.log('🔄 指令分类异常，重启识别...')
        recognitionRef.current.abort()
        
        setTimeout(() => {
          if (isRecordingRef.current) {
            try {
              recognitionRef.current.start()
              console.log('✅ 分类异常后重启识别成功')
            } catch (restartError) {
              console.error('❌ 分类异常后重启识别失败:', restartError)
            }
          }
        }, 100)
      }
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
        
        if (bestMatch.confidence > 0.95) {
          // 高置信度，直接播放
          console.log('🎯 高置信度匹配:', bestMatch.content)
          await executeCommand(bestMatch)
        } else if (bestMatch.confidence > 0.7) {
          // 中等置信度，显示候选列表
          console.log('🤔 中等置信度，显示候选:', results)
          updateState('idle') // 回到空闲状态，让用户选择
        } else {
          // 低置信度，提示重试
          console.log('❓ 识别不确定，请重试')
          playNotificationSound('error')
          updateState('listening') // 回到监听状态
        }
      } else {
        updateState('listening')
      }
    } catch (error) {
      console.error('音频处理失败:', error)
      playNotificationSound('error')
      updateState('listening')
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
    
    // 播放完成后回到监听状态
    setTimeout(() => {
      if (isRecording) {
        updateState('listening')
        setTranscript('')
        setIsRestarting(true) // 设置重启状态，防止onend重复启动
        
        // 重启语音识别
        if (recognitionRef.current && isRecordingRef.current) {
          console.log('🔄 准备从 playing 状态重启识别...')
          
          // 1. 使用 abort() 强制结束当前会话，这比 stop() 更直接
          recognitionRef.current.abort()
          
          // 2. 短暂延迟后，安全地启动新的识别会话
          setTimeout(() => {
            // 再次检查用户是否在此期间手动停止了录音
            if (recognitionRef.current && isRecordingRef.current) {
              try {
                recognitionRef.current.start()
                console.log('✅ 播放后重启识别成功')
                setIsRestarting(false) // 启动成功后清除重启状态
              } catch (error) {
                console.error('❌ 播放后重启识别失败:', error)
                setIsRestarting(false)
                // 如果重启失败，可以考虑执行更完整的重置流程
                setTimeout(() => {
                  if (recognitionRef.current && isRecordingRef.current) {
                    try {
                      recognitionRef.current.start()
                      console.log('🔄 延迟重试启动成功')
                    } catch (retryError) {
                      console.error('❌ 延迟重试也失败:', retryError)
                    }
                  }
                }, 500)
              }
            } else {
              setIsRestarting(false)
            }
          }, 100) // 100毫秒的短延迟通常足够
        }
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
        minConfidence: 0.3,
        maxResults: 5,
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

        {/* 分类结果 */}
        {classificationResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">智能匹配结果</h4>
            {classificationResults.map((result, index) => (
              <div
                key={result.command_id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => selectCommand(result)}
              >
                <div className="flex-1">
                  <p className="font-medium">{result.content}</p>
                  <div className="flex space-x-4 text-xs text-gray-500 mt-1">
                    <span>置信度: {Math.round(result.confidence * 100)}%</span>
                    <span>相似度: {Math.round(result.similarity * 100)}%</span>
                    <span className={`px-1 rounded ${
                      result.matchType === 'exact' ? 'bg-green-100 text-green-800' :
                      result.matchType === 'semantic' ? 'bg-blue-100 text-blue-800' :
                      result.matchType === 'pinyin' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {result.matchType}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  选择
                </Button>
              </div>
            ))}
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
          <h4 className="text-sm font-medium text-gray-700 mb-2">支持的唤醒词</h4>
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
        </div>
      </CardContent>
    </Card>
  )
}

export default ModernVoiceControl
