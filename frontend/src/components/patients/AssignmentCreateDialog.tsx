/**
 * 患者指令分配对话框
 * 
 * 允许医生将指令库中的指令分配给患者
 */

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'
import { Search, Command as CommandIcon } from 'lucide-react'

import { apiClient } from '../../api/client'
import type { PatientAssignmentCreate } from '../../types/assignment'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog'
import { Select } from '../ui/Select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import LoadingSpinner from '../ui/LoadingSpinner'

// 表单验证Schema
const assignmentCreateSchema = z.object({
  command_id: z.string().min(1, '请选择指令'),
  variant_id: z.number().min(1, '请选择变体'),
  note: z.string().optional(),
})

type AssignmentCreateForm = z.infer<typeof assignmentCreateSchema>

interface AssignmentCreateDialogProps {
  patientId: number
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const AssignmentCreateDialog: React.FC<AssignmentCreateDialogProps> = ({
  patientId,
  open,
  onClose,
  onSuccess,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCommand, setSelectedCommand] = useState<any>(null)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<AssignmentCreateForm>({
    resolver: zodResolver(assignmentCreateSchema),
  })

  const watchCommandId = watch('command_id')

  // 获取可分配的指令（指令库中启用的指令）
  const { data: commands, isLoading: commandsLoading } = useQuery({
    queryKey: ['available-commands'],
    queryFn: () => apiClient.getCommands({ 
      page: 1, 
      size: 100, 
      is_template: undefined  // 包括模板和自己创建的指令
    }),
  })

  // 获取已分配的指令，用于过滤
  const { data: existingAssignments } = useQuery({
    queryKey: ['patient-assignments', patientId],
    queryFn: () => apiClient.getPatientAssignments(patientId),
    enabled: !!patientId,
  })

  // 获取选中指令的变体
  const { data: variants, isLoading: variantsLoading } = useQuery({
    queryKey: ['command-variants', watchCommandId],
    queryFn: () => apiClient.getCommandVariants(watchCommandId),
    enabled: !!watchCommandId,
  })

  // 创建分配
  const createAssignmentMutation = useMutation({
    mutationFn: (data: PatientAssignmentCreate) => 
      apiClient.createPatientAssignment(data),
    onSuccess: () => {
      toast.success('指令分配成功')
      reset()
      setSelectedCommand(null)
      onSuccess()
    },
    onError: (error: any) => {
      console.error('Error creating assignment:', error)
      toast.error(error.response?.data?.detail || '分配失败')
    },
  })

  const onSubmit = async (data: AssignmentCreateForm) => {
    if (!selectedCommand) {
      toast.error('请选择指令')
      return
    }

    createAssignmentMutation.mutate({
      patient_id: patientId,
      command_id: data.command_id,
      variant_id: data.variant_id,
      note: data.note || `分配指令：${selectedCommand.content}`,
    })
  }

  const handleClose = () => {
    reset()
    setSelectedCommand(null)
    setSearchTerm('')
    onClose()
  }

  const handleCommandSelect = (command: any) => {
    setSelectedCommand(command)
    setValue('command_id', command.id)
    setValue('variant_id', '') // 重置变体选择
  }

  // 过滤掉已分配的指令
  const existingCommandIds = existingAssignments?.map(a => a.command_id) || []
  const availableCommands = commands?.items?.filter(cmd => 
    cmd.is_active && 
    !existingCommandIds.includes(cmd.id) &&
    cmd.content.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  // 过滤启用的变体
  const activeVariants = variants?.filter(v => v.is_active) || []

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>分配指令</DialogTitle>
          <p className="text-sm text-muted-foreground">
            从指令库中选择指令和变体分配给患者
          </p>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex space-x-6">
          {/* 左侧：指令列表 */}
          <div className="flex-1 flex flex-col">
            <div className="mb-4">
              <Label className="block mb-2">搜索指令</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索指令内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {commandsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : availableCommands.length > 0 ? (
                availableCommands.map((command) => (
                  <Card 
                    key={command.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedCommand?.id === command.id 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleCommandSelect(command)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{command.content}</CardTitle>
                        {command.is_template && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            模板
                          </span>
                        )}
                      </div>
                      {command.description && (
                        <CardDescription className="text-xs">
                          {command.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CommandIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>没有可分配的指令</p>
                  <p className="text-sm">所有指令都已分配给该患者</p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：变体选择和表单 */}
          <div className="w-80 flex flex-col">
            {selectedCommand ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* 隐藏的指令ID字段 */}
                <input type="hidden" {...register('command_id')} />
                
                <div>
                  <Label className="block mb-2">已选择指令</Label>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="font-medium text-sm">{selectedCommand.content}</p>
                      {selectedCommand.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedCommand.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Label className="block mb-2">
                    选择变体 <span className="text-red-500">*</span>
                  </Label>
                  {variantsLoading ? (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : (
                    <Select 
                      {...register('variant_id', { valueAsNumber: true })}
                    >
                      <option value="">请选择变体</option>
                      {activeVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.dialect_set.label} - {variant.speaker_name}
                          {variant.duration_ms && ` (${Math.round(variant.duration_ms / 1000)}秒)`}
                        </option>
                      ))}
                    </Select>
                  )}
                  {errors.variant_id && (
                    <p className="text-sm text-red-500 mt-1">{errors.variant_id.message}</p>
                  )}
                </div>

                <div>
                  <Label className="block mb-2">备注</Label>
                  <Input
                    {...register('note')}
                    placeholder="可选的备注信息"
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    取消
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createAssignmentMutation.isPending || !selectedCommand}
                  >
                    分配指令
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <CommandIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>请从左侧选择一个指令</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AssignmentCreateDialog
