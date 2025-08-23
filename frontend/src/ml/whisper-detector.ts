/**
 * 基于 Whisper 的唤醒词检测器
 * 
 * 功能：
 * 1. 使用 Transformers.js 的 Whisper 模型进行语音识别
 * 2. 实时检测音频中的唤醒词
 * 3. 支持自定义唤醒词列表
 * 4. 提供置信度评分和文本相似度匹配
 */

import { pipeline } from '@xenova/transformers'
import stringSimilarity from 'string-similarity'

export interface WhisperDetectorConfig {
  wakeWords: string[]
  confidenceThreshold?: number
  similarityThreshold?: number
  modelName?: string
  sampleRate?: number
  bufferDuration?: number // 音频缓冲时长（秒）
}

export interface DetectionResult {
  detected: boolean
  transcript: string
  matchedWakeWord: string
  confidence: number
  similarity: number
  timestamp: number
}

export interface AudioSegment {
  data: Float32Array
  timestamp: number
}

export class WhisperDetector {
  private pipeline: any = null
  private config: Required<WhisperDetectorConfig>
  private isInitialized = false
  private isInitializing = false
  private audioBuffer: AudioSegment[] = []
  private lastProcessTime = 0
  private readonly PROCESS_INTERVAL = 2000 // 每2秒处理一次

  constructor(config: WhisperDetectorConfig) {
    this.config = {
      wakeWords: config.wakeWords,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      similarityThreshold: config.similarityThreshold ?? 0.8,
      modelName: config.modelName ?? 'Xenova/whisper-tiny.en',
      sampleRate: config.sampleRate ?? 16000,
      bufferDuration: config.bufferDuration ?? 3
    }

    console.log('🎤 Whisper 检测器配置:', this.config)
  }

  /**
   * 初始化 Whisper 模型
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ Whisper 检测器已初始化')
      return
    }

    if (this.isInitializing) {
      console.log('⏳ Whisper 检测器正在初始化中...')
      return
    }

    try {
      this.isInitializing = true
      console.log('🤖 开始加载 Whisper 模型:', this.config.modelName)

      // 加载语音识别管道
      this.pipeline = await pipeline(
        'automatic-speech-recognition',
        this.config.modelName,
        {
          // 针对实时检测的优化配置
          chunk_length_s: 30,
          stride_length_s: 5,
          return_timestamps: true
        }
      )

      this.isInitialized = true
      console.log('✅ Whisper 模型加载完成')

    } catch (error) {
      console.error('❌ Whisper 模型加载失败:', error)
      this.isInitialized = false
      throw error
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * 添加音频数据到缓冲区
   */
  addAudioData(audioData: Float32Array): void {
    if (!audioData || audioData.length === 0) return

    const timestamp = Date.now()
    
    // 添加新的音频段
    this.audioBuffer.push({
      data: new Float32Array(audioData),
      timestamp
    })

    // 保持缓冲区在指定时长内
    const maxAge = this.config.bufferDuration * 1000
    this.audioBuffer = this.audioBuffer.filter(
      segment => timestamp - segment.timestamp <= maxAge
    )

    // 检查是否需要处理音频
    if (timestamp - this.lastProcessTime >= this.PROCESS_INTERVAL) {
      this.processAudioBuffer()
    }
  }

