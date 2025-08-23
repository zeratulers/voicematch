/**
 * 音频录制组件
 * 用于录制、预览和上传音频文件
 */

import React, { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Play, Pause, Square, Upload, Trash2, Volume2 } from 'lucide-react'
import { Button } from './Button'
import { Card, CardContent } from './Card'

interface AudioRecorderProps {
  onAudioChange?: (audioBlob: Blob | null, audioUrl?: string) => void
  initialAudioUrl?: string
  disabled?: boolean
  maxDuration?: number // 最大录制时长（秒）
  className?: string
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioChange,
  initialAudioUrl,
  disabled = false,
  maxDuration = 60,
  className = ''
}) => {
  // 状态管理
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl || null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  // 引用
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number>(0)
  const recordingStartTimeRef = useRef<number>(0)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 清理函数
  const cleanup = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
    }
  }

  // 组件卸载时清理
  useEffect(() => {
    return cleanup
  }, [])

  // 监控音频级别
  const monitorAudioLevel = () => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    const normalizedLevel = average / 255
    
    setAudioLevel(normalizedLevel)
    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel)
  }

  // 开始录制
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })

      // 创建音频上下文用于可视化
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      // 创建录音器
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        onAudioChange?.(audioBlob, url)

        // 停止所有轨道
        stream.getTracks().forEach(track => track.stop())
      }

      setIsRecording(true)
      recordingStartTimeRef.current = Date.now()
      setDuration(0)
      
      // 开始录制
      mediaRecorderRef.current.start()
      
      // 开始音频监控
      monitorAudioLevel()

      // 开始计时器
      durationTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000
        setDuration(elapsed)
        
        // 检查是否超过最大时长
        if (elapsed >= maxDuration) {
          stopRecording()
        }
      }, 100)

    } catch (error) {
      console.error('录制启动失败:', error)
      alert('无法访问麦克风，请检查权限设置')
    }
  }

  // 停止录制
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
    
    setIsRecording(false)
    setAudioLevel(0)
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  // 播放音频
  const playAudio = () => {
    if (!audioUrl) return

    if (audioRef.current) {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  // 暂停音频
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  // 删除录音
  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioUrl(null)
    setDuration(0)
    setCurrentTime(0)
    onAudioChange?.(null)
  }

  // 处理音频加载
  const handleAudioLoad = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0)
    }
  }

  // 处理音频时间更新
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  // 处理音频结束
  const handleAudioEnd = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card className={`${className}`}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* 录制控制 */}
          <div className="flex items-center justify-center space-x-3">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                disabled={disabled}
                variant="outline"
                size="lg"
                className="flex items-center space-x-2"
              >
                <Mic className="h-5 w-5" />
                <span>开始录制</span>
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="lg"
                className="flex items-center space-x-2"
              >
                <Square className="h-5 w-5" />
                <span>停止录制</span>
              </Button>
            )}
          </div>

          {/* 录制状态显示 */}
          {isRecording && (
            <div className="space-y-3">
              {/* 音频波形可视化 */}
              <div className="flex items-center justify-center space-x-1 h-12 bg-red-50 border border-red-200 rounded-lg p-2">
                <div className="flex items-center space-x-1">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-red-400 rounded-full transition-all duration-75"
                      style={{
                        width: '3px',
                        height: `${Math.max(4, audioLevel * 40 * (Math.random() * 0.5 + 0.5))}px`,
                        opacity: audioLevel > 0.05 ? 0.8 : 0.3
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 录制信息 */}
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center space-x-2 text-red-600">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="font-medium">正在录制</span>
                </div>
                <div className="text-sm text-gray-600">
                  {formatTime(duration)} / {formatTime(maxDuration)}
                </div>
              </div>
            </div>
          )}

          {/* 音频播放控制 */}
          {audioUrl && !isRecording && (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-3">
                {!isPlaying ? (
                  <Button
                    onClick={playAudio}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Play className="h-4 w-4" />
                    <span>播放</span>
                  </Button>
                ) : (
                  <Button
                    onClick={pauseAudio}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Pause className="h-4 w-4" />
                    <span>暂停</span>
                  </Button>
                )}

                <Button
                  onClick={deleteRecording}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2 text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>删除</span>
                </Button>
              </div>

              {/* 播放进度 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div 
                    className="bg-blue-600 h-1 rounded-full transition-all duration-100"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* 音频元素 */}
              <audio
                ref={audioRef}
                src={audioUrl}
                onLoadedMetadata={handleAudioLoad}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleAudioEnd}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* 使用说明 */}
          {!audioUrl && !isRecording && (
            <div className="text-center text-sm text-gray-500 py-4">
              <Volume2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>点击"开始录制"录制音频</p>
              <p className="text-xs mt-1">最长可录制 {maxDuration} 秒</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default AudioRecorder
