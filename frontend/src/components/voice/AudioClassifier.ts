/**
 * 音频智能分类器
 * 
 * 使用多种技术进行音频分类：
 * 1. 基于转录文本的语义匹配
 * 2. 字符串相似度算法
 * 3. 中文拼音匹配
 * 4. 机器学习模型分类（可扩展）
 */

import stringSimilarity from 'string-similarity'
import { pinyin } from 'pinyin-pro'
import Fuse from 'fuse.js'

// 分类结果接口
export interface ClassificationResult {
  command_id: string
  content: string
  confidence: number
  similarity: number
  matchType: 'exact' | 'semantic' | 'pinyin' | 'fuzzy'
  matchedText?: string
}

// 指令接口
export interface Command {
  command_id: string
  content: string
  description?: string
  audio_url: string
  duration_ms?: number
  dialect_label: string
  speaker_name: string
  variant_id: number
}

// 分类器配置
interface ClassifierConfig {
  minConfidence: number
  maxResults: number
  enablePinyinMatch: boolean
  enableSemanticMatch: boolean
  enableFuzzyMatch: boolean
}

// 默认配置
const DEFAULT_CONFIG: ClassifierConfig = {
  minConfidence: 0.3,
  maxResults: 5,
  enablePinyinMatch: true,
  enableSemanticMatch: true,
  enableFuzzyMatch: true
}

export class AudioClassifier {
  private commands: Command[]
  private config: ClassifierConfig
  private fuseInstance: Fuse<Command>
  private pinyinIndex: Map<string, Command[]>

  constructor(commands: Command[], config: Partial<ClassifierConfig> = {}) {
    this.commands = commands
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    // 初始化 Fuse.js 模糊搜索
    this.fuseInstance = new Fuse(commands, {
      keys: [
        { name: 'content', weight: 0.7 },
        { name: 'description', weight: 0.3 }
      ],
      threshold: 0.6,
      includeScore: true,
      shouldSort: true
    })

    // 构建拼音索引
    this.pinyinIndex = this.buildPinyinIndex()
  }

  /**
   * 分类音频转录文本
   */
  async classifyTranscript(transcript: string): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = []

    if (!transcript || transcript.trim().length === 0) {
      return results
    }

    const cleanTranscript = this.cleanText(transcript)
    console.log('🔍 分析转录文本:', cleanTranscript)

    // 1. 精确匹配
    const exactMatches = this.findExactMatches(cleanTranscript)
    results.push(...exactMatches)

    // 2. 语义相似度匹配
    if (this.config.enableSemanticMatch) {
      const semanticMatches = this.findSemanticMatches(cleanTranscript)
      results.push(...semanticMatches)
    }

    // 3. 拼音匹配
    if (this.config.enablePinyinMatch) {
      const pinyinMatches = this.findPinyinMatches(cleanTranscript)
      results.push(...pinyinMatches)
    }

    // 4. 模糊匹配
    if (this.config.enableFuzzyMatch) {
      const fuzzyMatches = this.findFuzzyMatches(cleanTranscript)
      results.push(...fuzzyMatches)
    }

    // 去重并排序
    const uniqueResults = this.deduplicateResults(results)
    const sortedResults = uniqueResults
      .filter(r => r.confidence >= this.config.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxResults)

