/**
 * 智能指令分类器 - 句向量 + 拼音/字符相似度 融合分类器（纯前端）
 * 
 * 功能：
 * 1. 使用多语言句向量模型进行语义相似度计算
 * 2. 结合拼音相似度处理同音词问题
 * 3. 字符相似度作为辅助
 * 4. 多信号融合给出最终分类结果
 */

import { pipeline } from '@xenova/transformers'
import { pinyin } from 'pinyin-pro'
import stringSimilarity from 'string-similarity'

export type Command = { 
  id: string
  content: string
  aliases?: string[] 
}

export type ClassifierInit = {
  commands: Command[]
}

export type ClassificationResult = {
  best: { id: string; content: string; score: number }
  top3: Array<{ 
    id: string
    content: string
    score: number
    parts: { sem: number; pin: number; chr: number }
  }>
  decision: 'sure' | 'maybe' | 'unsure'
}

// 预计算缓存
let embedder: any
let cmdIndex: Array<{
  id: string
  content: string
  aliases: string[]
  textBag: string[]     // content + aliases
  pinyinBag: string[]   // 对应拼音（无声调、无空格）
  vec: number[]         // content 的句向量
}> = []

// 模型加载状态
let modelLoaded = false
let modelLoading = false

/**
 * 中文数字转阿拉伯数字
 */
const normalizeNum = (s: string): string => {
  const chineseNumbers: Record<string, string> = {
    '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
    '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
    '〇': '0', '零': '0'
  }
  
  return s.replace(/[一二三四五六七八九十〇零]/g, (ch) => chineseNumbers[ch] || ch)
}

/**
 * 文本清理：去除标点、空格，转小写，数字归一化
 */
const clean = (s: string): string => {
  return normalizeNum(s)
    .replace(/\s+/g, '')
    .replace(/[，。、！？：；,.!?;:]/g, '')
    .toLowerCase()
}

/**
 * 转换为拼音（无声调）
 */
const toPinyin = (s: string): string => {
  try {
    return pinyin(s, { toneType: 'none', type: 'array' }).join('')
  } catch (error) {
    console.warn('拼音转换失败:', s, error)
    return s
  }
}

/**
 * 计算余弦相似度
 */
const cosine = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0
  
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const norm = Math.sqrt(normA) * Math.sqrt(normB)
  return norm > 0 ? dot / norm : 0
}

/**
 * 去重工具函数
 */
const unique = (arr: string[]): string[] => {
  return [...new Set(arr.filter(Boolean))]
}

/**
 * 初始化分类器
 * 
 * @param commands 指令列表
 */
export async function initClassifier({ commands }: ClassifierInit): Promise<void> {
  if (modelLoading) {
    console.log('⏳ 模型正在加载中...')
    return
  }
  
  if (modelLoaded && cmdIndex.length > 0) {
    console.log('✅ 分类器已初始化，跳过重复加载')
    return
  }
  
  try {
    modelLoading = true
    console.log('🤖 开始加载多语言句向量模型...')
    
    // 1) 加载句向量模型（约120MB，首次加载需要时间）
    embedder = await pipeline(
      'feature-extraction', 
      'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
      {
        // 可选：指定设备和精度
        // device: 'webgpu', // 如果支持WebGPU会更快
        // dtype: 'fp16'     // 节省内存
      }
    )
    
    console.log('✅ 句向量模型加载完成')
    
    // 2) 建立指令索引
    console.log(`📝 开始为 ${commands.length} 条指令建立索引...`)
    cmdIndex = []
    
    for (let i = 0; i < commands.length; i++) {
      const c = commands[i]
      
      // 构建文本包：原文 + 别名
      const bag = unique([c.content, ...(c.aliases || [])])
      const cleanBag = bag.map(clean)
      const pinyinBag = cleanBag.map(toPinyin)
      
      // 为主要内容生成句向量
      console.log(`📊 正在处理指令 ${i + 1}/${commands.length}: "${c.content}"`)
      const embedding = await embedder(c.content, { 
        pooling: 'mean', 
        normalize: true 
      })
      
      cmdIndex.push({
        id: c.id,
        content: c.content,
        aliases: c.aliases || [],
        textBag: cleanBag,
        pinyinBag: pinyinBag,
        vec: Array.from(embedding.data)
      })
    }
    
    modelLoaded = true
    console.log('🎯 指令分类器初始化完成！')
    console.log(`📊 统计信息:`)
    console.log(`   - 指令数量: ${cmdIndex.length}`)
    console.log(`   - 向量维度: ${cmdIndex[0]?.vec.length || 0}`)
    console.log(`   - 总文本变体: ${cmdIndex.reduce((sum, c) => sum + c.textBag.length, 0)}`)
    
  } catch (error) {
    console.error('❌ 分类器初始化失败:', error)
    modelLoaded = false
    throw error
  } finally {
    modelLoading = false
  }
}

