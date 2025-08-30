/**
 * 患者详情页面
 * 
 * 显示患者信息和该患者的所有指令
 */

import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, 
  Edit2, 
  Plus, 
  Play, 
  Command as CommandIcon,
  User,
  Calendar,
  FileText,
  AudioLines,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'

import { apiClient } from '../api/client'
import { formatGender } from '../utils/gender'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PatientEditDialog from '../components/patients/PatientEditDialog'
import AssignmentCreateDialog from '../components/patients/AssignmentCreateDialog'
import AssignmentEditDialog from '../components/patients/AssignmentEditDialog'

const PatientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAssignCommandDialogOpen, setIsAssignCommandDialogOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<any>(null)

  const patientId = parseInt(id || '0', 10)

  // 获取患者详情
  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => apiClient.getPatient(patientId),
    enabled: !!patientId,
  })

  // 获取患者的指令分配
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['patient-assignments', patientId],
    queryFn: () => apiClient.getPatientAssignments(patientId),
    enabled: !!patientId,
  })

  // 播放指令
  const playCommandMutation = useMutation({
    mutationFn: ({ commandId }: { commandId: string }) => 
      apiClient.triggerPlayback({ patient_id: patientId, command_id: commandId }),
    onSuccess: (data) => {
      toast.success(`正在播放：${data.command_content}`)
      // 实际播放音频
      console.log('播放音频:', data.audio_url)
      const audio = new Audio(data.audio_url)
      audio.play().catch(() => {
        toast.error('音频播放失败，请检查文件是否存在')
      })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '播放失败')
    }
  })

  // 解绑（删除）分配
  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId: number) => apiClient.deletePatientAssignment(assignmentId),
    onSuccess: () => {
      toast.success('已解除该术中指令绑定')
      queryClient.invalidateQueries({ queryKey: ['patient-assignments', patientId] })
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '解除绑定失败')
    }
  })

  const handleUnassign = (assignmentId: number, commandContent: string) => {
    if (window.confirm(`确定解除指令“${commandContent}”与该患者的绑定吗？`)) {
      deleteAssignmentMutation.mutate(assignmentId)
    }
  }



  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('zh-CN')
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const handlePlayCommand = (commandId: string) => {
    playCommandMutation.mutate({ commandId })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium">患者不存在</h2>
        <Button 
          variant="outline" 
          onClick={() => navigate('/patients')}
          className="mt-4"
        >
          返回患者列表
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/patients')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{patient.name}</h1>
            <p className="text-muted-foreground">患者详情和指令管理</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            编辑信息
          </Button>
          <Button onClick={() => setIsAssignCommandDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            分配指令
          </Button>
        </div>
      </div>

      {/* 患者信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">姓名</p>
              <p className="font-medium">{patient.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">性别</p>
              <p className="font-medium">{formatGender(patient.gender)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">出生日期</p>
              <p className="font-medium">{formatDate(patient.date_of_birth)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">创建时间</p>
              <p className="font-medium">{formatDateTime(patient.created_at)}</p>
            </div>
          </div>
          {patient.note && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">备注</p>
              <p className="font-medium">{patient.note}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分配统计 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{patient.total_assignments || 0}</p>
                <p className="text-sm text-muted-foreground">总分配数</p>
              </div>
              <CommandIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{patient.active_assignments || 0}</p>
                <p className="text-sm text-muted-foreground">激活分配</p>
              </div>
              <AudioLines className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {assignments?.filter(a => a.is_active).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">可播放指令</p>
              </div>
              <Play className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 指令列表 */}
      <Card>
        <CardHeader>
          <CardTitle>术中指令</CardTitle>
          <CardDescription>
            为该患者配置的所有术中指令
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignments && assignments.length > 0 ? (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{assignment.command_content}</h4>
                    {assignment.command_description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {assignment.command_description}
                      </p>
                    )}
                    <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                      <span>方言：{assignment.dialect_label}</span>
                      <span>说话人：{assignment.speaker_name}</span>
                      {assignment.duration_ms && (
                        <span>时长：{Math.round(assignment.duration_ms / 1000)}秒</span>
                      )}
                      <span className={`px-2 py-1 rounded ${
                        assignment.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {assignment.is_active ? '激活' : '未激活'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {assignment.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePlayCommand(assignment.command_id)}
                        disabled={playCommandMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        播放
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingAssignment(assignment)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleUnassign(assignment.id, assignment.command_content)}
                      disabled={deleteAssignmentMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      解绑
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CommandIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">还没有分配指令</h3>
              <p className="text-muted-foreground mb-4">
                为该患者分配第一个术中指令
              </p>
              <Button onClick={() => setIsAssignCommandDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                分配指令
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 对话框 */}
      {isEditDialogOpen && (
        <PatientEditDialog
          patient={patient}
          open={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSuccess={() => {
            setIsEditDialogOpen(false)
            queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
          }}
        />
      )}

      {isAssignCommandDialogOpen && (
        <AssignmentCreateDialog
          patientId={patientId}
          open={isAssignCommandDialogOpen}
          onClose={() => setIsAssignCommandDialogOpen(false)}
          onSuccess={() => {
            setIsAssignCommandDialogOpen(false)
            queryClient.invalidateQueries({ queryKey: ['patient-assignments', patientId] })
            queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
          }}
        />
      )}

      {/* 分配编辑对话框 */}
      {editingAssignment && (
        <AssignmentEditDialog
          assignment={editingAssignment}
          open={!!editingAssignment}
          onClose={() => setEditingAssignment(null)}
          onSuccess={() => {
            setEditingAssignment(null)
            queryClient.invalidateQueries({ queryKey: ['patient-assignments', patientId] })
            queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
          }}
        />
      )}
    </div>
  )
}

export default PatientDetailPage
