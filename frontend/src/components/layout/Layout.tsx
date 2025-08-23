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

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth()
  const location = useLocation()

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

  return (
    <div className="min-h-screen bg-background">
      {/* 侧边栏 */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r">
        {/* Logo区域 */}
        <div className="flex h-16 items-center px-6 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">VoiceMatch</span>
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
      <div className="ml-64">
        {/* 顶部栏 */}
        <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center px-6">
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
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
