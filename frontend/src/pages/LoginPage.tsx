import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Toaster, toast } from 'sonner'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/Dialog'

export default function LoginPage() {
  const { login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
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
      const status = error?.response?.status
      const detail = error?.response?.data?.detail
      if (status === 401) {
        if (detail === '用户名或密码错误') {
          toast.error('用户名或密码错误')
        } else if (detail === '用户未激活') {
          toast.error('该账户已被禁用，请联系管理员')
        } else {
          toast.error(detail || '认证失败')
        }
      } else {
        toast.error(detail || error.message || '登录失败')
      }
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
          <h2 className="mt-6 text-3xl font-bold text-gray-900">HealBridge</h2>
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

            <p className="text-xs text-gray-500 text-center">
              登录即代表同意{' '}
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="text-blue-600 hover:underline"
              >
                使用条款
              </button>
            </p>
          </div>
        </form>

        {/* 系统说明 */}
        <div className="text-center text-sm text-gray-500">
          <p>本系统用于术中语音指令播放</p>
          <p>支持多方言音频变体和离线语音识别</p>
        </div>
      </div>
      <Toaster />

      {/* 使用条款弹窗 */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>使用条款与免责任声明</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm text-gray-700">
            <p>欢迎使用 HealBridge 术中语音指令播放系统（以下简称“本系统”）。在使用本系统之前，请您仔细阅读以下使用条款与免责任声明。一旦登录并使用本系统，即表示您同意以下条款。</p>

            <div>
              <p className="font-medium">1. 语音控制功能的局限性</p>
              <p>本系统包含语音控制功能，旨在帮助医生与患者在术中进行有效的交流。然而，语音识别技术仍然存在一定的误差率，因此，在使用过程中可能会发生错误。请注意，本系统的语音控制功能仍需人工监督，并且在使用过程中产生的任何错误或后果，本系统及其开发者不承担任何责任。</p>
            </div>

            <div>
              <p className="font-medium">2. 数据收集与隐私保护</p>
              <p>本系统仅收集与操作相关的必要数据，不收集任何与用户隐私无关的个人信息。所收集的数据将用于系统的正常运行和优化，不会用于任何未经授权的目的。所有收集的数据将严格按照法律法规进行保护，用户的隐私将得到充分尊重和保护。</p>
            </div>

            <div>
              <p className="font-medium">3. 测试阶段免责声明</p>
              <p>当前，本系统仍处于测试阶段，虽然我们会尽力保证其稳定性和功能性，但在此阶段仍可能出现一些未发现的问题和漏洞。我们强烈建议您在实际使用前，先在受控环境中进行充分测试。如您在使用过程中发现问题或有任何需求，请通过以下邮箱与我们联系：联系邮箱：support@healbridge.com</p>
            </div>

            <div>
              <p className="font-medium">4. 责任范围</p>
              <p>尽管我们努力确保本系统的准确性与稳定性，但由于技术和外部因素的影响，本系统的服务和功能不保证完全无误。任何因使用本系统所产生的直接或间接损失，本公司及其开发者均不承担任何法律责任。</p>
            </div>

            <div>
              <p className="font-medium">5. 知识产权</p>
              <p>本系统的所有内容，包括但不限于软件、图形、界面、文档及其相关数据，均为 HealBridge 或其授权方所有。未经授权，用户不得擅自复制、传播或修改本系统的任何部分。</p>
            </div>

            <div>
              <p className="font-medium">6. 系统更新与修改</p>
              <p>本系统可能会不定期地进行更新和功能改进。我们有权在不提前通知的情况下修改本系统的任何部分，但会尽量提前通知用户。若有重大变动，将通过系统更新说明进行公告。</p>
            </div>

            <div>
              <p className="font-medium">7. 适用法律</p>
              <p>本使用条款适用中华人民共和国的法律。如果发生任何争议，双方应首先友好协商解决；如果协商未果，则可向本系统所在地法院提起诉讼。</p>
            </div>

            <div>
              <p className="font-medium">8. 同意条款</p>
              <p>通过点击登录按钮并进入系统界面，即表示您已经阅读并同意接受本使用条款及免责任声明。</p>
            </div>

            <div>
              <p className="font-medium">免责条款</p>
              <p>本系统仅供合法用途使用，用户不得利用本系统从事任何违法行为。</p>
              <p>用户应对使用本系统时的操作和结果负责。</p>
              <p>本系统在其提供的功能中，不能保证所有信息和操作都能绝对准确无误。用户在使用本系统时，需谨慎操作，并自行承担任何后果。</p>
              <p>免责声明声明：本系统所提供的服务和信息仅供参考，任何因使用本系统而引起的损失，本公司不承担责任。希望用户在使用过程中，能充分理解并遵循相关条款与条件。</p>
              <p>注意：上述条款可根据需要进行修改或补充，请定期查看以确保您了解最新版本的使用条款。</p>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
              onClick={() => setShowTerms(false)}
            >
              我已阅读并同意
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}









