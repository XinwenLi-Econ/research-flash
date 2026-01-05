import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.researchflash.app',
  appName: 'ResearchFlash',
  // 使用 Next.js 静态导出目录
  webDir: 'out',
  server: {
    // 允许访问远程 API
    allowNavigation: ['research-flash.vercel.app'],
  },
  plugins: {},
};

export default config;
