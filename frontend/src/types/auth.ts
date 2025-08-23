export interface User {
  id: number
  username: string
  role: 'admin' | 'doctor'
  is_active: boolean
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

