/**
 * 患者管理页面
 * 
 * 显示患者列表，支持搜索、创建、编辑和删除患者
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit2, Trash2, Eye, Users } from 'lucide-react'
import { toast } from 'sonner'

import { apiClient } from '../api/client'
import type { Patient, PatientCreate } from '../types/patient'
import { formatGender } from '../utils/gender'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PatientCreateDialog from '../components/patients/PatientCreateDialog'
import PatientEditDialog from '../components/patients/PatientEditDialog'

const PatientsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  
  const queryClient = useQueryClient()

  // 获取患者列表
  const { data: patientsData, isLoading } = useQuery({
    queryKey: ['patients', currentPage, searchTerm],
    queryFn: () => apiClient.getPatients({
      page: currentPage,
      size: 20,
      search: searchTerm || undefined
    }),
  })

  // 删除患者
  const deletePatientMutation = useMutation({
    mutationFn: (id: number) => apiClient.deletePatient(id),
    onSuccess: () => {
      toast.success('患者已删除')
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '删除失败')
    }
  })

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleDeletePatient = (patient: Patient) => {
    if (window.confirm(`确定要删除患者 "${patient.name}" 吗？这将同时删除该患者的所有指令。`)) {
      deletePatientMutation.mutate(patient.id)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('zh-CN')
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">患者管理</h1>
          <p className="text-muted-foreground">
            管理您的患者信息和术中指令设置
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增患者
        </Button>
      </div>

      {/* 搜索栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索患者姓名..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* 患者列表 */}
      <Card>
        <CardHeader>
          <CardTitle>患者列表</CardTitle>
          <CardDescription>
            共 {patientsData?.total || 0} 位患者
          </CardDescription>
        </CardHeader>
        <CardContent>
          {patientsData?.items && patientsData.items.length > 0 ? (
            <div className="space-y-4">
              {patientsData.items.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{patient.name}</h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>患者ID：{patient.id}</p>
                        <p>性别：{formatGender(patient.gender)}</p>
                        <p>出生日期：{formatDate(patient.date_of_birth)}</p>
                        {patient.note && (
                          <p className="text-xs">备注：{patient.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/patients/${patient.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      查看详情
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPatient(patient)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletePatient(patient)}
                      disabled={deletePatientMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">还没有患者</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? '没有找到匹配的患者' : '开始创建您的第一个患者档案'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  创建患者
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {patientsData && patientsData.pages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            上一页
          </Button>
          <span className="flex items-center px-4">
            第 {currentPage} 页，共 {patientsData.pages} 页
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(Math.min(patientsData.pages, currentPage + 1))}
            disabled={currentPage === patientsData.pages}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 对话框 */}
      <PatientCreateDialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={() => {
          setIsCreateDialogOpen(false)
          queryClient.invalidateQueries({ queryKey: ['patients'] })
        }}
      />

      {editingPatient && (
        <PatientEditDialog
          patient={editingPatient}
          open={Boolean(editingPatient)}
          onClose={() => setEditingPatient(null)}
          onSuccess={() => {
            setEditingPatient(null)
            queryClient.invalidateQueries({ queryKey: ['patients'] })
          }}
        />
      )}
    </div>
  )
}

export default PatientsPage
