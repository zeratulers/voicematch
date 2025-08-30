/**
 * 语音日志显示组件
 * 
 * 显示患者的语音识别历史记录
 */

import React, { useState, useEffect } from 'react'
import { 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { apiClient } from '../../api/client'
import type { VoiceLog } from '../../types/voice-log'

interface VoiceLogsDisplayProps {
  patientId: number
  className?: string
}

const VoiceLogsDisplay: React.FC<VoiceLogsDisplayProps> = ({
  patientId,
  className = ''
}) => {
  const [logs, setLogs] = useState<VoiceLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载语音日志
  const loadLogs = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    
    try {
      const response = await apiClient.getPatientVoiceLogs(patientId, {
        page: 1,
        size: 100
      })
      setLogs(response.logs)
      setError(null)
    } catch (err) {
      setError('加载语音日志失败')
      console.error('加载语音日志失败:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // 初始加载
  useEffect(() => {
    if (patientId) {
      loadLogs()
    }
  }, [patientId])

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'no_match':
        return <XCircle className="h-4 w-4 text-orange-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />
    }
  }

  // 获取状态标签
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">成功</Badge>
      case 'no_match':
        return <Badge variant="secondary">无匹配</Badge>
      case 'error':
        return <Badge variant="destructive">错误</Badge>
      default:
        return <Badge variant="outline">未知</Badge>
    }
  }

  // 格式化时间
  const formatTime = (timeString: string) => {
    const date = new Date(timeString)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // 格式化置信度
  const formatConfidence = (confidence: number) => {
    return `${(confidence * 100).toFixed(1)}%`
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            语音识别日志
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">加载中...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            语音识别日志
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadLogs(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            刷新
          </Button>
        </CardTitle>
        <CardDescription>
          显示患者语音识别的历史记录和结果
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="text-center py-4 text-red-500">
            <AlertCircle className="h-5 w-5 mx-auto mb-2" />
            {error}
          </div>
        )}

        {logs.length === 0 && !error ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暂无语音识别记录</p>
            <p className="text-sm">开始使用语音控制后，这里会显示识别历史</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(log.status)}
                    {getStatusBadge(log.status)}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatTime(log.created_at)}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">识别内容：</span>
                    <span className="text-sm">{log.transcript}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>置信度：{formatConfidence(log.confidence)}</span>
                    {log.processing_time_ms && (
                      <span>处理时间：{log.processing_time_ms}ms</span>
                    )}
                  </div>
                  
                  {log.matched_command_content && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <div className="text-xs text-green-700">
                        <span className="font-medium">匹配指令：</span>
                        {log.matched_command_content}
                      </div>
                      {log.matched_confidence && (
                        <div className="text-xs text-green-600 mt-1">
                          匹配置信度：{formatConfidence(log.matched_confidence)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VoiceLogsDisplay
