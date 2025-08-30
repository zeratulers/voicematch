/**
 * KWS语音控制组件
 * 
 * 使用WebAssembly KWS关键词识别引擎的离线语音控制
 * 基于sherpa-onnx的实时关键词检测
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, AlertCircle, CheckCircle2, Loader2, Cpu } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { pinyin } from 'pinyin-pro'

// 语音控制状态
type KWSVoiceControlState = 
  | 'idle'        // 空闲状态
  | 'loading'     // 加载模型
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

// 关键词检测结果
interface KWSResult {
  keyword: string
  score: number
  timestamp: number
}

// 组件属性
interface KWSVoiceControlProps {
  commands: Command[]
  onPlayCommand: (commandId: string, content: string) => void
  onStateChange?: (state: KWSVoiceControlState) => void
  onKeywordDetected?: (keyword: string, score: number) => void
  onCommandPlayed?: (content: string) => void
  onVoiceLog?: (log: {
    keyword: string
    score: number
    status: 'success' | 'no_match' | 'error'
    matched_command_id?: string
    matched_command_content?: string
    processing_time_ms?: number
  }) => void
  keywords?: string[]  // 支持的关键词列表
  enabled?: boolean
  className?: string
  enablePinyinMatch?: boolean // 是否启用拼音匹配
  pinyinThreshold?: number // 拼音匹配阈值
}

// 声明全局变量
declare global {
  interface Window {
    Module: any
    createKws: any
  }
}

const KWSVoiceControl: React.FC<KWSVoiceControlProps> = ({
  commands,
  onPlayCommand,
  onStateChange,
  onKeywordDetected,
  onCommandPlayed,
  onVoiceLog,
  keywords = ['小爱同学', '发出指令', '播放指令'],
  enabled = true,
  className = '',
  enablePinyinMatch = true,
  pinyinThreshold = 0.55
}) => {
  // 状态管理
  const [state, setState] = useState<KWSVoiceControlState>('idle')
  const [isRecording, setIsRecording] = useState(false)
  const [lastDetectedKeyword, setLastDetectedKeyword] = useState<string>('')
  const [keywordScore, setKeywordScore] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [lastCommand, setLastCommand] = useState<string>('')
  const [modelLoaded, setModelLoaded] = useState(false)
  const [commandText, setCommandText] = useState<string>('')

  // 引用
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number>(0)
  const kwsRef = useRef<any>(null)
  const kwsStreamRef = useRef<any>(null)
  const stateRef = useRef<KWSVoiceControlState>('idle')
  const isRecordingRef = useRef<boolean>(false)
  const awakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const captureStartTimeRef = useRef<number>(0)

  // 音频配置
  const SAMPLE_RATE = 16000
  const BUFFER_SIZE = 4096
  const VOLUME_THRESHOLD = 0.05
  const SILENCE_DURATION = 1500 // 静音时长（毫秒）
  const MAX_CAPTURE_DURATION = 5000 // 最大捕获时长（毫秒）

  // 状态变更处理
  const updateState = useCallback((newState: KWSVoiceControlState) => {
    setState(newState)
    stateRef.current = newState
    onStateChange?.(newState)
    console.log(`🔄 KWS语音控制状态: ${newState}`)
  }, [onStateChange])

  // 获取状态样式
  const getStateStyle = (currentState: KWSVoiceControlState) => {
    const styles = {
      idle: 'bg-gray-100 border-gray-300 text-gray-700',
      loading: 'bg-yellow-100 border-yellow-300 text-yellow-700',
      listening: 'bg-blue-100 border-blue-300 text-blue-700',
      awakened: 'bg-orange-100 border-orange-300 text-orange-700',
      capturing: 'bg-purple-100 border-purple-300 text-purple-700',
      processing: 'bg-yellow-100 border-yellow-300 text-yellow-700',
      playing: 'bg-green-100 border-green-300 text-green-700'
    }
    return styles[currentState] || styles.idle
  }

  // 获取状态图标
  const getStateIcon = (currentState: KWSVoiceControlState) => {
    switch (currentState) {
      case 'idle':
        return <MicOff className="h-5 w-5" />
      case 'loading':
        return <Loader2 className="h-5 w-5 animate-spin" />
      case 'listening':
        return <Mic className="h-5 w-5 animate-pulse" />
      case 'awakened':
        return <Volume2 className="h-5 w-5 animate-bounce" />
      case 'capturing':
        return <Mic className="h-5 w-5 text-purple-600" />
      case 'processing':
        return <Cpu className="h-5 w-5 animate-pulse" />
      case 'playing':
        return <CheckCircle2 className="h-5 w-5" />
      default:
        return <AlertCircle className="h-5 w-5" />
    }
  }

  // 获取状态文本
  const getStateText = (currentState: KWSVoiceControlState) => {
    const texts = {
      idle: '等待启动',
      loading: '加载KWS模型...',
      listening: '监听唤醒词...',
      awakened: '请说出指令内容',
      capturing: '正在录制指令...',
      processing: '智能分析中...',
      playing: '播放指令完成'
    }
    return texts[currentState] || '未知状态'
  }

  // 文本转拼音（用于关键词匹配）
  const textToPinyin = (text: string): string => {
    try {
      const pinyinArray = pinyin(text, { 
        toneType: 'none',
        type: 'array'
      })
      const result = pinyinArray.join('').toLowerCase()
      console.log(`📝 拼音转换: "${text}" -> "${result}"`)
      return result
    } catch (error) {
      console.warn('拼音转换失败，使用原文本:', error)
      return text.toLowerCase()
    }
  }

  // 计算拼音相似度
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
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        )
      }
    }
    
    const maxLen = Math.max(len1, len2)
    return maxLen === 0 ? 1.0 : (maxLen - matrix[len1][len2]) / maxLen
  }

  // 规范化拼音（移除声调/符号，仅保留小写字母）
  const normalizePinyin = (text: string): string => {
    if (!text) return ''
    // NFD 分解后去掉附加符号（声调等），再仅保留 a-z
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
  }

  // 在指令列表中找到与文本最相近的指令（基于拼音相似度）
  const findBestMatchingCommand = useCallback((detectedText: string): { command: Command | null, similarity: number } => {
    // 对 KWS 返回文本做规范化（KWS 常为带声调的拉丁字符）
    const detectedPinyinRaw = textToPinyin(detectedText)
    const detectedPinyin = normalizePinyin(detectedPinyinRaw || detectedText)
    let best: { command: Command | null, similarity: number } = { command: null, similarity: 0 }
    
    for (const cmd of commands) {
      const cmdPinyinRaw = textToPinyin(cmd.content)
      const cmdPinyin = normalizePinyin(cmdPinyinRaw)
      const sim = calculatePinyinSimilarity(detectedPinyin, cmdPinyin)
      if (sim > best.similarity) {
        best = { command: cmd, similarity: sim }
      }
    }
    
    return best
  }, [commands])

  // 检查关键词匹配
  const checkKeywordMatch = (detectedKeyword: string, targetKeywords: string[]): { matched: boolean, similarity: number, matchType: 'exact' | 'pinyin' | 'none', matchedKeyword: string } => {
    // 将“小爱同学”始终纳入唤醒词集合
    const effectiveKeywords = Array.from(new Set([...(targetKeywords || []), '小爱同学']))
    // 1. 精确匹配
    for (const keyword of effectiveKeywords) {
      if (detectedKeyword.includes(keyword) || keyword.includes(detectedKeyword)) {
        return { matched: true, similarity: 1.0, matchType: 'exact', matchedKeyword: keyword }
      }
    }
    
    // 2. 拼音匹配
    if (enablePinyinMatch) {
      const detectedPinyin = textToPinyin(detectedKeyword)
      
      for (const keyword of effectiveKeywords) {
        const keywordPinyin = textToPinyin(keyword)
        const similarity = calculatePinyinSimilarity(detectedPinyin, keywordPinyin)
        
        if (similarity >= pinyinThreshold) {
          console.log(`🔤 拼音匹配: "${detectedKeyword}" -> "${keyword}" (相似度: ${(similarity * 100).toFixed(1)}%)`)
          return { matched: true, similarity, matchType: 'pinyin', matchedKeyword: keyword }
        }
      }
    }
    
    return { matched: false, similarity: 0.0, matchType: 'none', matchedKeyword: '' }
  }

  // 监听全局KWS准备就绪
  const initKWSModel = useCallback(async () => {
    if (modelLoaded) return true

    try {
      updateState('loading')
      console.log('🚀 检查全局KWS状态...')

      // 检查全局KWS是否已经准备好
      if ((window as any).KWS_READY && window.createKws && window.Module) {
        console.log('✅ 全局KWS已准备就绪');
        setModelLoaded(true);
        updateState('idle');
        return true;
      }

      // 监听KWS准备就绪事件
      return new Promise<boolean>((resolve) => {
        const handleKwsReady = () => {
          console.log('✅ 收到KWS准备就绪事件');
          if (window.createKws && window.Module) {
            setModelLoaded(true);
            updateState('idle');
            resolve(true);
          } else {
            console.error('❌ KWS事件触发但函数不可用');
            updateState('idle');
            resolve(false);
          }
        };

        // 添加事件监听器
        window.addEventListener('kws-ready', handleKwsReady, { once: true });

        // 设置超时
        setTimeout(() => {
          window.removeEventListener('kws-ready', handleKwsReady);
          console.warn('⏰ 等待KWS超时');
          updateState('idle');
          resolve(false);
        }, 10000);

        console.log('⏳ 等待全局KWS初始化完成...');
      });
    } catch (error) {
      console.error('❌ KWS模型检查失败:', error);
      updateState('idle');
      return false;
    }
  }, [modelLoaded, updateState])



  // 初始化音频上下文
  const initAudioContext = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: SAMPLE_RATE
        } 
      })

      mediaStreamRef.current = stream
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE })
      analyserRef.current = audioContextRef.current.createAnalyser()
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      
      analyserRef.current.fftSize = 512
      analyserRef.current.smoothingTimeConstant = 0.8
      
      microphoneRef.current.connect(analyserRef.current)

      // 创建ScriptProcessor用于音频处理
      scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(
        BUFFER_SIZE, 1, 1
      )

      scriptProcessorRef.current.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer
        const samples = new Float32Array(inputBuffer.getChannelData(0))
        
        // 更新音频级别
        const average = samples.reduce((sum, value) => sum + Math.abs(value), 0) / samples.length
        setAudioLevel(average)
        
        // 调试：偶尔打印状态对比，便于排查闭包状态过期问题
        if (Math.random() < 0.02) {
          console.log('🎵 音频回调状态快照 -> stateRef:', stateRef.current, 'isRecordingRef:', isRecordingRef.current)
        }
        
        // 在 awakened 状态下不再通过音量触发录制，改为等待 KWS 下一条结果
        if (stateRef.current === 'awakened') {
          // no-op: 使用KWS下一条结果进行指令匹配
        }
        
        // 在 capturing 状态下检测静音
        if (stateRef.current === 'capturing') {
          // 更新命令文本（这里模拟从音频中提取文本）
          // 在实际应用中，这里应该使用语音识别API
          if (average > VOLUME_THRESHOLD) {
            // 模拟语音识别结果，在实际应用中应替换为真实的语音识别
            setCommandText(prev => prev + (prev ? ' ' : '') + '测试指令')
            
            // 重置静音计时器
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current)
              silenceTimerRef.current = null
            }
          } else {
            // 检测静音
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                stopCapturing()
              }, SILENCE_DURATION)
            }
          }
          
          // 检查最大录制时长
          const duration = Date.now() - captureStartTimeRef.current
          if (duration > MAX_CAPTURE_DURATION) {
            stopCapturing()
          }
        }

        // 处理KWS音频 - 在 listening/awakened 两种状态均处理
        if (kwsRef.current && kwsStreamRef.current && isRecordingRef.current && (stateRef.current === 'listening' || stateRef.current === 'awakened')) {
          try {
            // 重采样到16kHz（如果需要）
            const resampledSamples = downsampleBuffer(samples, SAMPLE_RATE)
            
            // 发送音频到KWS - 按照原始示例的方式
            kwsStreamRef.current.acceptWaveform(SAMPLE_RATE, resampledSamples)
            
            // 检查是否有结果 - 按照原始示例的处理逻辑
            while (kwsRef.current.isReady(kwsStreamRef.current)) {
              kwsRef.current.decode(kwsStreamRef.current)
              const result = kwsRef.current.getResult(kwsStreamRef.current)
              
              // 详细调试KWS结果对象
              if (result && result.keyword.length > 0) {
                console.log('🔍 KWS结果详细信息:', JSON.stringify(result, null, 2));
                
                // 统一提取文本（keyword 优先，其次 text）
                const raw = (result.keyword || result.text || '') as string
                const keywordStr = (raw || '').trim()
                const isZeroWidthOrEmpty = keywordStr.replace(/\u200B/g, '').trim().length === 0
                
                // 显示实时识别文本（用于 UI 反馈）
                if (keywordStr.length > 0 && !isZeroWidthOrEmpty) {
                  setCommandText(keywordStr)
                }
                
                if (stateRef.current === 'listening') {
                  // 在监听状态，仅对唤醒词进行处理
                  if (!isZeroWidthOrEmpty && keywordStr.length > 0) {
                    const match = checkKeywordMatch(keywordStr, keywords)
                    console.log('🧭 唤醒匹配调试: input=', keywordStr, ' keywords=', keywords)
                    if (match.matched) {
                      console.log('🎯 检测到唤醒词:', keywordStr, '→', match.matchedKeyword)
                      handleKeywordDetected(match.matchedKeyword, result.score || 0.5)
                      // 重置流，准备接收下一条命令
                      kwsRef.current.reset(kwsStreamRef.current)
                      break
                    }
                  }
                } else if (stateRef.current === 'awakened') {
                  // 在唤醒状态，尝试将结果匹配到指令
                  if (!isZeroWidthOrEmpty && keywordStr.length > 0) {
                    const { command: bestCommand, similarity } = findBestMatchingCommand(keywordStr)
                    console.log(`🧠 指令匹配: 输入="${keywordStr}" 相似度=${(similarity * 100).toFixed(1)}%`)
                    if (bestCommand && similarity >= pinyinThreshold) {
                      console.log('✅ 匹配到最佳指令:', bestCommand.content)
                      // 记录成功日志
                      onVoiceLog?.({
                        keyword: keywordStr,
                        score: similarity,
                        status: 'success',
                        matched_command_id: bestCommand.command_id,
                        matched_command_content: bestCommand.content,
                        processing_time_ms: undefined
                      })
                      // 执行指令（无需等待）
                      void executeCommand(bestCommand)
                      // 重置流，避免旧内容残留
                      kwsRef.current.reset(kwsStreamRef.current)
                      break
                    } else {
                      console.log('❌ 未能匹配到足够相似的指令，阈值=', pinyinThreshold)
                      onVoiceLog?.({
                        keyword: keywordStr,
                        score: similarity,
                        status: 'no_match',
                        processing_time_ms: undefined
                      })
                      // 稍后回到监听状态
                      setTimeout(() => {
                        updateState('listening')
                      }, 1500)
                      // 重置流以继续
                      kwsRef.current.reset(kwsStreamRef.current)
                      break
                    }
                  } else {
                    // 空结果，忽略
                    if (Math.random() < 0.05) {
                      console.log('🕳️ KWS返回空/零宽字符，忽略本次结果')
                    }
                  }
                }
              }
            }
            
            // 添加更频繁的调试信息来监控音频流
            if (Math.random() < 0.1) { // 10% 的概率输出调试信息
              const isReady = kwsRef.current.isReady(kwsStreamRef.current);
              console.log(`🔊 KWS状态 - 音量: ${(average * 100).toFixed(1)}%, isReady: ${isReady}, 采样数: ${resampledSamples.length}`);
            }
          } catch (error) {
            console.error('KWS音频处理错误:', error)
          }
        }
      }

      microphoneRef.current.connect(scriptProcessorRef.current)
      scriptProcessorRef.current.connect(audioContextRef.current.destination)

      return true
    } catch (error) {
      console.error('初始化音频上下文失败:', error)
      return false
    }
  }, [])

  // 音频重采样
  const downsampleBuffer = (buffer: Float32Array, targetSampleRate: number): Float32Array => {
    if (audioContextRef.current?.sampleRate === targetSampleRate) {
      return buffer
    }
    
    const ratio = (audioContextRef.current?.sampleRate || 44100) / targetSampleRate
    const newLength = Math.round(buffer.length / ratio)
    const result = new Float32Array(newLength)
    
    for (let i = 0; i < newLength; i++) {
      const index = Math.round(i * ratio)
      result[i] = buffer[index] || 0
    }
    
    return result
  }

  // 处理关键词检测
  const handleKeywordDetected = useCallback((keyword: string, score: number) => {
    console.log(`🎯 检测到唤醒词: "${keyword}" (置信度: ${(score * 100).toFixed(1)}%)`)
    
    setLastDetectedKeyword(keyword)
    setKeywordScore(score)
    onKeywordDetected?.(keyword, score)
    
    // 检查关键词匹配
    const matchResult = checkKeywordMatch(keyword, keywords)
    
    if (matchResult.matched) {
      console.log(`✅ 唤醒词匹配成功: "${keyword}" -> "${matchResult.matchedKeyword}"`)
      
      // 进入已唤醒状态，等待指令
      updateState('awakened')
      
      // 播放提示音
      playNotificationSound('awakened')
      
      // 设置超时，如果长时间没收到指令，则返回 listening 状态
      setTimeout(() => {
        if (stateRef.current === 'awakened') {
          console.log('⏰ 长时间未收到指令，回到 listening 状态')
          updateState('listening')
        }
      }, 30000)
    } else {
      console.log(`❌ 唤醒词不匹配: "${keyword}"`)
      
      // 延迟回到监听状态
      setTimeout(() => {
        updateState('listening')
      }, 2000)
    }
  }, [keywords, updateState, onKeywordDetected, checkKeywordMatch])

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

  // 开始捕获命令
  const startCapturing = () => {
    if (stateRef.current !== 'awakened') {
      console.log('⛔ 忽略开始捕获：当前非 awakened 状态，实际状态为', stateRef.current)
      return
    }

    updateState('capturing')
    captureStartTimeRef.current = Date.now()
    setCommandText('')
    
    console.log('🎯 开始捕获指令音频')
  }

  // 停止捕获
  const stopCapturing = () => {
    if (stateRef.current !== 'capturing') {
      console.log('⛔ 忽略停止捕获：当前非 capturing 状态，实际状态为', stateRef.current)
      return
    }

    updateState('processing')
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    
    console.log('✂️ 完成音频捕获，开始处理')
    
    // 处理捕获的命令
    if (commandText) {
      processCommandText(commandText)
    } else {
      // 没有检测到有效的命令文本，回到唤醒状态
      setTimeout(() => {
        updateState('awakened')
      }, 1000)
    }
  }

  // 处理命令文本
  const processCommandText = useCallback(async (text: string) => {
    try {
      console.log('🔍 开始处理命令文本:', text)
      const startTime = Date.now()
      
      // 这里可以根据文本匹配相应的指令
      // 暂时使用第一个可用指令作为示例
      if (commands.length > 0) {
        const command = commands[0]
        console.log('🎯 匹配到指令:', command.content)
        
        // 记录成功日志
        onVoiceLog?.({
          keyword: text,
          score: 0.8,
          status: 'success',
          matched_command_id: command.command_id,
          matched_command_content: command.content,
          processing_time_ms: Date.now() - startTime
        })
        
        // 执行指令
        await executeCommand(command)
      } else {
        console.log('❌ 没有可用的指令')
        
        // 记录无匹配日志
        onVoiceLog?.({
          keyword: text,
          score: 0,
          status: 'no_match',
          processing_time_ms: Date.now() - startTime
        })
        
        // 延迟回到监听状态
        setTimeout(() => {
          updateState('listening')
        }, 2000)
      }
    } catch (error) {
      console.error('处理命令文本失败:', error)
      
      // 记录错误日志
      onVoiceLog?.({
        keyword: text,
        score: 0,
        status: 'error',
        processing_time_ms: 0
      })
      
      // 延迟回到监听状态
      setTimeout(() => {
        updateState('listening')
      }, 2000)
    }
  }, [commands, updateState, onVoiceLog])

  // 执行指令
  const executeCommand = async (command: Command) => {
    updateState('playing')
    setLastCommand(command.content)
    
    onPlayCommand(command.command_id, command.content)
    onCommandPlayed?.(command.content)
    
    console.log('▶️ 开始播放指令:', command.content)
    
    // 播放完成后回到监听状态
    setTimeout(() => {
      if (isRecordingRef.current) {
        console.log('🔄 播放完成，回到监听状态')
        updateState('listening')
      }
    }, 3000)
  }

  // 开始录音
  const startRecording = async () => {
    if (!enabled || isRecording || !modelLoaded) return

    const audioInitialized = await initAudioContext()
    if (!audioInitialized) {
      console.error('音频初始化失败')
      return
    }

    // 创建KWS实例
    try {
      // 简单检查全局KWS是否可用
      if (!window.createKws || !window.Module) {
        console.error('❌ 全局KWS不可用');
        throw new Error('全局KWS不可用');
      }
      
      console.log('✅ 全局KWS可用，开始创建实例');
      
      // 配置关键词，格式：'拼音 @中文'，每行一个
      const kwsConfig = {
        featConfig: {
          samplingRate: SAMPLE_RATE,
          featureDim: 80,
        },
        modelConfig: {
          transducer: {
            encoder: 'encoder-epoch-12-avg-2-chunk-16-left-64.onnx',
            decoder: 'decoder-epoch-12-avg-2-chunk-16-left-64.onnx',
            joiner: 'joiner-epoch-12-avg-2-chunk-16-left-64.onnx',
          },
          tokens: 'tokens.txt',
          provider: 'cpu',
          numThreads: 1,
          debug: 1,
          modelingUnit: 'cjkchar',
        },
        maxActivePaths: 4,
        numTrailingBlanks: 1,
        keywordsScore: 1.0,
        keywordsThreshold: 0.25,
        // 关键词配置，格式：'拼音 @中文'
        keywords: keywords.map(word => {
          // 将中文转换为拼音，格式：'f a c h u z h i l i n g @发出指令'
          const pinyinText = textToPinyin(word).split('').join(' ');
          return `${pinyinText} @${word}`;
        }).join('\n')
      };
      
      console.log('🔧 KWS配置:', kwsConfig);
      console.log('🔧 关键词列表:', kwsConfig.keywords);
      
      // 完全按照原始示例的方式调用 - 只传Module参数，不传配置
      kwsRef.current = window.createKws(window.Module)
      kwsStreamRef.current = kwsRef.current.createStream()
      
      console.log('✅ KWS实例创建成功')
      console.log('🔧 KWS实例:', kwsRef.current)
      console.log('🔧 KWS流:', kwsStreamRef.current)
    } catch (error) {
      console.error('❌ KWS实例创建失败:', error)
      return
    }

    setIsRecording(true)
    isRecordingRef.current = true
    setCommandText('') // 清空之前的识别结果
    updateState('listening')
    
    console.log('🎤 开始KWS语音监听')
  }

  // 停止录音
  const stopRecording = () => {
    setIsRecording(false)
    isRecordingRef.current = false
    updateState('idle')

    // 清理KWS资源
    if (kwsStreamRef.current && kwsRef.current) {
      try {
        kwsRef.current.free()
        kwsRef.current = null
        kwsStreamRef.current = null
      } catch (error) {
        console.warn('清理KWS资源时出错:', error)
      }
    }

    // 停止音频处理
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect()
      scriptProcessorRef.current = null
    }

    // 停止音频监控
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // 关闭音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // 停止媒体流
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    setLastDetectedKeyword('')
    setKeywordScore(0)
    setAudioLevel(0)
    
    console.log('🛑 停止KWS语音监听')
  }

  // 初始化KWS模型
  useEffect(() => {
    if (enabled) {
      initKWSModel()
    }
  }, [enabled, initKWSModel])

  // 组件卸载清理
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Cpu className="h-5 w-5 mr-2" />
            <span>KWS语音控制</span>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStateStyle(state)}`}>
            {getStateText(state)}
          </div>
        </CardTitle>
        <CardDescription>
          WebAssembly KWS关键词识别引擎 - {commands.length} 个可用指令
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 主控制按钮 */}
        <div className="flex justify-center">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={!enabled || !modelLoaded || commands.length === 0}
              size="lg"
              className="w-32 h-32 rounded-full bg-purple-500 hover:bg-purple-600 text-white"
            >
              <div className="text-center">
                <Mic className="h-8 w-8 mx-auto mb-2" />
                <span className="text-sm">开始监听</span>
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
                <span className="text-sm">停止监听</span>
              </div>
            </Button>
          )}
        </div>

        {/* 状态展示 */}
        {isRecording && (
          <div className={`p-4 rounded-lg border-2 ${
            state === 'listening' ? 'bg-blue-50 border-blue-300' :
            state === 'awakened' ? 'bg-orange-50 border-orange-300' :
            state === 'capturing' ? 'bg-purple-50 border-purple-300' :
            state === 'processing' ? 'bg-yellow-50 border-yellow-300' :
            state === 'playing' ? 'bg-green-50 border-green-300' :
            'bg-gray-50 border-gray-300'
          }`}>
            <div className="flex items-center justify-center mb-3">
              {getStateIcon(state)}
              <span className={`text-sm font-medium ml-2 ${
                state === 'listening' ? 'text-blue-700' :
                state === 'awakened' ? 'text-orange-700' :
                state === 'capturing' ? 'text-purple-700' :
                state === 'processing' ? 'text-yellow-700' :
                state === 'playing' ? 'text-green-700' :
                'text-gray-700'
              }`}>
                {getStateText(state)}
              </span>
            </div>
            
            {/* 状态特定的视觉反馈 */}
            {state === 'listening' && (
              <>
                <div className="flex items-center justify-center space-x-1 h-16">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-blue-400 rounded-full transition-all duration-75"
                      style={{
                        width: '4px',
                        height: `${Math.max(4, audioLevel * 60 * (Math.random() * 0.5 + 0.5))}px`,
                        opacity: audioLevel > VOLUME_THRESHOLD ? 0.8 : 0.3
                      }}
                    />
                  ))}
                </div>
                <div className="text-center mt-2 text-xs text-blue-600">
                  音量: {Math.round(audioLevel * 100)}% | 等待关键词...
                </div>
                {/* 显示实时识别的拼音/文本 */}
                {commandText && (
                  <div className="text-center mt-2 p-2 bg-blue-100 rounded">
                    <div className="text-xs text-blue-500">实时识别:</div>
                    <div className="text-sm text-blue-700 font-mono">{commandText}</div>
                  </div>
                )}
              </>
            )}

            {state === 'awakened' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-orange-200 rounded-full flex items-center justify-center">
                  <Volume2 className="h-8 w-8 text-orange-600 animate-bounce" />
                </div>
                <p className="text-orange-700 font-medium">系统已唤醒，请说出指令内容</p>
                <p className="text-sm text-orange-600 mt-1">唤醒词: "{lastDetectedKeyword}"</p>
              </div>
            )}

            {state === 'capturing' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-200 rounded-full flex items-center justify-center">
                  <Mic className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-purple-700 font-medium">正在录制指令...</p>
                <p className="text-sm text-purple-600 mt-1">已捕获: {commandText || '等待语音输入...'}</p>
              </div>
            )}

            {state === 'processing' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-200 rounded-full flex items-center justify-center">
                  <Cpu className="h-8 w-8 text-yellow-600 animate-pulse" />
                </div>
                <p className="text-yellow-700 font-medium">正在智能分析指令...</p>
              </div>
            )}

            {state === 'playing' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-200 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-green-700 font-medium">指令播放完成</p>
                <p className="text-sm text-green-600 mt-1">准备下一个关键词...</p>
              </div>
            )}
          </div>
        )}

        {/* 最后检测的关键词 */}
        {lastDetectedKeyword && (
          <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              <Volume2 className="h-4 w-4 mr-2 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">最后检测</span>
            </div>
            <p className="text-orange-700">{lastDetectedKeyword}</p>
            <p className="text-xs text-orange-600 mt-1">置信度: {(keywordScore * 100).toFixed(1)}%</p>
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

        {/* 支持的关键词提示 */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">支持的关键词</h4>
            {enablePinyinMatch && (
              <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                🔤 拼音匹配已启用
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600"
              >
                "{keyword}"
              </span>
            ))}
          </div>
          {enablePinyinMatch && (
            <div className="mt-2 text-xs text-gray-500">
              💡 支持发音相似但文字不同的关键词识别
            </div>
          )}
        </div>

        {/* 模型状态 */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-blue-700">KWS模型状态</h4>
            <span className={`text-xs px-2 py-1 rounded-full ${
              modelLoaded 
                ? 'text-green-600 bg-green-100' 
                : 'text-yellow-600 bg-yellow-100'
            }`}>
              {modelLoaded ? '已加载' : '加载中...'}
            </span>
          </div>
          <div className="text-xs text-blue-600 space-y-1">
            <p>• 引擎: WebAssembly KWS</p>
            <p>• 采样率: {SAMPLE_RATE}Hz</p>
            <p>• 缓冲区: {BUFFER_SIZE} 样本</p>
            <p>• 处理: 实时音频流</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default KWSVoiceControl

