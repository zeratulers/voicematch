import React, { useEffect, useState } from 'react'
import { Square, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

interface CommandPlaybackConfirmProps {
  command: {
    content: string
    description?: string
    dialect_label: string
    speaker_name: string
  }
  onStop: () => void
  onConfirm: () => void
  isPlaying: boolean
  className?: string
}

const CommandPlaybackConfirm: React.FC<CommandPlaybackConfirmProps> = ({
  command,
  onStop,
  onConfirm,
  isPlaying,
  className = ''
}) => {
  const [countdown, setCountdown] = useState(1)

  // 倒计时和自动播放
  useEffect(() => {
    // 如果已经在播放，停止倒计时逻辑
    if (isPlaying) return
    
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0) {
      // 倒计时结束后，延迟1秒自动播放
      const playTimer = setTimeout(() => {
        onConfirm()  // 自动播放
      }, 1000)
      return () => clearTimeout(playTimer)
    }
  }, [countdown, onConfirm, isPlaying])

  // 获取方言标签颜色
  const getDialectColor = (dialect: string) => {
    const colors: Record<string, string> = {
      '普通话': 'bg-blue-100 text-blue-800',
      '粤语': 'bg-green-100 text-green-800',
      '吴语': 'bg-purple-100 text-purple-800',
      '客家话': 'bg-orange-100 text-orange-800',
      '闽南语': 'bg-red-100 text-red-800'
    }
    return colors[dialect] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className={`w-full max-w-2xl mx-4 ${className}`}>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mr-3" />
            指令确认
          </CardTitle>
          <CardDescription>
            请确认以下指令内容，倒计时结束后将自动播放
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* 指令内容 */}
          <div className="text-center space-y-4">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                指令内容
              </h3>
              <p className="text-2xl font-bold text-blue-900 leading-relaxed">
                {command.content}
              </p>
            </div>
            
            {/* 指令信息 */}
            <div className="flex items-center justify-center space-x-4">
              <Badge className={getDialectColor(command.dialect_label)}>
                {command.dialect_label}
              </Badge>
              {command.speaker_name && (
                <Badge variant="outline">
                  说话人：{command.speaker_name}
                </Badge>
              )}
            </div>
            
            {command.description && (
              <p className="text-sm text-muted-foreground">
                {command.description}
              </p>
            )}
          </div>

          {/* 倒计时显示 */}
          {countdown > 0 && (
            <div className="text-center">
              <div className="text-6xl font-bold text-blue-600 mb-2">
                {countdown}
              </div>
              <p className="text-muted-foreground">
                秒后自动播放
              </p>
            </div>
          )}

          {/* 播放确认 */}
          {countdown === 0 && !isPlaying && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">指令即将播放</span>
              </div>
              <p className="text-sm text-muted-foreground">
                如果这不是您想要的指令，请立即点击停止按钮
              </p>
            </div>
          )}

          {/* 播放中状态 */}
          {isPlaying && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-2 text-green-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">正在播放指令</span>
              </div>
              <p className="text-sm text-muted-foreground">
                播放完成后界面将自动关闭
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-center space-x-4">
            <Button
              onClick={onStop}
              variant="destructive"
              size="lg"
              className="px-8 py-3"
            >
              <Square className="h-5 w-5 mr-2" />
              停止播放
            </Button>
          </div>

          {/* 提示信息 */}
          <div className="text-center text-xs text-muted-foreground">
            <p>• 播放期间无法播放其他指令</p>
            <p>• 如需停止播放，请点击停止按钮</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CommandPlaybackConfirm
