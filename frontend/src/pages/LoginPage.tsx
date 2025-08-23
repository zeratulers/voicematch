import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function LoginPage() {
  const { login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await login(formData)
      toast.success('登录成功！')
    } catch (error: any) {
      toast.error(error.message || '登录失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // 演示账户快速登录
  const quickLogin = (username: string, password: string) => {
    setFormData({ username, password })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo和标题 */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">VoiceMatch</h2>
          <p className="mt-2 text-sm text-gray-600">术中语音指令播放系统</p>
        </div>

        {/* 登录表单 */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入用户名"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入密码"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : '登录'}
            </button>
          </div>
        </form>

        {/* 演示账户 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">演示账户</h3>
          <div className="space-y-2">
            <button
              onClick={() => quickLogin('admin', 'admin123')}
              className="w-full text-left px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">管理员</div>
              <div className="text-sm text-gray-500">用户名: admin, 密码: admin123</div>
            </button>
            <button
              onClick={() => quickLogin('doctor', 'doctor123')}
              className="w-full text-left px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">医生</div>
              <div className="text-sm text-gray-500">用户名: doctor, 密码: doctor123</div>
            </button>
          </div>
        </div>

        {/* 系统说明 */}
        <div className="text-center text-sm text-gray-500">
          <p>本系统用于术中语音指令播放</p>
          <p>支持多方言音频变体和离线语音识别</p>
        </div>
      </div>
    </div>
  )
}







