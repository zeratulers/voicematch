/**
 * 创建指令对话框 - 重新设计版本
 * 
 * 创建指令库中的指令（不绑定特定患者）
 */

import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'

import { apiClient } from '../../api/client'
import type { CommandCreate } from '../../types/command'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog'

// 表单验证Schema
const commandCreateSchema = z.object({
  content: z.string().min(1, '指令内容不能为空').max(500, '指令内容不能超过500个字符'),
  description: z.string().max(1000, '描述不能超过1000个字符').optional(),
  is_template: z.boolean().optional(),
})

type CommandCreateForm = z.infer<typeof commandCreateSchema>

interface CommandCreateDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const CommandCreateDialog: React.FC<CommandCreateDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CommandCreateForm>({
    resolver: zodResolver(commandCreateSchema),
  })

  const createCommandMutation = useMutation({
    mutationFn: (data: CommandCreate) => apiClient.createCommand(data),
    onSuccess: () => {
      toast.success('指令创建成功')
      reset()
      onSuccess()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '创建失败')
    },
  })

  const onSubmit = (data: CommandCreateForm) => {
    createCommandMutation.mutate({
      content: data.content,
      description: data.description || undefined,
      is_template: data.is_template || false,
    })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建新指令</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 指令内容 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              指令内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register('content')}
              placeholder="请输入术中指令内容，如：请放松，不要紧张"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            {errors.content && (
              <p className="text-sm text-red-500 mt-1">{errors.content.message}</p>
            )}
          </div>

          {/* 指令描述 */}
          <div>
            <label className="block text-sm font-medium mb-2">指令描述</label>
            <Input
              {...register('description')}
              placeholder="如：术前安抚用语、呼吸指导等"
            />
            {errors.description && (
              <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* 模板选项（仅管理员可见） */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_template"
              {...register('is_template')}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_template" className="text-sm font-medium">
              设为系统模板（仅管理员）
            </label>
          </div>

          <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
            💡 <strong>提示：</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>创建指令后，您可以为其录制或上传不同方言的音频变体</li>
              <li>指令可以分配给多个患者使用</li>
              <li>每个患者可以使用不同的方言变体</li>
            </ul>
          </div>

          {/* 操作按钮 */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createCommandMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={createCommandMutation.isPending}
            >
              {createCommandMutation.isPending ? '创建中...' : '创建指令'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CommandCreateDialog