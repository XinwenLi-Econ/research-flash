/**
 * API 配置
 * 原生应用需要使用绝对 URL 调用托管的后端
 */

// 生产环境 API 基础 URL
const PRODUCTION_API_URL = 'https://flash.xinwen-li.com';

// 检测是否在 Capacitor 原生环境中运行
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;

  // 检查 Capacitor
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (capacitor?.isNativePlatform?.()) return true;

  // 检查是否从 file:// 或 capacitor:// 协议加载（Capacitor 应用特征）
  const protocol = window.location?.protocol;
  if (protocol === 'file:' || protocol === 'capacitor:') return true;

  // 检查是否在 localhost 以外的非标准环境
  const hostname = window.location?.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;

  // 如果 origin 为空或 null，可能是原生环境
  if (!window.location?.origin || window.location.origin === 'null') return true;

  return false;
}

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
