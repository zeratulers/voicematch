/**
 * 患者相关类型定义 - 重新设计版本
 */

export type Gender = 'MALE' | 'FEMALE' | 'OTHER'

export interface Patient {
  id: number
  name: string
  gender: Gender
  date_of_birth?: string
  note?: string
  doctor_id: number
  created_at: string
  updated_at: string
}

export interface PatientWithDoctor extends Patient {
  doctor_name: string
  doctor_username: string
  department?: string
}

export interface PatientWithAssignments extends Patient {
  assignments: Array<{
    id: number
    command_id: string
    command_content: string
    variant_id: number
    is_active: boolean
    created_at: string
  }>
  total_assignments: number
  active_assignments: number
}

export interface PatientCreate {
  name: string
  gender: Gender
  date_of_birth?: string
  note?: string
}

export interface PatientUpdate {
  name?: string
  gender?: Gender
  date_of_birth?: string
  note?: string
}

export interface PatientListResponse {
  items: Patient[]
  total: number
  page: number
  size: number
  pages: number
}

export interface PatientStats {
  id: number
  name: string
  gender: Gender
  total_commands: number
  active_commands: number
  commands_with_variants: number
  last_command_created?: string
}

// 导入Command类型
import type { Command } from './command'