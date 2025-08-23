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
  Loader2
} from 'lucide-react'

import { apiClient } from '../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import type { Patient } from '../types/patient'
import { formatGender } from '../utils/gender'
import { ModernVoiceControl } from '../components/voice'
import DebugVoiceControl from '../components/voice/DebugVoiceControl'



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
  const [voiceControlEnabled, setVoiceControlEnabled] = useState(false)

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
    }
  }

  // 新版本不需要配置动态命令，使用唤醒词+命令窗口模式

  const handleLockPatient = async () => {
    if (selectedPatient) {
      console.log('🔒 锁定患者:', selectedPatient.name)
      setIsPatientLocked(true)
      
      // 锁定患者后预加载音频
      setTimeout(async () => {
        await preloadAudioFiles()
      }, 100)
    }
  }

  const handleUnlockPatient = () => {
    console.log('🔓 解锁患者，停止所有活动')
    setIsPatientLocked(false)
    
    // 清理状态
    setAudioCache(new Map())
    setPreloadProgress(0)
    setLastPlayedCommand(null)
    setVoiceControlEnabled(false)
  }

  const handleClearPatient = () => {
    if (!isPatientLocked) {
      setSelectedPatient(null)
      setShowPatientSearch(false)
      setPatientSearchTerm('')
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('zh-CN')
  }

  // 本地播放音频
  const playLocalAudio = useCallback((commandId: string, commandContent: string) => {
    console.log('🎵 播放音频:', commandContent)
    
    const audio = stateRef.current.audioCache.get(commandId)
    if (audio) {
      audio.currentTime = 0
      audio.play().then(() => {
        setLastPlayedCommand(commandContent)
        console.log('✅ 播放成功:', commandContent)
      }).catch(console.error)
    } else {
      console.error('❌ 未找到音频文件:', commandId)
    }
  }, [])





  // 同步状态到ref，避免闭包问题
  useEffect(() => {
    stateRef.current = {
      isPatientLocked,
      playableCommands,
      audioCache,
      selectedPatient
    }
    
    console.log('📊 状态更新到ref:', {
      isPatientLocked,
      hasCommands: !!playableCommands?.commands,
      commandsCount: playableCommands?.commands?.length || 0,
      totalCommands: playableCommands?.total_commands || 0,
      cacheSize: audioCache.size,
      selectedPatient: selectedPatient?.name
    })
  }, [isPatientLocked, playableCommands, audioCache, selectedPatient])



  // 预加载音频文件
  const preloadAudioFiles = async () => {
    if (!playableCommands?.commands) return
    
    setIsPreloadingAudio(true)
    setPreloadProgress(0)
    
    const newAudioCache = new Map<string, HTMLAudioElement>()
    const commands = playableCommands.commands
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      try {
        const audio = new Audio(command.audio_url)
        await new Promise((resolve, reject) => {
          audio.addEventListener('canplaythrough', resolve)
          audio.addEventListener('error', reject)
          audio.load()
        })
        newAudioCache.set(command.command_id, audio)
        setPreloadProgress(Math.round(((i + 1) / commands.length) * 100))
      } catch (error) {
        console.error(`预加载音频失败: ${command.command_id}`, error)
      }
    }
    
    setAudioCache(newAudioCache)
    setIsPreloadingAudio(false)
  }



  // playLocalAudio 函数已在前面定义

  const handleManualPlay = async (commandId: string) => {
    if (!selectedPatient) return
    
    console.log('🎵 手动播放指令:', commandId)
    
    // 如果患者已锁定且有缓存，直接本地播放
    if (isPatientLocked && audioCache.size > 0) {
      const command = playableCommands?.commands?.find(cmd => cmd.command_id === commandId)
      if (command) {
        console.log('🎵 使用本地缓存播放')
        playLocalAudio(commandId, command.content)
        return
      }
    }
    
    // 否则通过API播放
    try {
      console.log('🎵 通过API播放')
      
      const response = await apiClient.triggerPlayback({
        patient_id: selectedPatient.id,
        command_id: commandId
      })
      
      setLastPlayedCommand(response.command_content)
      console.log('播放音频:', response.audio_url)
      
      // 简单播放音频
      const audio = new Audio(response.audio_url)
      audio.play().catch(console.error)
      
    } catch (error) {
      console.error('播放失败:', error)
    }
  }

  const handleContentMatch = async (content: string) => {
    if (!selectedPatient) return
    
    try {
      const response = await apiClient.triggerPlaybackByContent({
        patient_id: selectedPatient.id,
        command_content: content
      })
      
      setLastPlayedCommand(response.command_content)
      console.log('匹配播放:', response.audio_url)
      
      // 实际播放音频
      const audio = new Audio(response.audio_url)
      audio.play().catch(() => {
        console.error('音频播放失败')
      })
      
    } catch (error) {
      console.error('匹配播放失败:', error)
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
          {selectedPatient ? (
            // 已选择患者的显示
            <div className={`p-4 rounded-lg border-2 ${
              isPatientLocked 
                ? 'border-orange-200 bg-orange-50' 
                : 'border-blue-200 bg-blue-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">{selectedPatient.name}</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>患者ID：{selectedPatient.id}</p>
                      <p>性别：{formatGender(selectedPatient.gender)}</p>
                      <p>出生日期：{formatDate(selectedPatient.date_of_birth)}</p>
                      {selectedPatient.note && (
                        <p>备注：{selectedPatient.note}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {!isPatientLocked && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearPatient}
                  >
                    <X className="h-4 w-4 mr-1" />
                    重新选择
                  </Button>
                )}
              </div>
              
              <div className="mt-3 text-sm text-muted-foreground">
                可播放指令数：{playableCommands?.total_commands || 0}
              </div>
            </div>
          ) : (
            // 患者选择界面
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button 
                  onClick={() => setShowPatientSearch(!showPatientSearch)}
                  className="flex-shrink-0"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {showPatientSearch ? '隐藏搜索' : '搜索患者'}
                </Button>
                
                {showPatientSearch && (
                  <Input
                    placeholder="输入患者姓名搜索..."
                    value={patientSearchTerm}
                    onChange={(e) => setPatientSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                )}
              </div>

              {showPatientSearch && (
                <div className="max-h-96 overflow-y-auto border rounded-lg">
          {patientsLoading ? (
                    <div className="p-4 text-center">
            <LoadingSpinner />
                    </div>
                  ) : patientsData?.items && patientsData.items.length > 0 ? (
                    <div className="divide-y">
                      {patientsData.items.map((patient) => (
                        <div
                          key={patient.id}
                          onClick={() => handleSelectPatient(patient)}
                          className="p-3 hover:bg-accent/50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium">{patient.name}</h4>
                              <div className="text-sm text-muted-foreground">
                                <p>ID: {patient.id} | 性别: {formatGender(patient.gender)} | 生日: {formatDate(patient.date_of_birth)}</p>
                                {patient.note && (
                                  <p className="truncate">备注: {patient.note}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      {patientSearchTerm ? '没有找到匹配的患者' : '请输入搜索关键词'}
                    </div>
                  )}
                </div>
              )}

              {!showPatientSearch && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>请点击上方按钮搜索并选择患者</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 语音控制系统 */}
      {isPatientLocked && (
        <div className="space-y-6">
          {/* 现代化语音控制组件 */}
          {playableCommands?.commands && voiceControlEnabled ? (
            <ModernVoiceControl
              commands={playableCommands.commands}
              onPlayCommand={playLocalAudio}
              onStateChange={(state) => {
                console.log('🔄 语音控制状态变更:', state)
              }}
              onTranscriptChange={(transcript) => {
                console.log('📝 实时转录:', transcript)
              }}
              onCommandPlayed={setLastPlayedCommand}
              wakeWords={['发出指令', '播放指令', '开始指令']}
              enabled={true}
              className="w-full"
            />
          ) : (
            /* 语音控制启用界面 */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mic className="h-5 w-5 mr-2" />
                  智能语音控制系统
                </CardTitle>
                <CardDescription>
                  现代化中文语音识别与指令匹配系统
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-6">
                  <div className="p-8 bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-lg">
                    <Mic className="h-16 w-16 mx-auto mb-4 text-blue-500" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      准备启用语音控制
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      系统将使用先进的中文语音识别技术，支持多种方言和智能指令匹配
                    </p>
                    <Button
                      onClick={() => setVoiceControlEnabled(true)}
                      disabled={!playableCommands?.commands || audioCache.size === 0}
                      size="lg"
                      className="w-full max-w-xs"
                    >
                      <Mic className="h-5 w-5 mr-2" />
                      启用语音控制
                    </Button>
                  </div>
                  
                  {/* 系统准备状态 */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-white border rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">系统状态</h4>
                      <div className="space-y-2 text-sm">
                        <div className={`flex items-center ${playableCommands?.commands ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="mr-2">{playableCommands?.commands ? '✅' : '❌'}</span>
                          可用指令: {playableCommands?.total_commands || 0} 个
                        </div>
                        <div className={`flex items-center ${audioCache.size > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="mr-2">{audioCache.size > 0 ? '✅' : '❌'}</span>
                          音频缓存: {audioCache.size} 个文件
                        </div>
                        <div className="flex items-center text-blue-600">
                          <span className="mr-2">🎤</span>
                          中文语音识别: 已准备
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white border rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">技术特性</h4>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center">
                          <span className="mr-2">🔊</span>
                          实时音频波形可视化
                        </div>
                        <div className="flex items-center">
                          <span className="mr-2">🧠</span>
                          AI智能指令分类
                        </div>
                        <div className="flex items-center">
                          <span className="mr-2">🎯</span>
                          多级匹配算法
                        </div>
                        <div className="flex items-center">
                          <span className="mr-2">🔒</span>
                          本地处理，数据安全
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 音频预加载进度 */}
                  {isPreloadingAudio && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          正在预加载音频文件: {preloadProgress}%
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${preloadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 可用指令列表 */}
      {selectedPatient && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CommandIcon className="h-5 w-5 mr-2" />
              可用指令
            </CardTitle>
            <CardDescription>
              当前患者的可播放指令列表，点击手动播放
            </CardDescription>
          </CardHeader>
          <CardContent>
            {commandsLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : playableCommands?.commands && playableCommands.commands.length > 0 ? (
              <div className="grid gap-3">
                {playableCommands.commands.map((command) => (
                  <div
                    key={command.command_id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
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

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明（现代化中文语音控制）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>🏥 准备阶段：</strong></p>
            <p>1. 搜索并选择当前手术的患者</p>
            <p>2. 点击"锁定患者"按钮，系统会自动预加载所有音频文件</p>
            <p>3. 锁定后点击"启用语音控制"按钮</p>
            
            <p><strong>🎤 中文语音控制流程：</strong></p>
            <p>4. 点击麦克风按钮开始语音监听</p>
            <p>5. 系统显示专业音频波形可视化和实时中文转录</p>
            <p>6. 说出唤醒词：</p>
            <p className="ml-4 text-xs">• "发出指令" 或 "播放指令" 或 "开始指令"</p>
            <p>7. 听到提示音后，清晰说出指令内容：</p>
            <p className="ml-4 text-xs">• "注意呼吸" → 自动匹配"把注意力放在呼吸上"</p>
            <p className="ml-4 text-xs">• "放松肩膀" → 自动匹配"不要紧张，放松肩膀"</p>
            <p className="ml-4 text-xs">• "深呼吸" → 自动匹配相关呼吸指令</p>
            
            <p><strong>🤖 智能处理技术：</strong></p>
            <p>8. 双重识别系统：</p>
            <p className="ml-4">• 浏览器原生中文语音识别（实时响应）</p>
            <p className="ml-4">• AI智能指令分类器（语义理解）</p>
            <p>9. 分类结果处理：</p>
            <p className="ml-4">• 确信匹配（95%+）：直接播放指令</p>
            <p className="ml-4">• 可能匹配（70-95%）：显示候选列表</p>
            <p className="ml-4">• 不确定（&lt;70%）：提示重新说一遍</p>
            
            <p><strong>🌊 专业可视化：</strong></p>
            <p>10. 使用 react-audio-visualize 库提供实时音频波形</p>
            <p>11. 状态颜色指示：蓝色监听 → 橙色唤醒 → 紫色捕获 → 绿色播放</p>
            <p>12. 实时中文转录，支持方言和口音识别</p>
            
            <p><strong>✨ 技术优势：</strong></p>
            <p>13. 专门优化的中文语音识别（lang: 'zh-CN'）</p>
            <p>14. 降噪和回声消除技术提升识别准确率</p>
            <p>15. 状态机模式确保稳定的交互流程</p>
            <p>16. 完全前端运行，<strong>数据不离开设备</strong></p>
          </div>
        </CardContent>
      </Card>

      {/* 调试组件 - 临时添加 */}
      {true && (
        <Card>
          <CardHeader>
            <CardTitle>🐛 语音控制调试</CardTitle>
            <CardDescription>
              开发环境专用 - 调试唤醒词检测问题
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DebugVoiceControl />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ORConsolePage
