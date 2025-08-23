/**
 * 患者指令分配相关类型定义
 * 
 * 管理患者与指令变体的绑定关系
 */

export interface PatientAssignment {
  id: number
  patient_id: number
  command_id: string
  variant_id: number
  assigned_by?: number
  is_active: boolean
  note?: string
  created_at: string
  updated_at: string
}

export interface PatientAssignmentWithDetails extends PatientAssignment {
  command_content: string
  command_description?: string
  dialect_label: string
  speaker_name: string
  audio_url: string
  duration_ms?: number
}

export interface PatientAssignmentCreate {
  patient_id: number
  command_id: string
  variant_id: number
  note?: string
}

export interface PatientAssignmentUpdate {
  variant_id?: number
  is_active?: boolean
  note?: string
}

export interface BatchAssignmentCreate {
  patient_id: number
  assignments: {
    command_id: string
    variant_id: number
    note?: string
  }[]
}

export interface BatchAssignmentResponse {
  success_count: number
  failed_count: number
  assignments: PatientAssignment[]
  errors: string[]
}
