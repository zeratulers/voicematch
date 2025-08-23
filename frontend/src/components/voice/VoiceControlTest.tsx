/**
 * 语音控制测试组件
 * 用于测试和展示语音控制功能
 */

import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import ModernVoiceControl from './ModernVoiceControl'
import { AudioClassifier } from './AudioClassifier'

// 模拟测试数据
const mockCommands = [
  {
    command_id: 'cmd_001',
    content: '请深呼吸',
    description: '帮助患者放松的呼吸指导',
    audio_url: '/mock/audio1.mp3',
    duration_ms: 3000,
    dialect_label: '普通话',
    speaker_name: '张医生',
    variant_id: 1
  },
  {
    command_id: 'cmd_002',
    content: '放松肩膀',
    description: '缓解肩部紧张',
    audio_url: '/mock/audio2.mp3',
    duration_ms: 2500,
    dialect_label: '普通话',
    speaker_name: '李医生',
    variant_id: 2
  },
  {
    command_id: 'cmd_003',
    content: '保持冷静',
    description: '安抚患者情绪',
    audio_url: '/mock/audio3.mp3',
    duration_ms: 2000,
    dialect_label: '普通话',
    speaker_name: '王医生',
    variant_id: 3
  },
  {
    command_id: 'cmd_004',
    content: '注意呼吸节奏',
    description: '指导患者调整呼吸',
    audio_url: '/mock/audio4.mp3',
    duration_ms: 4000,
    dialect_label: '普通话',
    speaker_name: '张医生',
    variant_id: 4
  },
  {
    command_id: 'cmd_005',
    content: '不要紧张',
    description: '消除患者紧张情绪',
    audio_url: '/mock/audio5.mp3',
    duration_ms: 1800,
    dialect_label: '普通话',
    speaker_name: '李医生',
    variant_id: 5
  }
]

const VoiceControlTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([])
  const [isTestingClassifier, setIsTestingClassifier] = useState(false)

  // 添加测试结果
  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`])
  }

  // 测试音频分类器
  const testClassifier = async () => {
    setIsTestingClassifier(true)
    addTestResult('开始测试音频分类器...')

    const classifier = new AudioClassifier(mockCommands)
    
    // 测试用例
    const testCases = [
      '深呼吸',
      '放松',
      '呼吸',
      '紧张',
      '冷静',
      '肩膀放松',
      '不要害怕',
      '调整呼吸',
      '保持镇定'
    ]

    for (const testCase of testCases) {
      try {
        const results = await classifier.classifyTranscript(testCase)
        addTestResult(`输入: "${testCase}" -> 匹配到 ${results.length} 个结果`)
        
        if (results.length > 0) {
          const best = results[0]
          addTestResult(`  最佳匹配: "${best.content}" (置信度: ${Math.round(best.confidence * 100)}%, 类型: ${best.matchType})`)
        }
      } catch (error) {
        addTestResult(`错误: ${testCase} - ${error}`)
      }
    }

    // 显示统计信息
    const stats = classifier.getStats()
    addTestResult(`分类器统计: 总指令${stats.totalCommands}个, 拼音索引${stats.pinyinIndexSize}个, 平均长度${stats.averageCommandLength}字符`)
    
    setIsTestingClassifier(false)
    addTestResult('分类器测试完成！')
  }

  // 模拟播放命令
  const handlePlayCommand = (commandId: string, content: string) => {
    addTestResult(`🎵 播放指令: ${content} (ID: ${commandId})`)
    // 这里可以添加实际的音频播放逻辑
  }

  // 清空测试结果
  const clearResults = () => {
    setTestResults([])
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>语音控制系统测试</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-4">
              <Button 
                onClick={testClassifier}
                disabled={isTestingClassifier}
              >
                {isTestingClassifier ? '测试中...' : '测试分类器'}
              </Button>
              <Button 
                onClick={clearResults}
                variant="outline"
              >
                清空结果
              </Button>
            </div>

            {/* 测试结果显示 */}
            {testResults.length > 0 && (
              <div className="bg-gray-50 border rounded-lg p-4 max-h-96 overflow-y-auto">
                <h4 className="font-medium mb-2">测试结果:</h4>
                <div className="space-y-1 text-sm font-mono">
                  {testResults.map((result, index) => (
                    <div key={index} className="text-gray-700">
                      {result}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 语音控制组件测试 */}
      <ModernVoiceControl
        commands={mockCommands}
        onPlayCommand={handlePlayCommand}
        onStateChange={(state) => {
          addTestResult(`🔄 状态变更: ${state}`)
        }}
        onTranscriptChange={(transcript) => {
          addTestResult(`📝 转录: ${transcript}`)
        }}
        onCommandPlayed={(content) => {
          addTestResult(`✅ 指令播放完成: ${content}`)
        }}
        wakeWords={['发出指令', '播放指令', '开始指令', '测试']}
        enabled={true}
        className="w-full"
      />

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>测试说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>分类器测试：</strong>点击"测试分类器"按钮测试各种输入文本的匹配效果</p>
            <p><strong>语音控制测试：</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>点击"开始录音"启动语音识别</li>
              <li>说出唤醒词："发出指令"、"播放指令"、"开始指令"或"测试"</li>
              <li>听到提示音后说出指令内容，如："深呼吸"、"放松肩膀"、"保持冷静"</li>
              <li>系统会自动识别并匹配相应的指令</li>
              <li>查看右侧测试结果了解系统运行状态</li>
            </ul>
            <p><strong>支持的测试指令：</strong>深呼吸、放松肩膀、保持冷静、注意呼吸节奏、不要紧张</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default VoiceControlTest
