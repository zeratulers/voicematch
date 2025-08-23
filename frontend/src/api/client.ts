/**
 * API客户端 - 重新设计版本
 * 
 * 统一的HTTP客户端，包含认证、错误处理和请求拦截
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import { toast } from 'sonner'

// 类型导入
import type { 
  LoginRequest, 
  LoginResponse, 
  RefreshTokenRequest, 
  User 
} from '../types/auth'
import type { 
  Patient, 
  PatientCreate, 
  PatientUpdate, 
  PatientListResponse, 
  PatientWithAssignments
} from '../types/patient'
import type { 
  Command, 
  CommandCreate, 
  CommandUpdate, 
  CommandListResponse,
  CommandWithVariants,
  CommandVariant,
  CommandVariantCreate,
  CommandVariantUpdate,
  CommandVariantWithDialect,
  DialectSet,
  DoctorCommandStats
} from '../types/command'
import type {
  PatientAssignment,
  PatientAssignmentCreate,
  PatientAssignmentUpdate,
  PatientAssignmentWithDetails,
  BatchAssignmentCreate,
  BatchAssignmentResponse
} from '../types/assignment'

// API配置
const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || '/api/v1'

class ApiClient {
  private client: AxiosInstance
  private accessToken: string | null = null
  private refreshToken: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // 请求拦截器 - 添加认证token
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // 响应拦截器 - 处理token刷新和错误
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            if (this.refreshToken) {
              const response = await this.refreshAccessToken()
              this.setTokens(response.access_token, this.refreshToken)
              return this.client(originalRequest)
            }
          } catch (refreshError) {
            this.clearTokens()
            window.location.href = '/login'
            return Promise.reject(refreshError)
          }
        }

        // 显示错误提示
        if (error.response?.data && typeof error.response.data === 'object' && 'detail' in error.response.data) {
          toast.error((error.response.data as any).detail)
        } else if (error.message) {
          toast.error(error.message)
        }

        return Promise.reject(error)
      }
    )

    // 从localStorage加载token
    this.loadTokensFromStorage()
  }

  private loadTokensFromStorage() {
    const accessToken = localStorage.getItem('access_token')
    const refreshToken = localStorage.getItem('refresh_token')
    if (accessToken && refreshToken) {
      this.setTokens(accessToken, refreshToken)
    }
  }

  private saveTokensToStorage() {
    if (this.accessToken && this.refreshToken) {
      localStorage.setItem('access_token', this.accessToken)
      localStorage.setItem('refresh_token', this.refreshToken)
    }
  }

  private clearTokensFromStorage() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.saveTokensToStorage()
  }

  clearTokens() {
    this.accessToken = null
    this.refreshToken = null
    this.clearTokensFromStorage()
  }

  // === 认证API ===

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', credentials)
    const { access_token, refresh_token } = response.data
    this.setTokens(access_token, refresh_token)
    return response.data
  }

  async refreshAccessToken(): Promise<{ access_token: string }> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available')
    }
    
    const response = await this.client.post<{ access_token: string }>('/auth/refresh', {
      refresh_token: this.refreshToken
    })
    return response.data
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/auth/me')
    return response.data
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout')
    } finally {
      this.clearTokens()
    }
  }

  // === 患者API ===

  async getPatients(params?: {
    page?: number
    size?: number
    search?: string
  }): Promise<PatientListResponse> {
    const response = await this.client.get<PatientListResponse>('/patients', { params })
    return response.data
  }

  async createPatient(patient: PatientCreate): Promise<Patient> {
    const response = await this.client.post<Patient>('/patients', patient)
    return response.data
  }

  async getPatient(id: number): Promise<PatientWithAssignments> {
    const response = await this.client.get<PatientWithAssignments>(`/patients/${id}`)
    return response.data
  }

  async updatePatient(id: number, patient: PatientUpdate): Promise<Patient> {
    const response = await this.client.put<Patient>(`/patients/${id}`, patient)
    return response.data
  }

  async deletePatient(id: number): Promise<void> {
    await this.client.delete(`/patients/${id}`)
  }

  // === 患者分配API ===

  async getPatientAssignments(patientId: number, isActive?: boolean): Promise<PatientAssignmentWithDetails[]> {
    const params = isActive !== undefined ? { is_active: isActive } : {}
    const response = await this.client.get<PatientAssignmentWithDetails[]>(`/assignments/patient/${patientId}`, { params })
    return response.data
  }

  async createPatientAssignment(assignment: PatientAssignmentCreate): Promise<PatientAssignment> {
    const response = await this.client.post<PatientAssignment>('/assignments', assignment)
    return response.data
  }

  async updatePatientAssignment(assignmentId: number, update: PatientAssignmentUpdate): Promise<PatientAssignment> {
    const response = await this.client.put<PatientAssignment>(`/assignments/${assignmentId}`, update)
    return response.data
  }

  async deletePatientAssignment(assignmentId: number): Promise<void> {
    await this.client.delete(`/assignments/${assignmentId}`)
  }

  async batchCreatePatientAssignments(data: BatchAssignmentCreate): Promise<BatchAssignmentResponse> {
    const response = await this.client.post<BatchAssignmentResponse>('/assignments/batch', data)
    return response.data
  }

  // === 指令API ===

  async getCommands(params?: {
    page?: number
    size?: number
    is_active?: boolean
    is_template?: boolean
    search?: string
  }): Promise<CommandListResponse> {
    const response = await this.client.get<CommandListResponse>('/commands', { params })
    return response.data
  }

  async createCommand(command: CommandCreate): Promise<Command> {
    const response = await this.client.post<Command>('/commands', command)
    return response.data
  }

  async getCommand(id: string): Promise<CommandWithVariants> {
    const response = await this.client.get<CommandWithVariants>(`/commands/${id}`)
    return response.data
  }

  async updateCommand(id: string, command: CommandUpdate): Promise<Command> {
    const response = await this.client.put<Command>(`/commands/${id}`, command)
    return response.data
  }

  async deleteCommand(id: string): Promise<void> {
    await this.client.delete(`/commands/${id}`)
  }

  async getDoctorCommandStats(): Promise<DoctorCommandStats> {
    const response = await this.client.get<DoctorCommandStats>('/commands/stats/doctor')
    return response.data
  }

  // === 变体API ===

  async getDialectSets(): Promise<DialectSet[]> {
    const response = await this.client.get<DialectSet[]>('/dialect-sets')
    return response.data
  }

  async getCommandVariants(commandId: string): Promise<CommandVariantWithDialect[]> {
    const response = await this.client.get<CommandVariantWithDialect[]>(`/commands/${commandId}/variants`)
    return response.data
  }

  async createCommandVariant(commandId: string, variant: CommandVariantCreate): Promise<CommandVariant> {
    const response = await this.client.post<CommandVariant>(`/commands/${commandId}/variants`, variant)
    return response.data
  }

  async updateCommandVariant(variantId: number, variant: CommandVariantUpdate): Promise<CommandVariant> {
    const response = await this.client.put<CommandVariant>(`/variants/${variantId}`, variant)
    return response.data
  }

  async deleteCommandVariant(variantId: number): Promise<void> {
    await this.client.delete(`/variants/${variantId}`)
  }

  // === 播放API ===

  async triggerPlayback(request: { patient_id: number; command_id: string }): Promise<{
    command_content: string
    audio_url: string
    dialect_label: string
  }> {
    const response = await this.client.post('/playback/trigger', request)
    return response.data
  }

  async getPatientPlayableCommands(patientId: number): Promise<{
    patient_id: number;
    patient_name: string;
    total_commands: number;
    commands: Array<{
      command_id: string;
      content: string;
      description?: string;
      audio_url: string;
      duration_ms?: number;
      dialect_label: string;
      speaker_name: string;
      variant_id: number;
    }>;
  }> {
    const response = await this.client.get(`/playback/resolve/${patientId}`)
    return response.data
  }

  async triggerPlaybackByContent(request: { patient_id: number; command_content: string }): Promise<{
    command_content: string
    audio_url: string
    dialect_label: string
  }> {
    const response = await this.client.post('/playback/trigger-by-content', request)
    return response.data
  }

  // === 文件上传API ===

  async uploadAudio(file: File): Promise<{
    audio_url: string
    filename: string
    size: number
    duration_ms?: number
  }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.client.post('/uploads/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async deleteAudio(filename: string): Promise<{ message: string }> {
    const response = await this.client.delete(`/uploads/${filename}`)
    return response.data
  }

  async getFileInfo(filename: string): Promise<{
    filename: string
    size: number
    created_at: number
    modified_at: number
    mime_type?: string
  }> {
    const response = await this.client.get(`/uploads/info/${filename}`)
    return response.data
  }
}

// 创建全局API客户端实例
export const apiClient = new ApiClient()

// 导出默认实例
export default apiClient