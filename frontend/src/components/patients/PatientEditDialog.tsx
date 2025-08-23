/**
 * 编辑患者对话框
 */

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'

import { apiClient } from '../../api/client'
import type { Patient, PatientUpdate } from '../../types/patient'
import { getGenderOptions } from '../../utils/gender'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Select } from '../ui/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog'

// 表单验证Schema
const patientUpdateSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(100, '姓名不能超过100个字符'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { required_error: '请选择性别' }),
  date_of_birth: z.string().optional(),
  note: z.string().max(500, '备注不能超过500个字符').optional(),
})

type PatientUpdateForm = z.infer<typeof patientUpdateSchema>

interface PatientEditDialogProps {
  patient: Patient
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const PatientEditDialog: React.FC<PatientEditDialogProps> = ({
  patient,
  open,
  onClose,
  onSuccess,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm<PatientUpdateForm>({
    resolver: zodResolver(patientUpdateSchema),
  })

  // 当患者数据变化时更新表单
  useEffect(() => {
    if (patient) {
      setValue('name', patient.name)
      setValue('gender', patient.gender)
      setValue('date_of_birth', patient.date_of_birth || '')
      setValue('note', patient.note || '')
    }
  }, [patient, setValue])

  const updatePatientMutation = useMutation({
    mutationFn: (data: PatientUpdate) => apiClient.updatePatient(patient.id, data),
    onSuccess: () => {
      toast.success('患者信息更新成功')
      onSuccess()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '更新失败')
    }
  })

  const onSubmit = (data: PatientUpdateForm) => {
    const patientData: PatientUpdate = {
      name: data.name,
      gender: data.gender,
      date_of_birth: data.date_of_birth || undefined,
      note: data.note || undefined,
    }
    updatePatientMutation.mutate(patientData)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑患者信息</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 姓名 */}
          <div>
            <Label className="block mb-2">
              姓名 <span className="text-red-500">*</span>
            </Label>
            <Input
              {...register('name')}
              placeholder="请输入患者姓名"
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* 性别 */}
          <div>
            <Label className="block mb-2">
              性别 <span className="text-red-500">*</span>
            </Label>
            <Select {...register('gender')}>
              <option value="">请选择性别</option>
              {getGenderOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {errors.gender && (
              <p className="text-sm text-red-500 mt-1">{errors.gender.message}</p>
            )}
          </div>

          {/* 出生日期 */}
          <div>
            <Label className="block mb-2">出生日期</Label>
            <Input
              type="date"
              {...register('date_of_birth')}
            />
            {errors.date_of_birth && (
              <p className="text-sm text-red-500 mt-1">{errors.date_of_birth.message}</p>
            )}
          </div>

          {/* 备注 */}
          <div>
            <Label className="block mb-2">备注</Label>
            <textarea
              {...register('note')}
              placeholder="语言偏好、特殊需求等"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            {errors.note && (
              <p className="text-sm text-red-500 mt-1">{errors.note.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={updatePatientMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={updatePatientMutation.isPending}
            >
              {updatePatientMutation.isPending ? '更新中...' : '更新患者'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default PatientEditDialog