import React, { createContext, useContext, useState, useEffect } from 'react'
import { apiClient } from '../api/client'
import { User, LoginRequest, LoginResponse } from '../types/auth'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 初始化时检查本地存储的token
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      // 验证token并获取用户信息
      checkAuth()
    } else {
      setIsLoading(false)
    }
  }, [])

  const checkAuth = async () => {
    try {
      const userData = await apiClient.getCurrentUser()
      setUser(userData)
    } catch (error) {
      // Token无效，清除本地存储
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await apiClient.login(credentials)
      const { user: userData } = response

      // 设置用户信息
      setUser(userData)
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || '登录失败')
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  const refreshToken = async () => {
    try {
      await apiClient.refreshAccessToken()
    } catch (error) {
      // 刷新失败，重新登录
      logout()
      throw error
    }
  }

  const value = {
    user,
    isLoading,
    login,
    logout,
    refreshToken
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


