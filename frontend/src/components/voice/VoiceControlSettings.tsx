/**
 * 语音控制设置组件
 * 
 * 提供语音控制模式的配置选项
 */

import React, { useState } from 'react'
import { Settings, Mic, MicOff, Wifi, WifiOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Label } from '../ui/Label'
import { RadioGroup, RadioGroupItem } from '../ui/RadioGroup'

export type VoiceControlMode = 'none' | 'offline' | 'online'

interface VoiceControlSettingsProps {
  mode: VoiceControlMode
  onModeChange: (mode: VoiceControlMode) => void
  className?: string
}

const VoiceControlSettings: React.FC<VoiceControlSettingsProps> = ({
  mode,
  onModeChange,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const modeOptions = [
    {
      value: 'none' as VoiceControlMode,
      label: '无语音控制',
      description: '完全禁用语音控制功能',
      icon: MicOff,
      color: 'text-gray-500'
    },
    {
      value: 'offline' as VoiceControlMode,
      label: '离线语音控制',
      description: '使用本地语音识别，数据不离开设备',
      icon: Mic,
      color: 'text-blue-500'
    },
    {
      value: 'online' as VoiceControlMode,
      label: '在线语音控制',
      description: '使用云端语音识别服务（待开发）',
      icon: Wifi,
      color: 'text-green-500'
    }
  ]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            语音控制设置
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '收起' : '展开'}
          </Button>
        </CardTitle>
        <CardDescription>
          配置语音控制的工作模式
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 模式选择 */}
        <div className="space-y-3">
          <Label className="text-base font-medium">语音控制模式</Label>
          <RadioGroup
            value={mode}
            onValueChange={(value) => onModeChange(value as VoiceControlMode)}
            className="space-y-3"
          >
            {modeOptions.map((option) => {
              const IconComponent = option.icon
              return (
                <div
                  key={option.value}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    mode === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/50'
                  }`}
                  onClick={() => onModeChange(option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <IconComponent className={`h-5 w-5 ${option.color}`} />
                  <div className="flex-1">
                    <Label
                      htmlFor={option.value}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </RadioGroup>
        </div>

        {/* 详细设置（仅在展开时显示） */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            {mode === 'offline' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">离线模式设置</Label>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• 唤醒词：支持自定义中文唤醒词</p>
                  <p>• 识别语言：中文（简体）</p>
                  <p>• 隐私保护：所有音频数据在本地处理</p>
                  <p>• 网络要求：无需网络连接</p>
                </div>
              </div>
            )}
            
            {mode === 'online' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">在线模式设置</Label>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• 云端识别：使用先进的云端语音识别服务</p>
                  <p>• 识别精度：更高的识别准确率</p>
                  <p>• 网络要求：需要稳定的网络连接</p>
                  <p>• 开发状态：功能正在开发中</p>
                </div>
              </div>
            )}
            
            {mode === 'none' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">禁用状态</Label>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• 语音控制功能已完全禁用</p>
                  <p>• 仅支持手动播放指令</p>
                  <p>• 适用于对语音控制有特殊要求的场景</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VoiceControlSettings
