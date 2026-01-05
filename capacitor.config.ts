import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.researchflash.app',
  appName: 'ResearchFlash',
  webDir: 'public',
  server: {
    url: 'https://flash.xinwen-li.com',
    cleartext: true,
  },
  ios: {
    // 启用 App Bound Domains 支持，配合 Info.plist 中的 WKAppBoundDomains
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {},
};

export default config;
