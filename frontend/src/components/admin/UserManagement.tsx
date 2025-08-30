/**
 * 用户管理组件
 * 
 * 管理医生账户和权限
 */

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Lock, 
  Unlock, 
  Search,
  Filter,
  MoreHorizontal
} from 'lucide-react'

import { apiClient } from '../../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Dialog } from '../ui/Dialog'
import LoadingSpinner from '../ui/LoadingSpinner'
import type { User } from '../../types/auth'

interface UserFormData {
  username: string
  password: string
  role: 'admin' | 'doctor'
  full_name?: string
  department?: string
  is_active: boolean
}

const UserManagement: React.FC = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  const queryClient = useQueryClient()

  // 获取用户列表
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', currentPage, pageSize, searchTerm, roleFilter, statusFilter],
    queryFn: () => apiClient.getAdminUsers({
      page: currentPage,
      size: pageSize,
      search: searchTerm || undefined,
      role: roleFilter || undefined,
      is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined
    }),
  })

  // 创建用户
  const createUserMutation = useMutation({
    mutationFn: (userData: UserFormData) => apiClient.createUser(userData),
    onSuccess: () => {
      toast.success('用户创建成功')
      setShowCreateDialog(false)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error: any) => {
      toast.error(error.message || '创建用户失败')
    }
  })

  // 更新用户
  const updateUserMutation = useMutation({
    mutationFn: ({ id, userData }: { id: number; userData: Partial<UserFormData> }) =>
      apiClient.updateUser(id, userData),
    onSuccess: () => {
      toast.success('用户更新成功')
      setShowEditDialog(false)
      setSelectedUser(null)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error: any) => {
      toast.error(error.message || '更新用户失败')
    }
  })

  // 切换用户状态
  const toggleUserStatusMutation = useMutation({
    mutationFn: (userId: number) => apiClient.toggleUserStatus(userId),
    onSuccess: () => {
      toast.success('用户状态已更新')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error: any) => {
      toast.error(error.message || '更新用户状态失败')
    }
  })

  // 重置密码
  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      apiClient.resetUserPassword(userId, { password }),
    onSuccess: () => {
      toast.success('密码重置成功')
      setShowResetPasswordDialog(false)
      setSelectedUser(null)
    },
    onError: (error: any) => {
      toast.error(error.message || '重置密码失败')
    }
  })

  const handleCreateUser = (formData: UserFormData) => {
    createUserMutation.mutate(formData)
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setShowEditDialog(true)
  }

  const handleToggleStatus = (userId: number) => {
    toggleUserStatusMutation.mutate(userId)
  }

  const handleResetPassword = (userId: number, password: string) => {
    resetPasswordMutation.mutate({ userId, password })
  }

  const handleSearch = () => {
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setRoleFilter('')
    setStatusFilter('')
    setCurrentPage(1)
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">用户管理</h2>
          <p className="text-muted-foreground">
            管理系统用户账户和权限设置
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建用户
        </Button>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-64">
              <label className="block text-sm font-medium mb-2">搜索用户</label>
              <div className="flex gap-2">
                <Input
                  placeholder="输入用户名搜索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch}>搜索</Button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">角色</label>
              <Select
                value={roleFilter}
                onValueChange={setRoleFilter}
              >
                <option value="">全部角色</option>
                <option value="admin">管理员</option>
                <option value="doctor">医生</option>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">状态</label>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <option value="">全部状态</option>
                <option value="active">已启用</option>
                <option value="inactive">已禁用</option>
              </Select>
            </div>
            
            <Button variant="outline" onClick={handleClearFilters}>
              清除过滤
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>
            共 {usersData?.total || 0} 个用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">用户名</th>
                  <th className="text-left py-3 px-4">角色</th>
                  <th className="text-left py-3 px-4">姓名</th>
                  <th className="text-left py-3 px-4">科室</th>
                  <th className="text-left py-3 px-4">状态</th>
                  <th className="text-left py-3 px-4">创建时间</th>
                  <th className="text-left py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {usersData?.items?.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{user.username}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.role === 'admin' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role === 'admin' ? '管理员' : '医生'}
                      </span>
                    </td>
                    <td className="py-3 px-4">{user.full_name || '-'}</td>
                    <td className="py-3 px-4">{user.department || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.is_active ? '已启用' : '已禁用'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(user.id)}
                        >
                          {user.is_active ? (
                            <Lock className="h-4 w-4 text-red-600" />
                          ) : (
                            <Unlock className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setShowResetPasswordDialog(true)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {usersData && usersData.pages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                上一页
              </Button>
              <span className="text-sm">
                第 {currentPage} 页，共 {usersData.pages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === usersData.pages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建用户对话框 */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="创建新用户"
      >
        <UserForm
          onSubmit={handleCreateUser}
          onCancel={() => setShowCreateDialog(false)}
          isLoading={createUserMutation.isPending}
        />
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        title="编辑用户"
      >
        {selectedUser && (
          <UserForm
            user={selectedUser}
            onSubmit={(formData) => handleEditUser({ id: selectedUser.id, userData: formData })}
            onCancel={() => setShowEditDialog(false)}
            isLoading={updateUserMutation.isPending}
            isEdit
          />
        )}
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog
        open={showResetPasswordDialog}
        onOpenChange={setShowResetPasswordDialog}
        title="重置用户密码"
      >
        <ResetPasswordForm
          onSubmit={(password) => handleResetPassword(selectedUser!.id, password)}
          onCancel={() => setShowResetPasswordDialog(false)}
          isLoading={resetPasswordMutation.isPending}
        />
      </Dialog>
    </div>
  )
}

// 用户表单组件
interface UserFormProps {
  user?: User
  onSubmit: (data: UserFormData) => void
  onCancel: () => void
  isLoading: boolean
  isEdit?: boolean
}

const UserForm: React.FC<UserFormProps> = ({ user, onSubmit, onCancel, isLoading, isEdit = false }) => {
  const [formData, setFormData] = useState<UserFormData>({
    username: user?.username || '',
    password: '',
    role: user?.role || 'doctor',
    full_name: user?.full_name || '',
    department: user?.department || '',
    is_active: user?.is_active ?? true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEdit && !formData.password) {
      toast.error('请输入密码')
      return
    }
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">用户名 *</label>
          <Input
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
            disabled={isEdit}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">角色 *</label>
          <Select
            value={formData.role}
            onValueChange={(value: 'admin' | 'doctor') => setFormData({ ...formData, role: value })}
          >
            <option value="doctor">医生</option>
            <option value="admin">管理员</option>
          </Select>
        </div>
      </div>
      
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium mb-2">密码 *</label>
          <Input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">姓名</label>
          <Input
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">科室</label>
          <Input
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          />
        </div>
      </div>
      
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm font-medium">启用账户</span>
        </label>
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <LoadingSpinner size="sm" /> : (isEdit ? '更新' : '创建')}
        </Button>
      </div>
    </form>
  )
}

// 重置密码表单组件
interface ResetPasswordFormProps {
  onSubmit: (password: string) => void
  onCancel: () => void
  isLoading: boolean
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ onSubmit, onCancel, isLoading }) => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }
    if (password.length < 6) {
      toast.error('密码长度至少6位')
      return
    }
    onSubmit(password)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">新密码 *</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">确认密码 *</label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <LoadingSpinner size="sm" /> : '重置密码'}
        </Button>
      </div>
    </form>
  )
}

export default UserManagement