    console.log('📊 分类结果:', sortedResults)
    return sortedResults
  }

  /**
   * 分类音频文件（预留接口）
   */
  async classifyAudio(audioBlob: Blob): Promise<ClassificationResult[]> {
    // 这里可以集成机器学习模型进行音频分类
    // 目前先返回空结果，实际应用中可以：
    // 1. 将音频发送到服务器进行处理
    // 2. 使用 Web Audio API 进行特征提取
    // 3. 使用 TensorFlow.js 在前端运行模型
    
    console.log('🎵 音频分类功能预留，当前返回空结果')
    return []
  }

  /**
   * 清理文本
   */
  private cleanText(text: string): string {
    return text
      .replace(/[，。！？；：""''（）【】《》]/g, '') // 移除中文标点
      .replace(/[,!?;:"'()\[\]<>]/g, '')           // 移除英文标点
      .replace(/\s+/g, '')                         // 移除空格
      .toLowerCase()
  }

  /**
   * 精确匹配
   */
  private findExactMatches(transcript: string): ClassificationResult[] {
    const results: ClassificationResult[] = []

    for (const command of this.commands) {
      const cleanCommand = this.cleanText(command.content)
      
      if (cleanCommand.includes(transcript) || transcript.includes(cleanCommand)) {
        results.push({
          command_id: command.command_id,
          content: command.content,
          confidence: 1.0,
          similarity: 1.0,
          matchType: 'exact',
          matchedText: transcript
        })
      }
    }

    return results
  }

  /**
   * 语义相似度匹配
   */
  private findSemanticMatches(transcript: string): ClassificationResult[] {
    const results: ClassificationResult[] = []

    for (const command of this.commands) {
      const cleanCommand = this.cleanText(command.content)
      const similarity = stringSimilarity.compareTwoStrings(transcript, cleanCommand)
      
      if (similarity > 0.3) {
        // 根据相似度计算置信度
        const confidence = this.calculateConfidence(similarity, 'semantic')
        
        results.push({
          command_id: command.command_id,
          content: command.content,
          confidence,
          similarity,
          matchType: 'semantic',
          matchedText: transcript
        })
      }
    }

    return results
  }

  /**
   * 拼音匹配
   */
  private findPinyinMatches(transcript: string): ClassificationResult[] {
    const results: ClassificationResult[] = []
    const transcriptPinyin = this.textToPinyin(transcript)

    for (const [commandPinyin, commands] of this.pinyinIndex) {
      const similarity = stringSimilarity.compareTwoStrings(transcriptPinyin, commandPinyin)
      
      if (similarity > 0.4) {
        for (const command of commands) {
          const confidence = this.calculateConfidence(similarity, 'pinyin')
          
          results.push({
            command_id: command.command_id,
            content: command.content,
            confidence,
            similarity,
            matchType: 'pinyin',
            matchedText: transcript
          })
        }
      }
    }

    return results
  }

  /**
   * 模糊匹配
   */
  private findFuzzyMatches(transcript: string): ClassificationResult[] {
    const results: ClassificationResult[] = []
    const searchResults = this.fuseInstance.search(transcript)

    for (const result of searchResults) {
      if (result.score !== undefined && result.score < 0.7) {
        const similarity = 1 - result.score
        const confidence = this.calculateConfidence(similarity, 'fuzzy')
        
        results.push({
          command_id: result.item.command_id,
          content: result.item.content,
          confidence,
          similarity,
          matchType: 'fuzzy',
          matchedText: transcript
        })
      }
    }

    return results
  }

  /**
   * 构建拼音索引
   */
  private buildPinyinIndex(): Map<string, Command[]> {
    const index = new Map<string, Command[]>()

    for (const command of this.commands) {
      const commandPinyin = this.textToPinyin(command.content)
      
      if (!index.has(commandPinyin)) {
        index.set(commandPinyin, [])
      }
      index.get(commandPinyin)!.push(command)
    }

    return index
  }

  /**
   * 文本转拼音
   */
  private textToPinyin(text: string): string {
    return pinyin(text, { toneType: 'none', type: 'array' })
      .join('')
      .toLowerCase()
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(similarity: number, matchType: string): number {
    // 根据匹配类型调整置信度权重
    const typeWeights = {
      exact: 1.0,
      semantic: 0.9,
      pinyin: 0.7,
      fuzzy: 0.6
    }

    const weight = typeWeights[matchType as keyof typeof typeWeights] || 0.5
    return Math.min(similarity * weight, 1.0)
  }

  /**
   * 去重结果
   */
  private deduplicateResults(results: ClassificationResult[]): ClassificationResult[] {
    const uniqueMap = new Map<string, ClassificationResult>()

    for (const result of results) {
      const existing = uniqueMap.get(result.command_id)
      
      if (!existing || result.confidence > existing.confidence) {
        uniqueMap.set(result.command_id, result)
      }
    }

    return Array.from(uniqueMap.values())
  }

  /**
   * 更新指令列表
   */
  updateCommands(commands: Command[]): void {
    this.commands = commands
    this.fuseInstance = new Fuse(commands, {
      keys: [
        { name: 'content', weight: 0.7 },
        { name: 'description', weight: 0.3 }
      ],
      threshold: 0.6,
      includeScore: true,
      shouldSort: true
    })
    this.pinyinIndex = this.buildPinyinIndex()
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalCommands: number
    pinyinIndexSize: number
    averageCommandLength: number
  } {
    const totalLength = this.commands.reduce((sum, cmd) => sum + cmd.content.length, 0)
    
    return {
      totalCommands: this.commands.length,
      pinyinIndexSize: this.pinyinIndex.size,
      averageCommandLength: Math.round(totalLength / this.commands.length)
    }
  }
}
