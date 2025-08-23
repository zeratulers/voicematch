/**
 * 仪表板页面
 * 
 * 显示医生的概览信息：患者数量、指令统计、最近播放等
 */

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Command, AudioLines, Activity } from 'lucide-react'

import { apiClient } from '../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const DashboardPage: React.FC = () => {
  // 获取医生指令统计
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['doctor-stats'],
    queryFn: () => apiClient.getDoctorCommandStats(),
  })

  if (statsLoading) {
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
        <h1 className="text-3xl font-bold tracking-tight">仪表板</h1>
        <p className="text-muted-foreground">
          欢迎回来，{stats?.doctor_name || '医生'}！这里是您的工作概览。
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">患者总数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_patients || 0}</div>
            <p className="text-xs text-muted-foreground">
              您管理的患者数量
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">指令总数</CardTitle>
            <Command className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_commands || 0}</div>
            <p className="text-xs text-muted-foreground">
              已创建的术中指令
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">音频变体</CardTitle>
            <AudioLines className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_variants || 0}</div>
            <p className="text-xs text-muted-foreground">
              可用的音频变体总数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均指令/患者</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_patients && stats.total_patients > 0 
                ? Math.round((stats.total_commands / stats.total_patients) * 10) / 10
                : 0
              }
            </div>
            <p className="text-xs text-muted-foreground">
              每位患者的指令数量
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 患者列表 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>患者概览</CardTitle>
            <CardDescription>
              您管理的患者及其指令情况
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.patients?.map((patient) => (
                <div
                  key={patient.patient_id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <h4 className="font-medium">{patient.patient_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {patient.patient_gender === 'M' ? '男' : 
                       patient.patient_gender === 'F' ? '女' : '其他'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {patient.total_commands}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      指令数量
                    </p>
                  </div>
                </div>
              ))}
              
              {(!stats?.patients || stats.patients.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>还没有患者，去创建第一个患者吧！</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
            <CardDescription>
              常用的操作快捷入口
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/patients'}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <Users className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <h4 className="font-medium">管理患者</h4>
                  <p className="text-sm text-muted-foreground">查看和编辑患者信息</p>
                </div>
              </button>
              
              <button
                onClick={() => window.location.href = '/commands'}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <Command className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <h4 className="font-medium">指令库</h4>
                  <p className="text-sm text-muted-foreground">管理术中指令</p>
                </div>
              </button>
              
              <button
                onClick={() => window.location.href = '/console'}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <AudioLines className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <h4 className="font-medium">术中控制台</h4>
                  <p className="text-sm text-muted-foreground">实时语音播放</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DashboardPage
