/**
 * 指令详情页面 - 重新设计版本
 * 
 * 显示指令详情和管理所有变体
 */

import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, 
  Edit2, 
  Plus, 
  AudioLines,
  Command as CommandIcon,
  Users,
  Globe,
  Calendar,
  FileText,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'

import { apiClient } from '../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import VariantCreateDialog from '../components/commands/VariantCreateDialog'

const CommandDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false)

  const commandId = id!

  // 获取指令详情
  const { data: command, isLoading } = useQuery({
    queryKey: ['command', commandId],
    queryFn: () => apiClient.getCommand(commandId),
    enabled: !!commandId,
  })

  // 删除变体
  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: number) => apiClient.deleteCommandVariant(variantId),
    onSuccess: () => {
      toast.success('变体已删除')
      queryClient.invalidateQueries({ queryKey: ['command', commandId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '删除失败')
    }
  })

  // 更新变体状态
  const updateVariantMutation = useMutation({
    mutationFn: ({ variantId, isActive }: { variantId: number, isActive: boolean }) => 
      apiClient.updateCommandVariant(variantId, { is_active: isActive }),
    onSuccess: () => {
      toast.success('变体状态已更新')
      queryClient.invalidateQueries({ queryKey: ['command', commandId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '更新失败')
    }
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN')
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const getCommandTypeBadge = () => {
    if (!command) return null
    
    if (command.is_template) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          系统模板
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        个人指令
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!command) {
    return (
      <div className="text-center py-12">
        <CommandIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">指令不存在</h3>
        <p className="text-gray-500 mb-4">
          您要查看的指令不存在或已被删除
        </p>
        <Button onClick={() => navigate('/commands')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回指令库
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => navigate('/commands')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回指令库
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">指令详情</h1>
            <p className="text-muted-foreground">
              管理指令变体和分配记录
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!command.is_template && (
            <Button variant="outline">
              <Edit2 className="h-4 w-4 mr-2" />
              编辑指令
            </Button>
          )}
          <Button onClick={() => setIsVariantDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            添加变体
          </Button>
        </div>
      </div>

      {/* 指令基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <CommandIcon className="h-5 w-5 mr-2" />
              基本信息
            </div>
            <div className="flex items-center space-x-2">
              {getCommandTypeBadge()}
              {!command.is_active && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  已停用
                </span>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">指令内容</p>
                <p className="font-medium text-lg">{command.content}</p>
              </div>
              {command.description && (
                <div>
                  <p className="text-sm text-muted-foreground">指令描述</p>
                  <p className="font-medium">{command.description}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">指令ID</p>
                <p className="font-mono text-sm">{command.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">创建时间</p>
                <p className="font-medium">{formatDateTime(command.created_at)}</p>
              </div>
              {command.updated_at !== command.created_at && (
                <div>
                  <p className="text-sm text-muted-foreground">更新时间</p>
                  <p className="font-medium">{formatDateTime(command.updated_at)}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计信息 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              方言变体
            </CardTitle>
            <AudioLines className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{command.variant_count}</div>
            <p className="text-xs text-muted-foreground">
              已创建的变体数量
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              患者分配
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{command.patient_assignment_count}</div>
            <p className="text-xs text-muted-foreground">
              已分配给患者的数量
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              状态
            </CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {command.is_active ? '激活' : '停用'}
            </div>
            <p className="text-xs text-muted-foreground">
              当前指令状态
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 方言变体列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <AudioLines className="h-5 w-5 mr-2" />
              方言变体
            </div>
            <Button onClick={() => setIsVariantDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              添加变体
            </Button>
          </CardTitle>
          <CardDescription>
            管理该指令的所有方言音频变体
          </CardDescription>
        </CardHeader>
        <CardContent>
          {command.variants && command.variants.length > 0 ? (
            <div className="space-y-4">
              {command.variants.map((variant) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Globe className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium">{variant.dialect_set.label}</h3>
                        {variant.dialect_set.is_default && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            默认方言
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          variant.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {variant.is_active ? '已启用' : '已禁用'}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>方言代码：{variant.dialect_set.key}</p>
                        {variant.speaker_name && (
                          <p>说话人：{variant.speaker_name}</p>
                        )}
                        {variant.speaker_note && (
                          <p>备注：{variant.speaker_note}</p>
                        )}
                        {variant.duration_ms && (
                          <p>时长：{Math.round(variant.duration_ms / 1000)}秒</p>
                        )}
                        <p>创建时间：{formatDateTime(variant.created_at)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // 播放音频
                        const audio = new Audio(variant.audio_url)
                        audio.play().catch(() => {
                          toast.error('音频播放失败')
                        })
                      }}
                    >
                      <AudioLines className="h-4 w-4" />
                      播放
                    </Button>
                    
                    {!command.is_template && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateVariantMutation.mutate({
                            variantId: variant.id,
                            isActive: !variant.is_active
                          })}
                          disabled={updateVariantMutation.isPending}
                        >
                          {variant.is_active ? '禁用' : '启用'}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (window.confirm('确定要删除这个变体吗？此操作不可恢复。')) {
                              deleteVariantMutation.mutate(variant.id)
                            }
                          }}
                          disabled={deleteVariantMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          删除
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <AudioLines className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无变体</h3>
              <p className="text-gray-500 mb-4">
                还没有为该指令创建任何方言变体
              </p>
              <Button onClick={() => setIsVariantDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                添加第一个变体
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 变体创建对话框 */}
      <VariantCreateDialog
        commandId={commandId}
        open={isVariantDialogOpen}
        onClose={() => setIsVariantDialogOpen(false)}
        onSuccess={() => {
          setIsVariantDialogOpen(false)
          queryClient.invalidateQueries({ queryKey: ['command', commandId] })
        }}
      />
    </div>
  )
}

export default CommandDetailPage