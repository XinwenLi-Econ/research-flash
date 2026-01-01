// types/auth.ts
// @source: cog.md
// 认证相关类型定义

/**
 * 认证用户信息
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified: boolean;
}

/**
 * 认证状态
 */
export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * 设备关联请求
 */
export interface DeviceLinkRequest {
  deviceId: string;
  userId: string;
}

/**
 * 设备关联响应
 */
export interface DeviceLinkResponse {
  success: boolean;
  linkedFlashesCount: number;
}

/**
 * 登录凭证
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * 注册凭证
 */
export interface SignUpCredentials {
  email: string;
  password: string;
  name: string;
}
