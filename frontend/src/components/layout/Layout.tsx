/**
 * 主布局组件
 * 
 * 包含侧边栏导航和主内容区域
 */

import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Command, 
  AudioLines, 
  Settings, 
  LogOut,
  Stethoscope
} from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { toast } from 'sonner'
import { apiClient } from '../../api/client'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth()
  const [pwOpen, setPwOpen] = React.useState(false)
  const [oldPassword, setOldPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  const navigation = [
    {
      name: '仪表板',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: location.pathname === '/dashboard',
    },
    {
      name: '患者管理',
      href: '/patients',
      icon: Users,
      current: location.pathname.startsWith('/patients'),
    },
    {
      name: '指令库',
      href: '/commands',
      icon: Command,
      current: location.pathname.startsWith('/commands'),
    },
    {
      name: '术中控制台',
      href: '/console',
      icon: AudioLines,
      current: location.pathname === '/console',
    },
  ]

  // 管理员才能看到的导航项
  if (user?.role === 'admin') {
    navigation.push({
      name: '系统管理',
      href: '/admin',
      icon: Settings,
      current: location.pathname === '/admin',
    })
  }

  const handleLogout = () => {
    logout()
  }

  const handleOpenChangePassword = () => {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPwOpen(true)
  }

  const handleSavePassword = async () => {
    if (!oldPassword || !newPassword) {
      toast.error('请输入完整信息')
      return
    }
    if (newPassword.length < 6) {
      toast.error('新密码至少6位')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致')
      return
    }
    try {
      setIsSaving(true)
      await apiClient.changePassword(oldPassword, newPassword)
      toast.success('密码修改成功')
      setPwOpen(false)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (detail === '旧密码不正确') {
        toast.error('旧密码不正确')
      } else {
        toast.error(detail || '修改失败')
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
    <div className="min-h-screen bg-background">
      {/* 侧边栏 */}
      {/* 桌面端固定侧边栏，移动端作为抽屉 */}
      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 " +
          (sidebarOpen ? "translate-x-0" : "-translate-x-full") +
          " md:translate-x-0"
        }
        aria-hidden={!sidebarOpen}
      >
        {/* Logo区域 */}
        <div className="flex h-16 items-center px-6 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">HealBridge</span>
          </div>
        </div>

        {/* 用户信息 */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium">{user?.username}</p>
              <p className="text-xs text-muted-foreground">
                {user?.role === 'admin' ? '系统管理员' : '医生'}
              </p>
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={handleOpenChangePassword}>修改密码</Button>
              </div>
            </div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                  ${item.current 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }
                `}
              >
                <Icon className="h-4 w-4 mr-3" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* 底部退出按钮 */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-3" />
            退出登录
          </Button>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="md:ml-64 ml-0">
        {/* 顶部栏 */}
        <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center px-6">
            {/* 移动端侧边栏开关 */}
            <button
              className="md:hidden mr-4 inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm"
              aria-label="打开菜单"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="ml-auto flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long'
                })}
              </span>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
    <Dialog open={pwOpen} onOpenChange={setPwOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm">旧密码</label>
            <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">新密码</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">确认新密码</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPwOpen(false)} disabled={isSaving}>取消</Button>
          <Button onClick={handleSavePassword} disabled={isSaving}>{isSaving ? '保存中...' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

export default Layout
