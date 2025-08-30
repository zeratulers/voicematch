/**
 * 管理员页面
 * 
 * 系统管理功能
 */

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Settings, Users, Database, Shield, Plus, Edit, Trash2, Eye, Lock, Unlock } from 'lucide-react'
import UserManagement from '../components/admin/UserManagement'
import DialectManagement from '../components/admin/DialectManagement'
import SystemSettings from '../components/admin/SystemSettings'
import AuditLogs from '../components/admin/AuditLogs'

type AdminTab = 'overview' | 'users' | 'dialects' | 'settings' | 'logs'

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')

  const tabs = [
    { id: 'overview', label: '概览', icon: Settings },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'dialects', label: '方言设置', icon: Database },
    { id: 'settings', label: '系统设置', icon: Settings },
    { id: 'logs', label: '审计日志', icon: Shield },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />
      case 'dialects':
        return <DialectManagement />
      case 'settings':
        return <SystemSettings />
      case 'logs':
        return <AuditLogs />
      default:
        return (
          <div className="space-y-6">
            {/* 管理功能卡片 */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    用户管理
                  </CardTitle>
                  <CardDescription>
                    管理医生账户和权限
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    创建、编辑和删除医生账户，设置用户权限和角色
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setActiveTab('users')}
                  >
                    管理用户
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    方言设置
                  </CardTitle>
                  <CardDescription>
                    管理支持的方言类型
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    添加、编辑和删除方言集合，设置默认方言
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setActiveTab('dialects')}
                  >
                    方言管理
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    系统设置
                  </CardTitle>
                  <CardDescription>
                    全局系统参数配置
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    配置语音识别参数、存储设置、安全策略等
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setActiveTab('settings')}
                  >
                    系统配置
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    审计日志
                  </CardTitle>
                  <CardDescription>
                    查看系统操作记录
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    查看用户操作记录、播放历史和系统事件
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setActiveTab('logs')}
                  >
                    查看日志
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* 系统状态 */}
            <Card>
              <CardHeader>
                <CardTitle>系统状态</CardTitle>
                <CardDescription>
                  当前系统运行状态概览
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">正常</div>
                    <p className="text-sm text-muted-foreground">API服务</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">正常</div>
                    <p className="text-sm text-muted-foreground">数据库</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">运行中</div>
                    <p className="text-sm text-muted-foreground">语音引擎</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">正常</div>
                    <p className="text-sm text-muted-foreground">存储服务</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">系统管理</h1>
        <p className="text-muted-foreground">
          管理系统设置、用户权限和全局配置
        </p>
      </div>

      {/* 标签页导航 */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`
                  py-2 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-4 w-4 inline mr-2" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* 标签页内容 */}
      {renderTabContent()}
    </div>
  )
}

export default AdminPage
