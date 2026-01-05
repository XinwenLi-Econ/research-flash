import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.researchflash.app',
  appName: 'ResearchFlash',
  webDir: 'public',
  server: {
    url: 'https://flash.xinwen-li.com',
    cleartext: true,
    // 允许导航到外部 URL
    allowNavigation: ['flash.xinwen-li.com', '*.xinwen-li.com'],
  },
  android: {
    // 允许混合内容
    allowMixedContent: true,
    // 使用 HTTPS scheme
    useLegacyBridge: false,
  },
  ios: {
    // 启用 App Bound Domains 支持，配合 Info.plist 中的 WKAppBoundDomains
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {},
};

export default config;
