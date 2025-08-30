/**
 * 指令相关类型定义 - 重新设计版本
 * 
 * 指令库不再绑定特定患者
 */

export interface Command {
  id: string
  content: string
  description?: string
  doctor_id: number
  is_active: boolean
  is_template: boolean
  created_at: string
  updated_at: string
}

export interface CommandWithVariants extends Command {
  variants: CommandVariantWithDialect[]
  variant_count: number
  patient_assignment_count: number
}

export interface CommandCreate {
  content: string
  description?: string
  is_template?: boolean
}

export interface CommandUpdate {
  content?: string
  description?: string
  is_active?: boolean
  is_template?: boolean
}

export interface CommandVariant {
  id: number
  command_id: string
  dialect_set_id: number
  audio_url: string
  duration_ms?: number
  speaker_name?: string
  speaker_note?: string
  created_by?: number
  is_active: boolean
  is_template: boolean
  created_at: string
  updated_at: string
}

export interface DialectSet {
  id: number
  key: string
  label: string
  notes?: string
  is_default: boolean
  created_at: string
}

export interface CommandVariantWithDialect extends CommandVariant {
  dialect_set: DialectSet
}

export interface CommandVariantCreate {
  dialect_set_id: number
  audio_url: string
  duration_ms?: number
  speaker_name?: string
  speaker_note?: string
}

export interface CommandVariantUpdate {
  audio_url?: string
  duration_ms?: number
  speaker_name?: string
  speaker_note?: string
  is_active?: boolean
}

export interface CommandListResponse {
  items: Command[]
  total: number
  page: number
  size: number
  pages: number
}

export interface DoctorCommandStats {
  doctor_id: number
  doctor_name: string
  total_commands: number
  active_commands: number
  template_commands: number
  total_variants: number
  total_patients: number
  total_assignments: number
}