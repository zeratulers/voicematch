# 实时音频波形组件使用指南

## 概述

我们创建了一套完整的实时音频波形可视化和唤醒词检测系统，包含三个主要组件：

1. **AudioWaveform** - 基础音频波形可视化组件
2. **WhisperDetector** - 基于 Whisper 的唤醒词检测器 
3. **SmartAudioWaveform** - 集成组件，结合了波形显示和 Whisper 检测

## 功能特性

### 🌊 实时音频波形
- 实时显示麦克风音频的频谱图和时域波形
- 支持音量级别可视化
- 根据唤醒词检测状态改变波形颜色
- 美观的动画效果和渐变色彩

### 🤖 Whisper 唤醒词检测
- 使用 Transformers.js 的 Whisper 模型进行语音识别
- 支持中文唤醒词检测
- 可配置的相似度阈值和置信度
- 音频缓冲管理，避免重复处理
- 完全在前端运行，无需服务器

### 🎯 智能集成
- 自动管理 Whisper 模型的加载和初始化
- 状态可视化（空闲/检测中/已检测）
- 错误处理和重试机制
- 可配置的唤醒词列表

## 使用方法

### 基本用法

```jsx
import SmartAudioWaveform from '../components/ui/SmartAudioWaveform'

function MyComponent() {
  const [isRecording, setIsRecording] = useState(false)
  
  const handleWakeWordDetected = (result) => {
    console.log('检测到唤醒词:', result.matchedWakeWord)
    // 处理检测结果...
  }
  
  return (
    <SmartAudioWaveform
      isRecording={isRecording}
      onStartRecording={() => setIsRecording(true)}
      onStopRecording={() => setIsRecording(false)}
      onWakeWordDetected={handleWakeWordDetected}
      wakeWords={['发出指令', '播放指令', '开始指令']}
      autoInitialize={true}
    />
  )
}
```

### 高级配置

```jsx
// 单独使用 WhisperDetector
import { createWhisperDetector } from '../ml/whisper-detector'

const detector = createWhisperDetector({
  wakeWords: ['发出指令', '播放指令', '开始指令'],
  confidenceThreshold: 0.7,
  similarityThreshold: 0.8,
  modelName: 'Xenova/whisper-tiny',
  sampleRate: 16000,
  bufferDuration: 3
})

await detector.initialize()

// 实时添加音频数据
detector.addAudioData(audioFloatArray)

// 手动处理音频
const result = await detector.processAudio(audioFloatArray)
```

## 组件属性

### SmartAudioWaveform

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `isRecording` | boolean | - | 录音状态 |
| `onStartRecording` | function | - | 开始录音回调 |
| `onStopRecording` | function | - | 停止录音回调 |
| `onWakeWordDetected` | function | - | 唤醒词检测回调 |
| `wakeWords` | string[] | `['发出指令', '播放指令', '开始指令']` | 唤醒词列表 |
| `autoInitialize` | boolean | `true` | 是否自动初始化 Whisper |
| `className` | string | `''` | 自定义样式类 |

### AudioWaveform

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `isRecording` | boolean | - | 录音状态 |
| `onStartRecording` | function | - | 开始录音回调 |
| `onStopRecording` | function | - | 停止录音回调 |
| `onAudioData` | function | - | 音频数据回调 |
| `onWakeWordDetected` | function | - | 唤醒词检测回调 |
| `wakeWords` | string[] | `['发出指令', '播放指令', '开始指令']` | 唤醒词列表 |
| `showWakeWordStatus` | boolean | `true` | 显示唤醒词状态 |
| `className` | string | `''` | 自定义样式类 |

## 状态说明

### 唤醒词检测状态
- **idle**: 待机状态，没有检测活动
- **detecting**: 正在分析音频数据
- **detected**: 成功检测到唤醒词

### Whisper 检测器状态
- **idle**: 未初始化
- **initializing**: 正在加载模型
- **ready**: 已就绪，可以检测
- **error**: 发生错误

## 注意事项

1. **首次加载**: Whisper 模型约 20MB，首次下载需要时间
2. **浏览器兼容性**: 需要支持 WebAudio API 和 getUserMedia
3. **内存使用**: 音频缓冲区会占用一定内存
4. **性能考虑**: 建议在需要时才启用 Whisper 检测

## 示例场景

### 在 ORConsolePage 中的集成

```jsx
// 在语音识别卡片中添加波形显示
{showSmartWaveform && (
  <SmartAudioWaveform
    isRecording={isListening}
    onStartRecording={startListening}
    onStopRecording={stopListening}
    onWakeWordDetected={handleWhisperDetection}
    wakeWords={['发出指令', '播放指令', '开始指令']}
    autoInitialize={whisperDetectionEnabled}
    className="mb-4"
  />
)}
```

这样用户就可以：
1. 看到实时的音频波形变化
2. 通过颜色变化了解检测状态
3. 享受更精确的唤醒词检测体验
4. 获得更好的音频反馈

## 技术架构

```
SmartAudioWaveform (集成组件)
├── AudioWaveform (波形显示)
│   ├── Web Audio API
│   ├── Canvas 渲染
│   └── 实时音频分析
└── WhisperDetector (语音识别)
    ├── Transformers.js
    ├── Whisper 模型
    └── 字符串相似度匹配
```

这套组件提供了完整的音频可视化和语音检测解决方案，完全在前端运行，无需依赖外部服务。
