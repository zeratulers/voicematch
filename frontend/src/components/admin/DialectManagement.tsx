/**
 * 方言管理组件
 * 
 * 管理支持的方言类型
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Star, StarOff } from 'lucide-react'

import { apiClient } from '../../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog'
import LoadingSpinner from '../ui/LoadingSpinner'

interface DialectFormData {
  key: string
  label: string
  notes?: string
  is_default: boolean
}

const DialectManagement: React.FC = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedDialect, setSelectedDialect] = useState<any>(null)

  const queryClient = useQueryClient()

  // 获取方言列表
  const { data: dialects, isLoading } = useQuery({
    queryKey: ['admin-dialects'],
    queryFn: () => apiClient.getAdminDialectSets(),
  })

  // 创建方言
  const createDialectMutation = useMutation({
    mutationFn: (dialectData: DialectFormData) => apiClient.createDialectSet(dialectData),
    onSuccess: () => {
      toast.success('方言创建成功')
      setShowCreateDialog(false)
      queryClient.invalidateQueries({ queryKey: ['admin-dialects'] })
    },
    onError: (error: any) => {
      toast.error(error.message || '创建方言失败')
    }
  })

  // 更新方言
  const updateDialectMutation = useMutation({
    mutationFn: ({ id, dialectData }: { id: number; dialectData: Partial<DialectFormData> }) =>
      apiClient.updateDialectSet(id, dialectData),
    onSuccess: () => {
      toast.success('方言更新成功')
      setShowEditDialog(false)
      setSelectedDialect(null)
      queryClient.invalidateQueries({ queryKey: ['admin-dialects'] })
    },
    onError: (error: any) => {
      toast.error(error.message || '更新方言失败')
    }
  })

  // 删除方言
  const deleteDialectMutation = useMutation({
    mutationFn: (dialectId: number) => apiClient.deleteDialectSet(dialectId),
    onSuccess: () => {
      toast.success('方言删除成功')
      queryClient.invalidateQueries({ queryKey: ['admin-dialects'] })
    },
    onError: (error: any) => {
      toast.error(error.message || '删除方言失败')
    }
  })

  const handleCreateDialect = (formData: DialectFormData) => {
    createDialectMutation.mutate(formData)
  }

  const handleEditDialect = (dialect: any) => {
    setSelectedDialect(dialect)
    setShowEditDialog(true)
  }

  const handleDeleteDialect = (dialectId: number) => {
    if (confirm('确定要删除这个方言吗？删除后无法恢复。')) {
      deleteDialectMutation.mutate(dialectId)
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
      {/* 页面标题和操作 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">方言设置</h2>
          <p className="text-muted-foreground">
            管理系统支持的方言类型和语言变体
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          添加方言
        </Button>
      </div>

      {/* 方言列表 */}
      <Card>
        <CardHeader>
          <CardTitle>方言列表</CardTitle>
          <CardDescription>
            共 {dialects?.length || 0} 个方言类型
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {dialects?.map((dialect) => (
              <div
                key={dialect.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {dialect.is_default ? (
                      <Star className="h-5 w-5 text-yellow-500 fill-current" />
                    ) : (
                      <StarOff className="h-5 w-5 text-gray-400" />
                    )}
                    <span className="font-medium">{dialect.label}</span>
                  </div>
                  <span className="text-sm text-muted-foreground font-mono">
                    {dialect.key}
                  </span>
                  {dialect.notes && (
                    <span className="text-sm text-muted-foreground">
                      {dialect.notes}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditDialect(dialect)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDialect(dialect.id)}
                    disabled={dialect.is_default}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {dialects?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                暂无方言设置
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 创建方言对话框 */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新方言</DialogTitle>
          </DialogHeader>
          <DialectForm
            onSubmit={handleCreateDialect}
            onCancel={() => setShowCreateDialog(false)}
            isLoading={createDialectMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* 编辑方言对话框 */}
      <Dialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑方言</DialogTitle>
          </DialogHeader>
          {selectedDialect && (
            <DialectForm
              dialect={selectedDialect}
              onSubmit={(formData) => handleEditDialect({ id: selectedDialect.id, dialectData: formData })}
              onCancel={() => setShowEditDialog(false)}
              isLoading={updateDialectMutation.isPending}
              isEdit
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 方言表单组件
interface DialectFormProps {
  dialect?: any
  onSubmit: (data: DialectFormData) => void
  onCancel: () => void
  isLoading: boolean
  isEdit?: boolean
}

const DialectForm: React.FC<DialectFormProps> = ({ 
  dialect, 
  onSubmit, 
  onCancel, 
  isLoading, 
  isEdit = false 
}) => {
  const [formData, setFormData] = useState<DialectFormData>({
    key: dialect?.key || '',
    label: dialect?.label || '',
    notes: dialect?.notes || '',
    is_default: dialect?.is_default || false
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.key || !formData.label) {
      toast.error('请填写方言代码和名称')
      return
    }
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">方言代码 *</label>
        <Input
          value={formData.key}
          onChange={(e) => setFormData({ ...formData, key: e.target.value })}
          placeholder="如：zh-cn, zh-yue, wu"
          required
          disabled={isEdit}
        />
        <p className="text-xs text-muted-foreground mt-1">
          方言的唯一标识符，建议使用标准语言代码
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">方言名称 *</label>
        <Input
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          placeholder="如：普通话、粤语、吴语"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">说明</label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="方言的详细说明或备注"
        />
      </div>
      
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_default}
            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm font-medium">设为默认方言</span>
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          设置为默认方言后，新用户将默认使用此方言
        </p>
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <LoadingSpinner size="sm" /> : (isEdit ? '更新' : '创建')}
        </Button>
      </div>
    </form>
  )
}

export default DialectManagement
