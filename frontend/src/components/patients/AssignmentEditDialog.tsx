/**
 * 患者指令分配编辑对话框
 * 
 * 编辑患者的指令变体绑定，支持录制新变体
 */

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'
import { Mic, Upload, Plus, AudioLines, Globe } from 'lucide-react'

import { apiClient } from '../../api/client'
import type { 
  PatientAssignmentWithDetails, 
  CommandVariantWithDialect, 
  CommandVariantCreate 
} from '../../types/command'
import { Button } from '../ui/Button'
import { Label } from '../ui/Label'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog'
import AudioRecorder from '../ui/AudioRecorder'

// 表单验证Schema
const assignmentEditSchema = z.object({
  variant_id: z.number().min(1, '请选择变体'),
  note: z.string().max(500, '备注不能超过500个字符').optional(),
})

type AssignmentEditForm = z.infer<typeof assignmentEditSchema>

interface AssignmentEditDialogProps {
  assignment: PatientAssignmentWithDetails
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const AssignmentEditDialog: React.FC<AssignmentEditDialogProps> = ({
  assignment,
  open,
  onClose,
  onSuccess,
}) => {
  const [showNewVariantForm, setShowNewVariantForm] = useState(false)
  const [audioSource, setAudioSource] = useState<'upload' | 'record'>('record')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedDuration, setRecordedDuration] = useState<number>(0)
  const [selectedDialectId, setSelectedDialectId] = useState<number>(0)
  const [speakerName, setSpeakerName] = useState('')
  const [speakerNote, setSpeakerNote] = useState('')
  const [pendingVariantId, setPendingVariantId] = useState<number | null>(null)
  
  const queryClient = useQueryClient()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AssignmentEditForm>({
    resolver: zodResolver(assignmentEditSchema),
    defaultValues: {
      variant_id: assignment.variant_id,
      note: assignment.note || '',
    }
  })

  // 获取指令的所有变体
  const { data: variants, isLoading: variantsLoading } = useQuery({
    queryKey: ['command-variants', assignment.command_id],
    queryFn: () => apiClient.getCommandVariants(assignment.command_id),
    enabled: open,
  })

  // 获取方言列表
  const { data: dialectSets } = useQuery({
    queryKey: ['dialect-sets'],
    queryFn: () => apiClient.getDialectSets(),
    enabled: open && showNewVariantForm,
  })

  // 监听变体列表变化，自动选择新创建的变体
  useEffect(() => {
    if (pendingVariantId && variants && variants.length > 0) {
      const newVariant = variants.find(v => v.id === pendingVariantId)
      if (newVariant) {
        console.log('找到新变体，自动选择:', pendingVariantId)
        setValue('variant_id', pendingVariantId)
        setPendingVariantId(null)
      }
    }
  }, [variants, pendingVariantId, setValue])

