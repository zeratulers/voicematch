/**
 * 系统设置组件
 * 
 * 管理全局系统参数配置
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, Edit, Eye, EyeOff, Settings } from 'lucide-react'

import { apiClient } from '../../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog'
import LoadingSpinner from '../ui/LoadingSpinner'

interface SystemSetting {
  key: string
  value: string
  description?: string
  is_sensitive: boolean
}

interface SettingFormData {
  key: string
  value: string
  description?: string
  is_sensitive: boolean
}

const SystemSettings: React.FC = () => {
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedSetting, setSelectedSetting] = useState<SystemSetting | null>(null)
  const [showSensitiveValues, setShowSensitiveValues] = useState(false)

  const queryClient = useQueryClient()

  // 获取系统设置
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiClient.getSystemSettings(),
  })

  // 更新系统设置
  const updateSettingMutation = useMutation({
    mutationFn: ({ key, settingData }: { key: string; settingData: SettingFormData }) =>
      apiClient.updateSystemSetting(key, settingData),
    onSuccess: () => {
      toast.success('系统设置已更新')
      setShowEditDialog(false)
      setSelectedSetting(null)
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    },
    onError: (error: any) => {
      toast.error(error.message || '更新系统设置失败')
    }
  })

  const handleEditSetting = (setting: SystemSetting) => {
    setSelectedSetting(setting)
    setShowEditDialog(true)
  }

  const handleUpdateSetting = (formData: SettingFormData) => {
    if (selectedSetting) {
      updateSettingMutation.mutate({ key: selectedSetting.key, settingData: formData })
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
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-bold">系统设置</h2>
        <p className="text-muted-foreground">
          配置全局系统参数、语音识别设置和安全策略
        </p>
      </div>

      {/* 敏感值显示控制 */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowSensitiveValues(!showSensitiveValues)}
        >
          {showSensitiveValues ? (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              隐藏敏感信息
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              显示敏感信息
            </>
          )}
        </Button>
      </div>

      {/* 系统设置列表 */}
      <div className="grid gap-6">
        {/* 语音识别设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              语音识别设置
            </CardTitle>
            <CardDescription>
              配置语音识别引擎参数和识别精度
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {settings?.filter(s => s.key.startsWith('voice_')).map((setting) => (
                <div key={setting.key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{setting.description || setting.key}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {setting.key}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {setting.is_sensitive && !showSensitiveValues ? '[HIDDEN]' : setting.value}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSetting(setting)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 存储设置 */}
        <Card>
          <CardHeader>
            <CardTitle>存储设置</CardTitle>
            <CardDescription>
              配置音频文件存储和保留策略
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {settings?.filter(s => s.key.startsWith('storage_')).map((setting) => (
                <div key={setting.key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{setting.description || setting.key}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {setting.key}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {setting.is_sensitive && !showSensitiveValues ? '[HIDDEN]' : setting.value}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSetting(setting)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 安全设置 */}
        <Card>
          <CardHeader>
            <CardTitle>安全设置</CardTitle>
            <CardDescription>
              配置认证、授权和安全策略
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {settings?.filter(s => s.key.startsWith('security_')).map((setting) => (
                <div key={setting.key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{setting.description || setting.key}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {setting.key}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {setting.is_sensitive && !showSensitiveValues ? '[HIDDEN]' : setting.value}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSetting(setting)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 其他设置 */}
        <Card>
          <CardHeader>
            <CardTitle>其他设置</CardTitle>
            <CardDescription>
              其他系统配置参数
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {settings?.filter(s => !s.key.startsWith('voice_') && !s.key.startsWith('storage_') && !s.key.startsWith('security_')).map((setting) => (
                <div key={setting.key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{setting.description || setting.key}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {setting.key}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {setting.is_sensitive && !showSensitiveValues ? '[HIDDEN]' : setting.value}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSetting(setting)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {settings?.length === 0 && (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              暂无系统设置
            </CardContent>
          </Card>
        )}
      </div>

      {/* 编辑设置对话框 */}
      <Dialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑系统设置</DialogTitle>
          </DialogHeader>
          {selectedSetting && (
            <SettingForm
              setting={selectedSetting}
              onSubmit={handleUpdateSetting}
              onCancel={() => setShowEditDialog(false)}
              isLoading={updateSettingMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 设置表单组件
interface SettingFormProps {
  setting: SystemSetting
  onSubmit: (data: SettingFormData) => void
  onCancel: () => void
  isLoading: boolean
}

const SettingForm: React.FC<SettingFormProps> = ({ 
  setting, 
  onSubmit, 
  onCancel, 
  isLoading 
}) => {
  const [formData, setFormData] = useState<SettingFormData>({
    key: setting.key,
    value: setting.value === '[HIDDEN]' ? '' : setting.value,
    description: setting.description || '',
    is_sensitive: setting.is_sensitive
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.value) {
      toast.error('设置值不能为空')
      return
    }
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">设置键</label>
        <Input
          value={formData.key}
          disabled
          className="bg-gray-50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          设置键不可修改
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">设置值 *</label>
        <Input
          value={formData.value}
          onChange={(e) => setFormData({ ...formData, value: e.target.value })}
          placeholder="请输入设置值"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">描述</label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="设置的详细说明"
        />
      </div>
      
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_sensitive}
            onChange={(e) => setFormData({ ...formData, is_sensitive: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm font-medium">敏感信息</span>
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          标记为敏感信息后，值将在界面上隐藏
        </p>
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <LoadingSpinner size="sm" /> : (
            <>
              <Save className="h-4 w-4 mr-2" />
              保存
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

export default SystemSettings
