/**
 * 术中控制台页面
 * 
 * 实时语音识别和指令播放
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Mic, 
  Play, 
  Users,
  Command as CommandIcon,
  AlertCircle,
  Search,
  Lock,
  Unlock,
  X,
  Loader2,
  Square
} from 'lucide-react'

import { apiClient } from '../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import type { Patient } from '../types/patient'
import { formatGender } from '../utils/gender'
import { ModernVoiceControl } from '../components/voice'
import VoiceControlSettings, { VoiceControlMode } from '../components/voice/VoiceControlSettings'
import VoiceLogsDisplay from '../components/voice/VoiceLogsDisplay'
import CommandPlaybackConfirm from '../components/voice/CommandPlaybackConfirm'
import type { VoiceLogCreate } from '../types/voice-log'

const ORConsolePage: React.FC = () => {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isPatientLocked, setIsPatientLocked] = useState(false)
  const [showPatientSearch, setShowPatientSearch] = useState(false)
  const [patientSearchTerm, setPatientSearchTerm] = useState('')
  const [lastPlayedCommand, setLastPlayedCommand] = useState<string | null>(null)
  const [audioCache, setAudioCache] = useState<Map<string, HTMLAudioElement>>(new Map())
  const [isPreloadingAudio, setIsPreloadingAudio] = useState(false)
  const [preloadProgress, setPreloadProgress] = useState(0)
  
  // 语音控制相关状态
  const [voiceControlMode, setVoiceControlMode] = useState<VoiceControlMode>('offline')
  const [voiceControlEnabled, setVoiceControlEnabled] = useState(false)
  
  // 指令播放确认界面状态
  const [showPlaybackConfirm, setShowPlaybackConfirm] = useState(false)
  const [pendingCommand, setPendingCommand] = useState<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  
  // 语音日志相关状态
  const [voiceLogs, setVoiceLogs] = useState<VoiceLogCreate[]>([])
  const [lastUploadTime, setLastUploadTime] = useState<number>(Date.now())

  // 使用ref保存最新状态，避免闭包问题
  const stateRef = useRef({
    isPatientLocked: false,
    playableCommands: null as any,
    audioCache: new Map(),
    selectedPatient: null as Patient | null
  })

  // 获取患者列表（用于搜索）
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-search', patientSearchTerm],
    queryFn: () => apiClient.getPatients({ 
      size: 50, 
      search: patientSearchTerm || undefined 
    }),
    enabled: showPatientSearch,
  })

  // 获取选中患者的可播放指令
  const { data: playableCommands, isLoading: commandsLoading } = useQuery<{
    patient_id: number;
    patient_name: string;
    total_commands: number;
    commands: Array<{
      command_id: string;
      content: string;
      description?: string;
      audio_url: string;
      duration_ms?: number;
      dialect_label: string;
      speaker_name: string;
      variant_id: number;
    }>;
  }>({
    queryKey: ['playable-commands', selectedPatient?.id],
    queryFn: () => apiClient.getPatientPlayableCommands(selectedPatient!.id),
    enabled: !!selectedPatient,
  })

  // 患者选择和锁定相关函数
  const handleSelectPatient = (patient: Patient) => {
    if (!isPatientLocked) {
      setSelectedPatient(patient)
      setShowPatientSearch(false)
      setPatientSearchTerm('')
      // 清空语音日志缓存
      setVoiceLogs([])
      setLastUploadTime(Date.now())
    }
  }

  const handleLockPatient = async () => {
    if (selectedPatient) {
      setIsPatientLocked(true)
      stateRef.current.isPatientLocked = true
      stateRef.current.selectedPatient = selectedPatient
      
      // 预加载音频文件
      await preloadAudioFiles()
    }
  }

  const handleUnlockPatient = () => {
    // 停止当前播放的音频
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
    }
    
    setIsPlaying(false)
    setShowPlaybackConfirm(false)
    setPendingCommand(null)
    setIsPatientLocked(false)
    stateRef.current.isPatientLocked = false
    stateRef.current.selectedPatient = null
    
    // 上传语音日志
    uploadVoiceLogs()
  }

  // 预加载音频文件
  const preloadAudioFiles = async () => {
    if (!playableCommands?.commands) return
    
    setIsPreloadingAudio(true)
    setPreloadProgress(0)
    
    const newAudioCache = new Map()
    const totalCommands = playableCommands.commands.length
    
    for (let i = 0; i < totalCommands; i++) {
      const command = playableCommands.commands[i]
      try {
        const audio = new Audio(command.audio_url)
        audio.preload = 'auto'
        
        // 等待音频加载完成
        await new Promise((resolve, reject) => {
          audio.addEventListener('canplaythrough', resolve, { once: true })
          audio.addEventListener('error', reject, { once: true })
          audio.load()
        })
        
        newAudioCache.set(command.command_id, audio)
        setPreloadProgress(((i + 1) / totalCommands) * 100)
      } catch (error) {
        console.warn(`音频预加载失败: ${command.audio_url}`, error)
      }
    }
    
    setAudioCache(newAudioCache)
    stateRef.current.audioCache = newAudioCache
    setIsPreloadingAudio(false)
  }

  // 手动播放指令
  const handleManualPlay = (commandId: string) => {
    const command = playableCommands?.commands.find(cmd => cmd.command_id === commandId)
    if (!command) return
    
    setPendingCommand(command)
    setShowPlaybackConfirm(true)
  }

  // 确认播放指令
  const handleConfirmPlayback = () => {
    if (!pendingCommand) return
    
    const audio = audioCache.get(pendingCommand.command_id)
    if (!audio) {
      console.error('音频文件未找到:', pendingCommand.command_id)
      return
    }
    
    setIsPlaying(true)
    setCurrentAudio(audio)
    
    // 播放音频
    audio.currentTime = 0
    audio.play()
    
    // 监听播放结束
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentAudio(null)
      setShowPlaybackConfirm(false)
      setPendingCommand(null)
      setLastPlayedCommand(pendingCommand.content)
      
      // 记录播放日志
      addVoiceLog({
        transcript: `手动播放: ${pendingCommand.content}`,
        confidence: 1.0,
        status: 'success',
        matched_command_id: pendingCommand.command_id,
        matched_command_content: pendingCommand.content,
        matched_confidence: 1.0,
        processing_time_ms: 0
      })
    }
    
    audio.addEventListener('ended', handleEnded, { once: true })
    
    // 监听播放错误
    const handleError = () => {
      setIsPlaying(false)
      setCurrentAudio(null)
      setShowPlaybackConfirm(false)
      setPendingCommand(null)
      console.error('音频播放失败:', pendingCommand.audio_url)
    }
    
    audio.addEventListener('error', handleError, { once: true })
  }

  // 停止播放
  const handleStopPlayback = () => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
    }
    
    setIsPlaying(false)
    setShowPlaybackConfirm(false)
    setPendingCommand(null)
  }

  // 添加语音日志
  const addVoiceLog = (log: VoiceLogCreate) => {
    setVoiceLogs(prev => [...prev, log])
  }

  // 上传语音日志到后端
  const uploadVoiceLogs = async () => {
    if (voiceLogs.length === 0 || !selectedPatient) return
    
    try {
      await apiClient.uploadVoiceLogs({
        patient_id: selectedPatient.id,
        logs: voiceLogs
      })
      
      // 清空本地日志缓存
      setVoiceLogs([])
      setLastUploadTime(Date.now())
    } catch (error) {
      console.error('上传语音日志失败:', error)
    }
  }

  // 定期上传语音日志（每30秒）
  useEffect(() => {
    const interval = setInterval(() => {
      if (voiceLogs.length > 0 && selectedPatient) {
        uploadVoiceLogs()
      }
    }, 30000)
    
    return () => clearInterval(interval)
  }, [voiceLogs, selectedPatient])

  // 语音控制模式变更处理
  const handleVoiceControlModeChange = (mode: VoiceControlMode) => {
    setVoiceControlMode(mode)
    
    if (mode === 'none') {
      setVoiceControlEnabled(false)
    } else if (mode === 'offline') {
      setVoiceControlEnabled(true)
    } else if (mode === 'online') {
      setVoiceControlEnabled(false)
      // TODO: 实现在线语音控制
    }
  }

  // 语音识别结果处理
  const handleVoiceRecognitionResult = (result: {
    transcript: string
    confidence: number
    matchedCommand?: any
    processingTime?: number
  }) => {
    const log: VoiceLogCreate = {
      transcript: result.transcript,
      confidence: result.confidence,
      status: result.matchedCommand ? 'success' : 'no_match',
      matched_command_id: result.matchedCommand?.command_id,
      matched_command_content: result.matchedCommand?.content,
      matched_confidence: result.matchedCommand ? 0.9 : undefined,
      processing_time_ms: result.processingTime
    }
    
    addVoiceLog(log)
    
    // 如果匹配到指令，显示播放确认界面
    if (result.matchedCommand) {
      setPendingCommand(result.matchedCommand)
      setShowPlaybackConfirm(true)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">术中控制台</h1>
        <p className="text-muted-foreground">
          实时语音识别和指令播放系统
        </p>
      </div>

      {/* 患者选择 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              患者选择
              {isPatientLocked && (
                <Lock className="h-4 w-4 ml-2 text-orange-500" />
              )}
            </div>
            {selectedPatient && (
              <div className="flex items-center space-x-2">
                {!isPatientLocked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLockPatient}
                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    锁定患者
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnlockPatient}
                    className="text-green-600 border-green-300 hover:bg-green-50"
                  >
                    <Unlock className="h-4 w-4 mr-1" />
                    解除锁定
                  </Button>
                )}
              </div>
            )}
          </CardTitle>
          <CardDescription>
            {isPatientLocked 
              ? '患者已锁定，防止误操作' 
              : '选择当前手术的患者'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 患者搜索界面 */}
          {showPatientSearch && (
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="输入患者姓名搜索..."
                  value={patientSearchTerm}
                  onChange={(e) => setPatientSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowPatientSearch(false)}
                >
                  取消
                </Button>
              </div>
              
              {patientsLoading ? (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : patientsData?.items ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {patientsData.items.map((patient) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer"
                      onClick={() => handleSelectPatient(patient)}
                    >
                      <div>
                        <p className="font-medium">{patient.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatGender(patient.gender)} • {patient.date_of_birth}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>请输入患者姓名进行搜索</p>
                </div>
              )}
            </div>
          )}

          {/* 未选择患者时的界面 */}
          {!selectedPatient && !showPatientSearch && (
            <div className="text-center">
              <Button
                onClick={() => setShowPatientSearch(true)}
                className="w-full"
              >
                <Search className="h-4 w-4 mr-2" />
                搜索并选择患者
              </Button>
            </div>
          )}

          {/* 已选择患者时的界面 */}
          {selectedPatient && (
            <div className="space-y-4">
              {/* 患者信息 */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedPatient.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatGender(selectedPatient.gender)} • {selectedPatient.date_of_birth}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedPatient(null)
                    setShowPatientSearch(false)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* 音频预加载进度 */}
              {isPreloadingAudio && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>音频文件预加载中...</span>
                    <span>{Math.round(preloadProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${preloadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 语音控制设置 */}
      {selectedPatient && (
        <VoiceControlSettings
          mode={voiceControlMode}
          onModeChange={handleVoiceControlModeChange}
        />
      )}

      {/* 语音控制系统 */}
      {isPatientLocked && voiceControlEnabled && voiceControlMode === 'offline' && (
        <div className="space-y-6">
          {/* 现代化语音控制组件 */}
          {playableCommands?.commands ? (
            <ModernVoiceControl
              commands={playableCommands.commands}
              onPlayCommand={(commandId, content) => {
                const command = playableCommands.commands.find(cmd => cmd.command_id === commandId)
                if (command) {
                  setPendingCommand(command)
                  setShowPlaybackConfirm(true)
                }
              }}
              onStateChange={(state) => {
                console.log('🔄 语音控制状态变更:', state)
              }}
              onTranscriptChange={(transcript) => {
                console.log('📝 实时转录:', transcript)
              }}
              onCommandPlayed={setLastPlayedCommand}
              onVoiceLog={(log) => {
                console.log('📝 语音识别日志:', log)
                addVoiceLog(log)
              }}
              wakeWords={['发出指令', '播放指令', '开始指令']}
              enabled={true}
              className="w-full"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>语音控制</CardTitle>
                <CardDescription>
                  正在加载可用指令...
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 手动指令播放 */}
      {isPatientLocked && playableCommands?.commands && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CommandIcon className="h-5 w-5 mr-2" />
              手动播放指令
            </CardTitle>
            <CardDescription>
              点击播放按钮手动播放指定指令
            </CardDescription>
          </CardHeader>
          <CardContent>
            {commandsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : playableCommands.commands.length > 0 ? (
              <div className="space-y-3">
                {playableCommands.commands.map((command) => (
                  <div
                    key={command.command_id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{command.content}</h4>
                      {command.description && (
                        <p className="text-sm text-muted-foreground">
                          {command.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                        <span>方言：{command.dialect_label}</span>
                        {command.speaker_name && (
                          <span>说话人：{command.speaker_name}</span>
                        )}
                        <span>时长：{command.duration_ms ? `${Math.round(command.duration_ms / 1000)}秒` : '-'}</span>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManualPlay(command.command_id)}
                      disabled={isPlaying}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      播放
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  该患者还没有可播放的指令
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 语音识别日志 */}
      {isPatientLocked && selectedPatient && (
        <VoiceLogsDisplay patientId={selectedPatient.id} />
      )}

      {/* 指令播放确认界面 */}
      {showPlaybackConfirm && pendingCommand && (
        <CommandPlaybackConfirm
          command={pendingCommand}
          onStop={handleStopPlayback}
          onConfirm={handleConfirmPlayback}
          isPlaying={isPlaying}
        />
      )}

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>🏥 准备阶段：</strong></p>
            <p>1. 搜索并选择当前手术的患者</p>
            <p>2. 点击"锁定患者"按钮，系统会自动预加载所有音频文件</p>
            <p>3. 在语音控制设置中选择合适的模式</p>
            
            <p><strong>🎤 语音控制流程：</strong></p>
            <p>4. 启用语音控制后，点击麦克风按钮开始语音监听</p>
            <p>5. 说出唤醒词："发出指令"、"播放指令"或"开始指令"</p>
            <p>6. 听到提示音后，清晰说出指令内容</p>
            <p>7. 系统会显示指令确认界面，给您1秒纠错时间</p>
            
            <p><strong>🎵 手动播放：</strong></p>
            <p>8. 在手动播放指令区域，点击播放按钮</p>
            <p>9. 系统会显示指令确认界面，确认后开始播放</p>
            
            <p><strong>📊 日志记录：</strong></p>
            <p>10. 所有语音识别和播放操作都会记录在日志中</p>
            <p>11. 日志每30秒自动上传到后端保存</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ORConsolePage
