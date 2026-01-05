import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.researchflash.app',
  appName: 'ResearchFlash',
  webDir: 'public',
  server: {
    // 使用托管的 Web 应用
    url: 'https://research-flash.vercel.app',
    cleartext: true,
  },
  plugins: {},
};

export default config;