  /**
   * 处理音频缓冲区
   */
  private async processAudioBuffer(): Promise<DetectionResult | null> {
    if (!this.isInitialized || this.audioBuffer.length === 0) {
      return null
    }

    try {
      this.lastProcessTime = Date.now()

      // 合并音频数据
      const combinedAudio = this.combineAudioSegments()
      if (combinedAudio.length === 0) {
        return null
      }

      console.log('🔍 处理音频段，长度:', combinedAudio.length)

      // 使用 Whisper 进行语音识别
      const result = await this.pipeline(combinedAudio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        task: 'transcribe',
        language: 'chinese', // 支持中文
        temperature: 0.0,
        no_repeat_ngram_size: 3
      })

      console.log('🎯 Whisper 识别结果:', result)

      const transcript = result.text?.trim() || ''
      if (!transcript) {
        return null
      }

      // 检测唤醒词
      return this.detectWakeWords(transcript)

    } catch (error) {
      console.error('❌ 音频处理失败:', error)
      return null
    }
  }

  /**
   * 合并音频段
   */
  private combineAudioSegments(): Float32Array {
    if (this.audioBuffer.length === 0) {
      return new Float32Array(0)
    }

    // 计算总长度
    const totalLength = this.audioBuffer.reduce(
      (sum, segment) => sum + segment.data.length, 
      0
    )

    // 合并所有音频段
    const combined = new Float32Array(totalLength)
    let offset = 0

    for (const segment of this.audioBuffer) {
      combined.set(segment.data, offset)
      offset += segment.data.length
    }

    return combined
  }

  /**
   * 检测唤醒词
   */
  private detectWakeWords(transcript: string): DetectionResult | null {
    const timestamp = Date.now()
    
    console.log('🔍 检查唤醒词:', transcript)

    // 清理转录文本
    const cleanTranscript = this.cleanText(transcript)
    
    let bestMatch: {
      wakeWord: string
      similarity: number
    } | null = null

    // 检查每个唤醒词
    for (const wakeWord of this.config.wakeWords) {
      const cleanWakeWord = this.cleanText(wakeWord)
      
      // 直接包含匹配
      if (cleanTranscript.includes(cleanWakeWord) || 
          cleanWakeWord.includes(cleanTranscript)) {
        bestMatch = { wakeWord, similarity: 1.0 }
        break
      }

      // 字符串相似度匹配
      const similarity = stringSimilarity.compareTwoStrings(
        cleanTranscript, 
        cleanWakeWord
      )

      if (similarity >= this.config.similarityThreshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { wakeWord, similarity }
        }
      }
    }

    if (bestMatch) {
      console.log('✅ 检测到唤醒词:', bestMatch.wakeWord, '相似度:', bestMatch.similarity)
      
      return {
        detected: true,
        transcript: cleanTranscript,
        matchedWakeWord: bestMatch.wakeWord,
        confidence: this.config.confidenceThreshold, // Whisper 不直接提供置信度
        similarity: bestMatch.similarity,
        timestamp
      }
    }

    console.log('❌ 未检测到唤醒词')
    return null
  }

  /**
   * 清理文本
   */
  private cleanText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[，。、！？：；,.!?;:]/g, '')
      .trim()
  }

  /**
   * 手动处理音频并返回结果
   */
  async processAudio(audioData: Float32Array): Promise<DetectionResult | null> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      console.log('🔍 手动处理音频，长度:', audioData.length)

      const result = await this.pipeline(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        task: 'transcribe',
        language: 'chinese',
        temperature: 0.0
      })

      const transcript = result.text?.trim() || ''
      console.log('🎯 识别结果:', transcript)

      if (!transcript) {
        return null
      }

      return this.detectWakeWords(transcript)

    } catch (error) {
      console.error('❌ 手动处理音频失败:', error)
      return null
    }
  }

  /**
   * 获取状态信息
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      initializing: this.isInitializing,
      bufferSize: this.audioBuffer.length,
      wakeWordsCount: this.config.wakeWords.length,
      config: this.config
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.audioBuffer = []
    this.pipeline = null
    this.isInitialized = false
    this.isInitializing = false
    console.log('🧹 Whisper 检测器已清理')
  }

  /**
   * 更新唤醒词列表
   */
  updateWakeWords(wakeWords: string[]): void {
    this.config.wakeWords = wakeWords
    console.log('🔄 已更新唤醒词列表:', wakeWords)
  }

  /**
   * 更新阈值
   */
  updateThresholds(confidence?: number, similarity?: number): void {
    if (confidence !== undefined) {
      this.config.confidenceThreshold = confidence
    }
    if (similarity !== undefined) {
      this.config.similarityThreshold = similarity
    }
    console.log('🔄 已更新阈值:', {
      confidence: this.config.confidenceThreshold,
      similarity: this.config.similarityThreshold
    })
  }
}

/**
 * 创建 Whisper 检测器实例
 */
export function createWhisperDetector(config: WhisperDetectorConfig): WhisperDetector {
  return new WhisperDetector(config)
}

/**
 * 默认配置
 */
export const DEFAULT_WHISPER_CONFIG: WhisperDetectorConfig = {
  wakeWords: ['发出指令', '播放指令', '开始指令'],
  confidenceThreshold: 0.7,
  similarityThreshold: 0.8,
  modelName: 'Xenova/whisper-tiny.en',
  sampleRate: 16000,
  bufferDuration: 3
}