  // 更新分配
  const updateAssignmentMutation = useMutation({
    mutationFn: (data: { variant_id: number, note?: string }) => 
      apiClient.updatePatientAssignment(assignment.id, data),
    onSuccess: () => {
      toast.success('分配已更新')
      onSuccess()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '更新失败')
    },
  })

  // 上传音频
  const uploadMutation = useMutation({
    mutationFn: (file: File) => apiClient.uploadAudio(file),
    onSuccess: (data) => {
      toast.success('音频上传成功')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '音频上传失败')
    },
  })

  // 创建新变体
  const createVariantMutation = useMutation({
    mutationFn: (data: CommandVariantCreate) => 
      apiClient.createCommandVariant(assignment.command_id, data),
    onSuccess: (newVariant) => {
      toast.success('新变体创建成功')
      setShowNewVariantForm(false)
      // 重置录音相关状态
      setAudioFile(null)
      setRecordedBlob(null)
      setRecordedDuration(0)
      setSpeakerName('')
      setSpeakerNote('')
      setAudioSource('record')
      // 设置待选中的变体ID，等待变体列表刷新后自动选择
      console.log('新变体创建成功，ID:', newVariant.id)
      setPendingVariantId(newVariant.id)
      // 刷新变体列表
      queryClient.invalidateQueries({ queryKey: ['command-variants', assignment.command_id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '创建变体失败')
    },
  })

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('audio/')) {
        toast.error('请选择音频文件')
        return
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error('文件大小不能超过10MB')
        return
      }
      
      setAudioFile(file)
      setRecordedBlob(null)
      uploadMutation.mutate(file)
    }
  }

  const handleRecordingComplete = (audioBlob: Blob | null, audioUrl?: string) => {
    if (audioBlob) {
      const timestamp = Date.now()
      const file = new File([audioBlob], `recording-${timestamp}.webm`, { 
        type: 'audio/webm' 
      })
      
      console.log('Recording completed')
      setRecordedBlob(audioBlob)
      setRecordedDuration(10) // 默认时长，实际应该从音频文件获取
      setAudioFile(file) // 设置为文件，确保有文件对象
      
      console.log('State after recording')
      
      uploadMutation.mutate(file)
    } else {
      // 清除录音
      setRecordedBlob(null)
      setRecordedDuration(0)
      setAudioFile(null)
    }
  }

  const handleCreateNewVariant = async () => {
    if (!selectedDialectId) {
      toast.error('请选择方言类型')
      return
    }

    if (!speakerName.trim()) {
      toast.error('请输入说话人姓名')
      return
    }

    if (!audioFile && !recordedBlob) {
      toast.error('请先录制或上传音频文件')
      return
    }

    if (uploadMutation.isPending) {
      toast.error('请等待音频上传完成')
      return
    }

    if (!uploadMutation.data) {
      toast.error('音频上传未完成，请重新操作')
      return
    }

    // 优先使用后端分析的时长，如果为空则使用前端录音时长
    const backendDuration = uploadMutation.data.duration_ms
    const frontendDuration = recordedDuration
    
    let finalDuration = null
    if (backendDuration && backendDuration > 0) {
      finalDuration = backendDuration
    } else if (frontendDuration && frontendDuration > 0 && isFinite(frontendDuration)) {
      finalDuration = frontendDuration
    }
    
    console.log('=== Duration calculation ===')
    console.log('backendDuration:', backendDuration)
    console.log('frontendDuration (recordedDuration):', frontendDuration)
    console.log('audioSource:', audioSource)
    console.log('finalDuration:', finalDuration)
    console.log('Current recordedDuration state:', recordedDuration)
    console.log('===========================')

    createVariantMutation.mutate({
      dialect_set_id: selectedDialectId,
      audio_url: uploadMutation.data.audio_url,
      duration_ms: finalDuration,
      speaker_name: speakerName || undefined,
      speaker_note: speakerNote || undefined,
    })
  }

  const onSubmit = (data: AssignmentEditForm) => {
    updateAssignmentMutation.mutate({
      variant_id: data.variant_id,
      note: data.note || undefined,
    })
  }

  const handleClose = () => {
    reset()
    setShowNewVariantForm(false)
    setAudioFile(null)
    setRecordedBlob(null)
    setRecordedDuration(0)
    setSelectedDialectId(0)
    setSpeakerName('')
    setSpeakerNote('')
    setPendingVariantId(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑患者指令分配</DialogTitle>
          <p className="text-sm text-muted-foreground">
            指令：{assignment.command_content}
          </p>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* 现有变体选择 */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label className="block mb-2">
                选择方言变体 <span className="text-red-500">*</span>
              </Label>
              <Select {...register('variant_id', { valueAsNumber: true })}>
                <option value="">请选择变体</option>
                {variants?.map(variant => (
                  <option key={variant.id} value={variant.id}>
                    {variant.dialect_set.label} 
                    {variant.speaker_name && ` - ${variant.speaker_name}`}
                    {variant.duration_ms && ` (${Math.round(variant.duration_ms / 1000)}秒)`}
                    {!variant.is_active && ' [已禁用]'}
                  </option>
                ))}
              </Select>
              {errors.variant_id && (
                <p className="text-sm text-red-500 mt-1">{errors.variant_id.message}</p>
              )}
            </div>

            <div>
              <Label className="block mb-2">备注</Label>
              <Input
                {...register('note')}
                placeholder="如：患者偏好、特殊要求等"
              />
              {errors.note && (
                <p className="text-sm text-red-500 mt-1">{errors.note.message}</p>
              )}
            </div>

            {/* 当前选中的变体信息 */}
            {watch('variant_id') && variants && (
              <div className="p-3 bg-muted rounded-md">
                {(() => {
                  const selectedVariant = variants.find(v => v.id === watch('variant_id'))
                  if (!selectedVariant) return null
                  
                  return (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Globe className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{selectedVariant.dialect_set.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedVariant.speaker_name && `说话人：${selectedVariant.speaker_name} • `}
                            时长：{Math.round(selectedVariant.duration_ms / 1000)}秒
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const audio = new Audio(selectedVariant.audio_url)
                          audio.play().catch(() => {
                            toast.error('音频播放失败')
                          })
                        }}
                      >
                        <AudioLines className="h-4 w-4 mr-1" />
                        播放
                      </Button>
                    </div>
                  )
                })()}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewVariantForm(!showNewVariantForm)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {showNewVariantForm ? '取消创建' : '创建新变体'}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={updateAssignmentMutation.isPending}
              >
                取消
              </Button>
              
              <Button
                type="submit"
                disabled={updateAssignmentMutation.isPending}
              >
                {updateAssignmentMutation.isPending ? '更新中...' : '更新分配'}
              </Button>
            </DialogFooter>
          </form>

          {/* 创建新变体表单 */}
          {showNewVariantForm && (
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-medium">为该患者创建专属变体</h3>
              
              {/* 方言选择 */}
              <div>
                <Label className="block mb-2">
                  方言类型 <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={selectedDialectId} 
                  onChange={(e) => setSelectedDialectId(Number(e.target.value))}
                >
                  <option value="">请选择方言</option>
                  {dialectSets?.map(dialect => (
                    <option key={dialect.id} value={dialect.id}>
                      {dialect.label} ({dialect.key})
                      {dialect.is_default && ' - 默认'}
                    </option>
                  ))}
                </Select>
              </div>

              {/* 音频来源选择 */}
              <div>
                <Label className="block mb-2">音频来源</Label>
                <div className="flex space-x-4 mb-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="record"
                      checked={audioSource === 'record'}
                      onChange={(e) => setAudioSource(e.target.value as 'record')}
                      className="mr-2"
                    />
                    现场录音
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="upload"
                      checked={audioSource === 'upload'}
                      onChange={(e) => setAudioSource(e.target.value as 'upload')}
                      className="mr-2"
                    />
                    上传文件
                  </label>
                </div>

                {audioSource === 'record' && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <AudioRecorder
                      onAudioChange={handleRecordingComplete}
                      disabled={uploadMutation.isPending}
                      maxDuration={30}
                    />
                  </div>
                )}

                {audioSource === 'upload' && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="new-variant-upload"
                      disabled={uploadMutation.isPending}
                    />
                    <label 
                      htmlFor="new-variant-upload" 
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">
                        {audioFile ? audioFile.name : '点击选择音频文件'}
                      </span>
                    </label>
                  </div>
                )}

                {uploadMutation.isSuccess && (
                  <div className="text-xs text-green-600 mt-2">
                    <p>✓ {audioSource === 'record' ? '录音' : '上传'}成功</p>
                    <p>后端分析时长：{uploadMutation.data?.duration_ms ? Math.round(uploadMutation.data.duration_ms / 1000) : '无'}秒</p>
                    {audioSource === 'record' && recordedDuration > 0 && (
                      <p>前端录音时长：{Math.round(recordedDuration / 1000)}秒</p>
                    )}
                  </div>
                )}
              </div>

              {/* 说话人信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="block mb-2">
                    说话人姓名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={speakerName}
                    onChange={(e) => setSpeakerName(e.target.value)}
                    placeholder="如：张医生、小李等"
                    required
                  />
                </div>
                <div>
                  <Label className="block mb-2">说话人备注</Label>
                  <Input
                    value={speakerNote}
                    onChange={(e) => setSpeakerNote(e.target.value)}
                    placeholder="如：女声、温柔语调等"
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={handleCreateNewVariant}
                disabled={
                  createVariantMutation.isPending ||
                  uploadMutation.isPending ||
                  !selectedDialectId ||
                  (!audioFile && !recordedBlob) ||
                  !uploadMutation.isSuccess ||
                  !speakerName.trim()
                }
                className="w-full"
              >
                {createVariantMutation.isPending ? '创建中...' : '创建并选择此变体'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AssignmentEditDialog
