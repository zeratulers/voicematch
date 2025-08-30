/**
 * 审计日志组件
 * 
 * 查看系统操作记录
 */

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, Calendar, User, Activity, Eye } from 'lucide-react'

import { apiClient } from '../../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import LoadingSpinner from '../ui/LoadingSpinner'

interface AuditLog {
  id: number
  action: string
  entity: string
  entity_id?: string
  payload?: any
  ip_address?: string
  user_agent?: string
  user_id?: number
  created_at: string
}

const AuditLogs: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [actionFilter, setActionFilter] = useState<string>('')
  const [entityFilter, setEntityFilter] = useState<string>('')
  const [userIdFilter, setUserIdFilter] = useState<string>('')

  // 获取审计日志
  const { data: logsData, isLoading } = useQuery({
    queryKey: ['admin-audit-logs', currentPage, pageSize, actionFilter, entityFilter, userIdFilter],
    queryFn: () => apiClient.getAuditLogs({
      page: currentPage,
      size: pageSize,
      action: actionFilter || undefined,
      entity: entityFilter || undefined,
      user_id: userIdFilter ? parseInt(userIdFilter) : undefined
    }),
  })

  const handleClearFilters = () => {
    setActionFilter('')
    setEntityFilter('')
    setUserIdFilter('')
    setCurrentPage(1)
  }

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'bg-green-100 text-green-800'
      case 'update':
        return 'bg-blue-100 text-blue-800'
      case 'delete':
        return 'bg-red-100 text-red-800'
      case 'login':
        return 'bg-purple-100 text-purple-800'
      case 'logout':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getEntityIcon = (entity: string) => {
    switch (entity.toLowerCase()) {
      case 'user':
        return <User className="h-4 w-4" />
      case 'command':
        return <Activity className="h-4 w-4" />
      case 'patient':
        return <User className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
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
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-bold">审计日志</h2>
        <p className="text-muted-foreground">
          查看系统操作记录、用户活动和系统事件
        </p>
      </div>

      {/* 过滤和搜索 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-2">操作类型</label>
              <Select
                value={actionFilter}
                onValueChange={setActionFilter}
              >
                <option value="">全部操作</option>
                <option value="create">创建</option>
                <option value="update">更新</option>
                <option value="delete">删除</option>
                <option value="login">登录</option>
                <option value="logout">登出</option>
                <option value="play">播放</option>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">实体类型</label>
              <Select
                value={entityFilter}
                onValueChange={setEntityFilter}
              >
                <option value="">全部实体</option>
                <option value="user">用户</option>
                <option value="command">指令</option>
                <option value="patient">患者</option>
                <option value="assignment">分配</option>
                <option value="variant">变体</option>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">用户ID</label>
              <Input
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                placeholder="输入用户ID"
                type="number"
              />
            </div>
            
            <Button variant="outline" onClick={handleClearFilters}>
              清除过滤
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 日志统计 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {logsData?.total || 0}
              </div>
              <p className="text-sm text-muted-foreground">总日志数</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {logsData?.items?.filter(log => log.action === 'create').length || 0}
              </div>
              <p className="text-sm text-muted-foreground">创建操作</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {logsData?.items?.filter(log => log.action === 'update').length || 0}
              </div>
              <p className="text-sm text-muted-foreground">更新操作</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {logsData?.items?.filter(log => log.action === 'delete').length || 0}
              </div>
              <p className="text-sm text-muted-foreground">删除操作</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 日志列表 */}
      <Card>
        <CardHeader>
          <CardTitle>操作日志</CardTitle>
          <CardDescription>
            第 {currentPage} 页，共 {logsData?.pages || 0} 页
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {logsData?.items?.map((log) => (
              <div
                key={log.id}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {getEntityIcon(log.entity)}
                        <span>{log.entity}</span>
                        {log.entity_id && (
                          <span className="font-mono">#{log.entity_id}</span>
                        )}
                      </div>
                    </div>
                    
                    {log.payload && (
                      <div className="text-sm text-muted-foreground mb-2">
                        <details className="cursor-pointer">
                          <summary className="hover:text-foreground">查看详情</summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(log.created_at).toLocaleString('zh-CN')}
                      </div>
                      {log.ip_address && (
                        <div className="font-mono">{log.ip_address}</div>
                      )}
                      {log.user_id && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          用户 #{log.user_id}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {logsData?.items?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                暂无审计日志
              </div>
            )}
          </div>

          {/* 分页 */}
          {logsData && logsData.pages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                上一页
              </Button>
              <span className="text-sm">
                第 {currentPage} 页，共 {logsData.pages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === logsData.pages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AuditLogs
