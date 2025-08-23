/**
 * 调试版语音控制组件
 * 专门用于调试唤醒词检测问题
 */

import React, { useState, useRef, useCallback } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'

const DebugVoiceControl: React.FC = () => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [state, setState] = useState<'idle' | 'listening' | 'awakened'>('idle')
  const [logs, setLogs] = useState<string[]>([])
  
  const recognitionRef = useRef<any>(null)
  const stateRef = useRef<'idle' | 'listening' | 'awakened'>('idle')
  const wakeWords = ['发出指令', '播放指令', '开始指令']

  // 同步状态到ref
  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-20), `[${timestamp}] ${message}`])
    console.log(message)
  }

  const playBeep = (frequency: number) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
      
      oscillator.onended = () => {
        audioContext.close()
      }
      
      addLog(`🔔 播放提示音: ${frequency}Hz`)
    } catch (error) {
      addLog(`❌ 提示音播放失败: ${error}`)
    }
  }

  const startListening = useCallback(async () => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
      addLog('❌ 浏览器不支持语音识别')
      return
    }

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      
      const recognition = recognitionRef.current
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'zh-CN'

      recognition.onstart = () => {
        addLog('🎤 语音识别已启动')
        setIsListening(true)
        setState('listening')
        playBeep(800)
      }

      recognition.onresult = (event: any) => {
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
        setTranscript(fullTranscript)
        
        addLog(`📝 识别结果: "${fullTranscript}" (final: ${!!finalTranscript}, interim: ${!!interimTranscript})`)

        // 检查唤醒词 - 使用ref获取最新状态
        addLog(`🔍 检查唤醒词 - 当前状态: ${stateRef.current}, 文本: "${fullTranscript}"`)
        
        if (stateRef.current === 'listening' && fullTranscript) {
          const matchedWord = wakeWords.find(word => {
            const hasMatch = fullTranscript.includes(word)
            addLog(`🔎 检查唤醒词 "${word}": ${hasMatch ? '匹配' : '不匹配'}`)
            return hasMatch
          })
          
          if (matchedWord) {
            addLog(`🎯 检测到唤醒词: "${matchedWord}" 在 "${fullTranscript}"`)
            setState('awakened')
            setTranscript('已唤醒！')
            playBeep(1000)
            
            // 2秒后回到监听状态
            setTimeout(() => {
              setState('listening')
              setTranscript('')
              addLog('🔄 回到监听状态')
            }, 2000)
          } else {
            addLog(`❌ 没有匹配的唤醒词`)
          }
        } else {
          addLog(`⏸️ 跳过检查 - 状态: ${stateRef.current}, 文本长度: ${fullTranscript.length}`)
        }
      }

      recognition.onerror = (event: any) => {
        addLog(`❌ 语音识别错误: ${event.error}`)
      }

      recognition.onend = () => {
        addLog('🛑 语音识别结束')
        if (isListening && state === 'listening') {
          addLog('🔄 自动重启语音识别')
          setTimeout(() => {
            if (recognitionRef.current && isListening) {
              recognitionRef.current.start()
            }
          }, 100)
        }
      }

      recognition.start()
    } catch (error) {
      addLog(`❌ 启动失败: ${error}`)
    }
  }, [state, isListening])

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
    setState('idle')
    setTranscript('')
    addLog('🛑 手动停止语音识别')
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>🐛 语音控制调试器</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 控制按钮 */}
          <div className="flex space-x-2">
            {!isListening ? (
              <Button onClick={startListening} className="flex items-center space-x-2">
                <Mic className="h-4 w-4" />
                <span>开始监听</span>
              </Button>
            ) : (
              <Button onClick={stopListening} variant="destructive" className="flex items-center space-x-2">
                <MicOff className="h-4 w-4" />
                <span>停止监听</span>
              </Button>
            )}
            <Button onClick={clearLogs} variant="outline">
              清除日志
            </Button>
          </div>

          {/* 状态显示 */}
          <div className={`p-3 rounded border-2 ${
            state === 'idle' ? 'bg-gray-50 border-gray-300' :
            state === 'listening' ? 'bg-blue-50 border-blue-300' :
            'bg-orange-50 border-orange-300'
          }`}>
            <div className="font-medium">
              状态: {state === 'idle' ? '空闲' : state === 'listening' ? '监听中' : '已唤醒'}
            </div>
            <div className="text-sm text-gray-600">
              转录: "{transcript}"
            </div>
          </div>

          {/* 唤醒词列表 */}
          <div className="p-3 bg-gray-50 rounded">
            <div className="font-medium mb-2">支持的唤醒词:</div>
            <div className="flex flex-wrap gap-2">
              {wakeWords.map((word, index) => (
                <span key={index} className="px-2 py-1 bg-white border rounded text-sm">
                  "{word}"
                </span>
              ))}
            </div>
          </div>

          {/* 实时日志 */}
          <div className="space-y-2">
            <div className="font-medium">实时日志:</div>
            <div className="bg-black text-green-400 p-3 rounded text-xs font-mono h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">等待日志...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DebugVoiceControl
