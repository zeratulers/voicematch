/**
 * 语音日志相关类型定义
 */

export interface VoiceLog {
  id: number
  patient_id: number
  user_id: number
  transcript: string
  confidence: number
  status: 'success' | 'no_match' | 'error'
  matched_command_id?: string
  matched_command_content?: string
  matched_confidence?: number
  processing_time_ms?: number
  created_at: string
  updated_at?: string
}

export interface VoiceLogCreate {
  transcript: string
  confidence: number
  status: 'success' | 'no_match' | 'error' | 'aborted'
  matched_command_id?: string
  matched_command_content?: string
  matched_confidence?: number
  processing_time_ms?: number
}

export interface VoiceLogListResponse {
  logs: VoiceLog[]
  total: number
  page: number
  size: number
  pages: number
}

export interface VoiceLogUploadRequest {
  patient_id: number
  logs: VoiceLogCreate[]
}

export interface VoiceLogUploadResponse {
  message: string
  uploaded_count: number
  failed_count: number
  errors: string[]
}
