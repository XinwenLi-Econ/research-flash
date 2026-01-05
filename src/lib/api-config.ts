/**
 * API 配置
 * 原生应用需要使用绝对 URL 调用托管的后端
 */

// 检测是否在 Capacitor 原生环境中运行
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.();
}

// 生产环境 API 基础 URL
const PRODUCTION_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://research-flash.vercel.app';

/**
 * 获取 API 基础 URL
 * - Web: 使用相对路径
 * - Native: 使用绝对 URL
 */
export function getApiBaseUrl(): string {
  if (isNative()) {
    return PRODUCTION_API_URL;
  }
  return '';
}

/**
 * 构建完整的 API URL
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  return `${base}${path}`;
}
