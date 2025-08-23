/**
 * 指令库页面 - 重新设计版本
 * 
 * 管理所有指令（不绑定特定患者）
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Command as CommandIcon, Filter, Edit2, Trash2, Eye, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { apiClient } from '../api/client'
import type { Command } from '../types/command'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import CommandCreateDialog from '../components/commands/CommandCreateDialog'

const CommandsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>()
  const [templateFilter, setTemplateFilter] = useState<boolean | undefined>()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  
  const queryClient = useQueryClient()

  // 获取指令列表
  const { data: commandsData, isLoading } = useQuery({
    queryKey: ['commands', currentPage, searchTerm, activeFilter, templateFilter],
    queryFn: () => apiClient.getCommands({
      page: currentPage,
      size: 20,
      search: searchTerm || undefined,
      is_active: activeFilter,
      is_template: templateFilter
    }),
  })

  // 删除指令
  const deleteCommandMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCommand(id),
    onSuccess: () => {
      toast.success('指令已删除')
      queryClient.invalidateQueries({ queryKey: ['commands'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '删除失败')
    }
  })

  // 更新指令状态
  const updateCommandMutation = useMutation({
    mutationFn: ({ commandId, isActive }: { commandId: string, isActive: boolean }) => 
      apiClient.updateCommand(commandId, { is_active: isActive }),
    onSuccess: () => {
      toast.success('指令状态已更新')
      queryClient.invalidateQueries({ queryKey: ['commands'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '更新失败')
    }
  })

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleDeleteCommand = (command: Command) => {
    if (window.confirm(`确定要删除指令 "${command.content}" 吗？这可能会影响已分配给患者的记录。`)) {
      deleteCommandMutation.mutate(command.id)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const getCommandTypeBadge = (command: Command) => {
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

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">指令库</h1>
          <p className="text-muted-foreground">
            管理所有可用的指令和方言变体
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建指令
        </Button>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            搜索和过滤
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 搜索 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="搜索指令内容..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* 激活状态过滤 */}
            <Select 
              value={activeFilter === undefined ? "" : activeFilter.toString()}
              onChange={(e) => {
                const value = e.target.value
                setActiveFilter(value === "" ? undefined : value === "true")
                setCurrentPage(1)
              }}
            >
              <option value="">全部状态</option>
              <option value="true">已激活</option>
              <option value="false">已停用</option>
            </Select>

            {/* 模板过滤 */}
            <Select 
              value={templateFilter === undefined ? "" : templateFilter.toString()}
              onChange={(e) => {
                const value = e.target.value
                setTemplateFilter(value === "" ? undefined : value === "true")
                setCurrentPage(1)
              }}
            >
              <option value="">全部类型</option>
              <option value="true">系统模板</option>
              <option value="false">个人指令</option>
            </Select>

            {/* 统计信息 */}
            <div className="text-sm text-muted-foreground">
              共 {commandsData?.total || 0} 条指令
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 指令列表 */}
      <Card>
        <CardHeader>
          <CardTitle>指令列表</CardTitle>
          <CardDescription>
            当前显示第 {currentPage} 页，共 {commandsData?.pages || 0} 页
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commandsData?.items && commandsData.items.length > 0 ? (
            <div className="space-y-4">
              {commandsData.items.map((command) => (
                <div
                  key={command.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <CommandIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium">{command.content}</h3>
                        {getCommandTypeBadge(command)}
                        {!command.is_active && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            已停用
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {command.description && (
                          <p>描述：{command.description}</p>
                        )}
                        <p>创建时间：{formatDateTime(command.created_at)}</p>
                        <p>指令ID：{command.id}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link to={`/commands/${command.id}`}>
                        <Eye className="h-4 w-4" />
                        查看详情
                      </Link>
                    </Button>
                    
                    {!command.is_template && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateCommandMutation.mutate({
                            commandId: command.id,
                            isActive: !command.is_active
                          })}
                          disabled={updateCommandMutation.isPending}
                        >
                          {command.is_active ? '禁用' : '启用'}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // TODO: 实现编辑功能
                            toast.info('编辑功能开发中')
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCommand(command)}
                          disabled={deleteCommandMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CommandIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无指令</h3>
              <p className="text-gray-500 mb-4">
                还没有创建任何指令，点击上方按钮创建第一个指令
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建指令
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {commandsData && commandsData.pages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            上一页
          </Button>
          
          <span className="flex items-center px-4 py-2 text-sm">
            第 {currentPage} 页，共 {commandsData.pages} 页
          </span>
          
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(commandsData.pages, prev + 1))}
            disabled={currentPage === commandsData.pages}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 创建指令对话框 */}
      <CommandCreateDialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={() => {
          setIsCreateDialogOpen(false)
          queryClient.invalidateQueries({ queryKey: ['commands'] })
        }}
      />
    </div>
  )
}

export default CommandsPage