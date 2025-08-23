/**
 * 语音识别相关类型声明
 */

// 语音识别 API 类型声明
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: (event: SpeechRecognitionEvent) => void
  onerror: (event: SpeechRecognitionErrorEvent) => void
  onend: () => void
  start(): void
  stop(): void
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message: string
}

// 全局声明
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

// annyang 类型声明增强
declare module 'annyang' {
  interface AnnyangOptions {
    autoRestart?: boolean
    continuous?: boolean
    debug?: boolean
    paused?: boolean
  }

  interface Annyang {
    addCommands(commands: { [phrase: string]: () => void }): void
    removeCommands(commands?: string | string[]): void
    start(options?: AnnyangOptions): void
    abort(): void
    pause(): void
    resume(): void
    debug(enabled?: boolean): void
    setLanguage(language: string): void
    addCallback(
      type: 'start' | 'soundstart' | 'error' | 'end' | 'result' | 'resultMatch' | 'resultNoMatch' | 'errorNetwork' | 'errorPermissionBlocked' | 'errorPermissionDenied',
      callback: (userSaid?: string, commandText?: string, phrases?: string[]) => void
    ): void
    removeCallback(
      type?: 'start' | 'soundstart' | 'error' | 'end' | 'result' | 'resultMatch' | 'resultNoMatch' | 'errorNetwork' | 'errorPermissionBlocked' | 'errorPermissionDenied',
      callback?: (userSaid?: string, commandText?: string, phrases?: string[]) => void
    ): void
    getSpeechRecognizer(): SpeechRecognition | null
    trigger(phrase: string): void
    isListening(): boolean
  }

  const annyang: Annyang
  export default annyang
}

export {}
