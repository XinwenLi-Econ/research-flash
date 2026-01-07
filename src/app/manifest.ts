import type { MetadataRoute } from 'next'

// 静态导出配置
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ResearchFlash - 研究灵感速记本',
    short_name: 'ResearchFlash',
    description: '你的第二海马体：零摩擦捕捉，算法化重现',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#002147',
    theme_color: '#d4af37',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
