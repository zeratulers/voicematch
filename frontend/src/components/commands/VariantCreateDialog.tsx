/**
 * 创建变体对话框
 * 
 * 为指令创建新的方言变体
 */

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'

import { apiClient } from '../../api/client'
import type { CommandVariantCreate, DialectSet } from '../../types/command'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Select } from '../ui/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog'
import AudioRecorder from '../ui/AudioRecorder'

// 表单验证Schema
const variantCreateSchema = z.object({
  dialect_set_id: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, '请选择方言')),
  speaker_name: z.string().min(1, '请输入说话人姓名').max(100, '说话人姓名不能超过100个字符'),
  speaker_note: z.string().max(500, '说话人备注不能超过500个字符').optional(),
})

type VariantCreateForm = z.infer<typeof variantCreateSchema>

interface VariantCreateDialogProps {
  commandId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const VariantCreateDialog: React.FC<VariantCreateDialogProps> = ({
  commandId,
  open,
  onClose,
  onSuccess,
}) => {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [audioSource, setAudioSource] = useState<'upload' | 'record'>('upload')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedDuration, setRecordedDuration] = useState<number>(0)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    trigger,
    getValues,
  } = useForm<VariantCreateForm>({
    resolver: zodResolver(variantCreateSchema),
  })

  // 获取方言列表
  const { data: dialectSets, isLoading: dialectsLoading } = useQuery({
    queryKey: ['dialect-sets'],
    queryFn: () => apiClient.getDialectSets(),
  })

  // 上传音频文件
  const uploadMutation = useMutation({
    mutationFn: (file: File) => apiClient.uploadAudio(file),
    onSuccess: (data) => {
      setValue('duration_ms', data.duration_ms)
      toast.success('音频上传成功')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '音频上传失败')
      setAudioFile(null)
    },
  })

  // 创建变体
  const createVariantMutation = useMutation({
    mutationFn: (data: CommandVariantCreate) => {
      console.log('Calling API with:', commandId, data)
      return apiClient.createCommandVariant(commandId, data)
    },
    onSuccess: (result) => {
      console.log('Variant created successfully:', result)
      toast.success('变体创建成功')
      reset()
      setAudioFile(null)
      setRecordedBlob(null)
      setRecordedDuration(0) // 重置录音时长
      setUploadProgress(0)
      setAudioSource('upload')
      onSuccess()
    },
    onError: (error: any) => {
      console.error('Error creating variant:', error)
      toast.error(error.response?.data?.detail || '创建失败')
    },
  })

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 检查文件类型
      if (!file.type.startsWith('audio/')) {
        toast.error('请选择音频文件')
        return
      }
      
      // 检查文件大小（限制为10MB）
      if (file.size > 10 * 1024 * 1024) {
        toast.error('文件大小不能超过10MB')
        return
      }
      
      setAudioFile(file)
      setRecordedBlob(null) // 清除录音
      uploadMutation.mutate(file)
    }
  }

  const handleRecordingComplete = (audioBlob: Blob | null, audioUrl?: string) => {
    if (audioBlob) {
      // 将 Blob 转换为 File 对象，确保有正确的扩展名
      const timestamp = Date.now()
      const file = new File([audioBlob], `recording-${timestamp}.webm`, { 
        type: 'audio/webm' 
      })
      
      console.log('Recording completed')
      setRecordedBlob(audioBlob)
      setRecordedDuration(10) // 默认时长，实际应该从音频文件获取
      setAudioFile(file) // 设置为文件，而不是清空
      
      console.log('State after recording')
      
      // 上传录音
      uploadMutation.mutate(file)
    } else {
      // 清除录音
      setRecordedBlob(null)
      setRecordedDuration(0)
      setAudioFile(null)
    }
  }

  const onSubmit = async (data: VariantCreateForm) => {
    console.log('Form submitted with data:', data)
    console.log('audioFile:', audioFile)
    console.log('recordedBlob:', recordedBlob)
    console.log('uploadMutation.data:', uploadMutation.data)
    console.log('uploadMutation.isPending:', uploadMutation.isPending)
    console.log('uploadMutation.isSuccess:', uploadMutation.isSuccess)

    if (!audioFile && !recordedBlob) {
      toast.error('请先录制或上传音频文件')
      return
    }

    // 等待音频上传完成
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
    
    console.log('Creating variant with data:', {
      dialect_set_id: data.dialect_set_id,
      audio_url: uploadMutation.data.audio_url,
      duration_ms: finalDuration,
      speaker_name: data.speaker_name || undefined,
      speaker_note: data.speaker_note || undefined,
    })
    
    createVariantMutation.mutate({
      dialect_set_id: data.dialect_set_id,
      audio_url: uploadMutation.data.audio_url,
      duration_ms: finalDuration,
      speaker_name: data.speaker_name || undefined,
      speaker_note: data.speaker_note || undefined,
    })
  }

  const handleClose = () => {
    reset()
    setAudioFile(null)
    setRecordedBlob(null)
    setRecordedDuration(0)
    setUploadProgress(0)
    setAudioSource('upload')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加方言变体</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit((data) => {
          console.log('Form handleSubmit called with:', data)
          console.log('Form errors:', errors)
          onSubmit(data)
        })} className="space-y-4">
          {/* 方言选择 */}
          <div>
            <Label className="block mb-2">
              方言类型 <span className="text-red-500">*</span>
            </Label>
            <Select 
              {...register('dialect_set_id')}
              id="dialect_set_id"
              name="dialect_set_id"
            >
              <option value="">请选择方言</option>
              {dialectSets?.map(dialect => (
                <option key={dialect.id} value={dialect.id}>
                  {dialect.label} ({dialect.key})
                  {dialect.is_default && ' - 默认'}
                </option>
              ))}
            </Select>
            {errors.dialect_set_id && (
              <p className="text-sm text-red-500 mt-1">{errors.dialect_set_id.message}</p>
            )}
          </div>

          {/* 音频来源选择 */}
          <div>
            <Label className="block mb-2">
              音频来源 <span className="text-red-500">*</span>
            </Label>
            <div className="flex space-x-4 mb-4">
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
            </div>

            {audioSource === 'upload' && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="audio-upload"
                  disabled={uploadMutation.isPending}
                />
                <label 
                  htmlFor="audio-upload" 
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    {audioFile ? audioFile.name : '点击选择音频文件'}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    支持 MP3, WAV, M4A 等格式，最大 10MB
                  </span>
                </label>
              </div>
            )}

            {audioSource === 'record' && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <AudioRecorder
                  onAudioChange={handleRecordingComplete}
                  disabled={uploadMutation.isPending}
                  maxDuration={30}
                />
              </div>
            )}
            
            {uploadMutation.isPending && (
              <div className="mt-2">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">上传中...</p>
              </div>
            )}
            
            {uploadMutation.isSuccess && (
              <div className="text-xs text-green-600 mt-1">
                <p>✓ {audioSource === 'record' ? '录音' : '上传'}成功</p>
                <p>后端分析时长：{uploadMutation.data?.duration_ms ? Math.round(uploadMutation.data.duration_ms / 1000) : '无'}秒</p>
                {audioSource === 'record' && recordedDuration > 0 && (
                  <p>前端录音时长：{Math.round(recordedDuration / 1000)}秒</p>
                )}
              </div>
            )}
          </div>

          {/* 说话人信息 */}
          <div>
            <Label className="block mb-2">
              说话人姓名 <span className="text-red-500">*</span>
            </Label>
            <Input
              {...register('speaker_name')}
              id="speaker_name"
              name="speaker_name"
              placeholder="如：张医生、小李等"
              required
            />
            {errors.speaker_name && (
              <p className="text-sm text-red-500 mt-1">{errors.speaker_name.message}</p>
            )}
          </div>

          <div>
            <Label className="block mb-2">说话人备注</Label>
            <Input
              {...register('speaker_note')}
              id="speaker_note"
              name="speaker_note"
              placeholder="如：女声、温柔语调、专业医生等"
            />
            {errors.speaker_note && (
              <p className="text-sm text-red-500 mt-1">{errors.speaker_note.message}</p>
            )}
          </div>

          <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
            💡 <strong>提示：</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>请选择合适的方言类型</li>
              <li>音频质量建议：清晰、无噪音、语速适中</li>
              <li>创建后可以在指令详情页面中管理</li>
            </ul>
          </div>

          {/* 操作按钮 */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createVariantMutation.isPending || uploadMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              onClick={async (e) => {
                console.log('Button clicked!')
                console.log('Button disabled state:', {
                  createVariantMutation_isPending: createVariantMutation.isPending,
                  uploadMutation_isPending: uploadMutation.isPending,
                  hasAudio: !!(audioFile || recordedBlob),
                  uploadMutation_isSuccess: uploadMutation.isSuccess
                })
                
                // 手动触发验证
                const isValid = await trigger()
                console.log('Form is valid:', isValid)
                console.log('Current form values:', getValues())
                console.log('Form errors:', errors)
              }}
              disabled={
                createVariantMutation.isPending || 
                uploadMutation.isPending || 
                (!audioFile && !recordedBlob) || 
                !uploadMutation.isSuccess
              }
            >
              {createVariantMutation.isPending ? '创建中...' : '创建变体'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default VariantCreateDialog