/**
 * 对用户语音进行指令分类
 * 
 * @param utterance 用户说的话
 * @returns 分类结果
 */
export async function classify(utterance: string): Promise<ClassificationResult> {
  if (!modelLoaded || !embedder) {
    throw new Error('分类器未初始化，请先调用 initClassifier()')
  }
  
  if (!utterance || !utterance.trim()) {
    return {
      best: { id: '', content: '', score: 0 },
      top3: [],
      decision: 'unsure'
    }
  }
  
  console.log(`🔍 开始分类: "${utterance}"`)
  
  const text = clean(utterance)
  const textPinyin = toPinyin(text)
  
  console.log(`🧹 清理后: "${text}" | 拼音: "${textPinyin}"`)
  
  // 生成查询向量
  const embedding = await embedder(utterance, { 
    pooling: 'mean', 
    normalize: true 
  })
  const queryVec = Array.from(embedding.data)
  
  // 对每条指令计算相似度
  const candidates: Array<{
    id: string
    content: string
    score: number
    parts: { sem: number; pin: number; chr: number }
  }> = []
  
  let bestMatch = { id: '', content: '', score: -1 }
  
  for (const cmd of cmdIndex) {
    // 1. 语义相似度（句向量余弦相似度）
    const semantic = cosine(queryVec, cmd.vec)
    
    // 2. 拼音相似度（取最佳匹配）
    const pinyinScores = cmd.pinyinBag.map(p => 
      stringSimilarity.compareTwoStrings(textPinyin, p)
    )
    const pinyinSim = Math.max(...pinyinScores, 0)
    
    // 3. 字符相似度（取最佳匹配）
    const charScores = cmd.textBag.map(t => 
      stringSimilarity.compareTwoStrings(text, t)
    )
    const charSim = Math.max(...charScores, 0)
    
    // 4. 加权融合分数
    const weights = { semantic: 0.45, pinyin: 0.35, char: 0.20 }
    const finalScore = 
      weights.semantic * semantic + 
      weights.pinyin * pinyinSim + 
      weights.char * charSim
    
    candidates.push({
      id: cmd.id,
      content: cmd.content,
      score: finalScore,
      parts: { 
        sem: Math.round(semantic * 100) / 100,
        pin: Math.round(pinyinSim * 100) / 100,
        chr: Math.round(charSim * 100) / 100
      }
    })
    
    if (finalScore > bestMatch.score) {
      bestMatch = { id: cmd.id, content: cmd.content, score: finalScore }
    }
    
    console.log(`📊 ${cmd.content}: 语义=${semantic.toFixed(3)} 拼音=${pinyinSim.toFixed(3)} 字符=${charSim.toFixed(3)} 总分=${finalScore.toFixed(3)}`)
  }
  
  // 按分数排序
  candidates.sort((a, b) => b.score - a.score)
  const top3 = candidates.slice(0, 3)
  
  // 决策阈值
  const SURE_THRESHOLD = 0.72    // 确信阈值
  const MAYBE_THRESHOLD = 0.58   // 可能阈值
  
  let decision: 'sure' | 'maybe' | 'unsure'
  if (bestMatch.score >= SURE_THRESHOLD) {
    decision = 'sure'
    console.log(`✅ 确信匹配: "${bestMatch.content}" (分数: ${bestMatch.score.toFixed(3)})`)
  } else if (bestMatch.score >= MAYBE_THRESHOLD) {
    decision = 'maybe'
    console.log(`🤔 可能匹配: "${bestMatch.content}" (分数: ${bestMatch.score.toFixed(3)})`)
  } else {
    decision = 'unsure'
    console.log(`❓ 不确定匹配，最高分: ${bestMatch.score.toFixed(3)}`)
  }
  
  return {
    best: bestMatch,
    top3,
    decision
  }
}

/**
 * 获取分类器状态
 */
export function getClassifierStatus() {
  return {
    loaded: modelLoaded,
    loading: modelLoading,
    commandCount: cmdIndex.length,
    vectorDim: cmdIndex[0]?.vec.length || 0
  }
}

/**
 * 重置分类器
 */
export function resetClassifier() {
  modelLoaded = false
  modelLoading = false
  cmdIndex = []
  embedder = null
  console.log('🔄 分类器已重置')
}

