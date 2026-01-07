/**
 * ResearchFlash Icon Generator
 * 生成 iOS 和 Android 完整图标资源包
 * 设计: The Spark of Insight (洞见火花) - 变体 C 优雅版
 */

import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')

// iOS 图标尺寸配置
const IOS_SIZES = [
  { size: 1024, name: 'icon-1024x1024', purpose: 'App Store' },
  { size: 180, name: 'apple-touch-icon-180x180', purpose: 'iPhone @3x' },
  { size: 167, name: 'apple-touch-icon-167x167', purpose: 'iPad Pro @2x' },
  { size: 152, name: 'apple-touch-icon-152x152', purpose: 'iPad @2x' },
  { size: 120, name: 'apple-touch-icon-120x120', purpose: 'iPhone @2x' },
  { size: 87, name: 'icon-87x87', purpose: 'iPhone @3x Spotlight' },
  { size: 80, name: 'icon-80x80', purpose: 'iPad @2x Spotlight' },
  { size: 76, name: 'icon-76x76', purpose: 'iPad @1x' },
  { size: 60, name: 'icon-60x60', purpose: 'iPhone @1x' },
  { size: 58, name: 'icon-58x58', purpose: 'Settings @2x' },
  { size: 40, name: 'icon-40x40', purpose: 'Spotlight @1x' },
  { size: 29, name: 'icon-29x29', purpose: 'Settings @1x' },
  { size: 20, name: 'icon-20x20', purpose: 'Notification @1x' },
]

// Android 图标尺寸配置
const ANDROID_SIZES = [
  { size: 512, name: 'icon-512x512', density: 'playstore' },
  { size: 192, name: 'icon-192x192', density: 'xxxhdpi' },
  { size: 144, name: 'icon-144x144', density: 'xxhdpi' },
  { size: 96, name: 'icon-96x96', density: 'xhdpi' },
  { size: 72, name: 'icon-72x72', density: 'hdpi' },
  { size: 48, name: 'icon-48x48', density: 'mdpi' },
  { size: 36, name: 'icon-36x36', density: 'ldpi' },
]

// PWA/Web 通用尺寸
const WEB_SIZES = [
  { size: 512, name: 'icon-512x512' },
  { size: 192, name: 'icon-192x192' },
  { size: 180, name: 'apple-touch-icon' },
  { size: 32, name: 'favicon-32x32' },
  { size: 16, name: 'favicon-16x16' },
]

// 牛津蓝配色 - 更明亮版本，确保在手机屏幕上可见蓝色调
// 亮部: #0d4f8b (明亮蓝), 暗部: #002147 (标准牛津蓝)
const OXFORD_BLUE_LIGHT = '#0d4f8b'
const OXFORD_BLUE_DARK = '#002147'

// 为小尺寸优化的简化版 SVG
function getSimplifiedSVG(size: number): string {
  // 超小尺寸 (< 50px) 使用最简化版本
  if (size < 50) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
      <defs>
        <radialGradient id="bg" cx="40%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:${OXFORD_BLUE_LIGHT}"/>
          <stop offset="100%" style="stop-color:${OXFORD_BLUE_DARK}"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <path d="M 500 200 C 580 370, 370 540, 540 720 L 512 850"
            fill="none" stroke="#d4af37" stroke-width="110" stroke-linecap="round"/>
      <circle cx="512" cy="870" r="80" fill="#f5e6a3"/>
    </svg>`
  }

  // 小尺寸 (50-100px) 使用简化版本
  if (size < 100) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
      <defs>
        <radialGradient id="bg" cx="40%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:${OXFORD_BLUE_LIGHT}"/>
          <stop offset="100%" style="stop-color:${OXFORD_BLUE_DARK}"/>
        </radialGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#f5e6a3"/>
          <stop offset="30%" style="stop-color:#d4af37"/>
          <stop offset="100%" style="stop-color:#9a7b2c"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <path d="M 483 140 Q 540 220, 400 310 Q 280 400, 480 520 Q 600 620, 450 750 L 512 850"
            fill="none" stroke="url(#gold)" stroke-width="62" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="512" cy="865" r="55" fill="#d4af37"/>
      <circle cx="512" cy="865" r="95" fill="none" stroke="rgba(212, 175, 55, 0.4)" stroke-width="12"/>
    </svg>`
  }

  // 中等尺寸 (100-200px)
  if (size < 200) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
      <defs>
        <radialGradient id="bg" cx="40%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:${OXFORD_BLUE_LIGHT}"/>
          <stop offset="100%" style="stop-color:${OXFORD_BLUE_DARK}"/>
        </radialGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#f5e6a3"/>
          <stop offset="30%" style="stop-color:#d4af37"/>
          <stop offset="100%" style="stop-color:#9a7b2c"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="15" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <g filter="url(#glow)">
        <path d="M 483 125 Q 540 200, 427 273 Q 313 346, 443 420 Q 569 494, 466 568 Q 370 642, 500 716 Q 540 756, 512 824"
              fill="none" stroke="url(#gold)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 427 273 Q 340 238, 273 262" fill="none" stroke="url(#gold)" stroke-width="22" stroke-linecap="round"/>
        <path d="M 466 568 Q 569 545, 654 568" fill="none" stroke="url(#gold)" stroke-width="22" stroke-linecap="round"/>
      </g>
      <circle cx="512" cy="852" r="28" fill="#f5e6a3"/>
      <circle cx="512" cy="852" r="68" fill="none" stroke="rgba(212, 175, 55, 0.5)" stroke-width="8"/>
      <circle cx="512" cy="852" r="125" fill="none" stroke="rgba(212, 175, 55, 0.25)" stroke-width="6"/>
    </svg>`
  }

  // 大尺寸 (>= 200px) 使用完整版本
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <defs>
      <radialGradient id="bg" cx="40%" cy="30%" r="70%">
        <stop offset="0%" style="stop-color:${OXFORD_BLUE_LIGHT}"/>
        <stop offset="100%" style="stop-color:${OXFORD_BLUE_DARK}"/>
      </radialGradient>
      <linearGradient id="gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#f5e6a3"/>
        <stop offset="30%" style="stop-color:#d4af37"/>
        <stop offset="100%" style="stop-color:#9a7b2c"/>
      </linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="20" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="45"/>
      </filter>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <ellipse cx="512" cy="512" rx="280" ry="400" fill="rgba(212, 175, 55, 0.03)" filter="url(#softGlow)"/>
    <g filter="url(#glow)">
      <path d="M 483 125 Q 540 200, 427 273" fill="none" stroke="url(#gold)" stroke-width="34" stroke-linecap="round"/>
      <path d="M 427 273 Q 313 346, 443 420" fill="none" stroke="url(#gold)" stroke-width="28" stroke-linecap="round"/>
      <path d="M 443 420 Q 569 494, 466 568" fill="none" stroke="url(#gold)" stroke-width="25" stroke-linecap="round"/>
      <path d="M 466 568 Q 370 642, 500 716" fill="none" stroke="url(#gold)" stroke-width="22" stroke-linecap="round"/>
      <path d="M 500 716 Q 540 756, 512 824" fill="none" stroke="url(#gold)" stroke-width="17" stroke-linecap="round"/>
      <path d="M 427 273 Q 340 238, 273 262" fill="none" stroke="url(#gold)" stroke-width="14" stroke-linecap="round"/>
      <path d="M 466 568 Q 569 545, 654 568" fill="none" stroke="url(#gold)" stroke-width="14" stroke-linecap="round"/>
    </g>
    <circle cx="512" cy="852" r="17" fill="#f5e6a3"/>
    <circle cx="512" cy="852" r="45" fill="none" stroke="rgba(212, 175, 55, 0.6)" stroke-width="5.5"/>
    <circle cx="512" cy="852" r="85" fill="none" stroke="rgba(212, 175, 55, 0.3)" stroke-width="4.5"/>
    <circle cx="512" cy="852" r="136" fill="none" stroke="rgba(212, 175, 55, 0.15)" stroke-width="3.5"/>
  </svg>`
}

async function generateIcon(
  size: number,
  outputPath: string,
  format: 'png' | 'ico' = 'png'
): Promise<void> {
  const svg = Buffer.from(getSimplifiedSVG(size))

  // 牛津蓝背景色 (#002147 = r:0, g:33, b:71)
  const bgColor = { r: 0, g: 33, b: 71, alpha: 1 }

  if (format === 'ico') {
    // 生成 ICO 文件（使用 32x32 PNG）
    await sharp(svg)
      .resize(size, size, { fit: 'contain', background: bgColor })
      .png()
      .toFile(outputPath.replace('.ico', '.png'))

    // ICO 文件直接使用 PNG
    const pngBuffer = await sharp(svg)
      .resize(32, 32, { fit: 'contain', background: bgColor })
      .png()
      .toBuffer()

    await writeFile(outputPath, pngBuffer)
  } else {
    await sharp(svg)
      .resize(size, size, { fit: 'contain', background: bgColor })
      .png()
      .toFile(outputPath)
  }

  console.log(`  ✓ ${outputPath} (${size}x${size})`)
}

async function main() {
  console.log('\n🎨 ResearchFlash Icon Generator')
  console.log('================================')
  console.log('Design: The Spark of Insight (洞见火花) - Variant C\n')

  // 创建输出目录
  const iosOutputDir = join(PROJECT_ROOT, 'icon-assets', 'ios')
  const androidOutputDir = join(PROJECT_ROOT, 'icon-assets', 'android')
  const publicIconsDir = join(PROJECT_ROOT, 'public', 'icons')

  await mkdir(iosOutputDir, { recursive: true })
  await mkdir(androidOutputDir, { recursive: true })
  await mkdir(publicIconsDir, { recursive: true })

  // 生成 iOS 图标
  console.log('📱 Generating iOS Icons...')
  for (const { size, name, purpose } of IOS_SIZES) {
    await generateIcon(size, join(iosOutputDir, `${name}.png`))
  }
  console.log(`  Total: ${IOS_SIZES.length} iOS icons generated\n`)

  // 生成 Android 图标
  console.log('🤖 Generating Android Icons...')
  for (const { size, name, density } of ANDROID_SIZES) {
    await generateIcon(size, join(androidOutputDir, `${name}.png`))
  }
  console.log(`  Total: ${ANDROID_SIZES.length} Android icons generated\n`)

  // 生成 PWA/Web 图标 (应用到项目)
  console.log('🌐 Generating Web/PWA Icons (applying to project)...')
  for (const { size, name } of WEB_SIZES) {
    await generateIcon(size, join(publicIconsDir, `${name}.png`))
  }

  // 生成 favicon.ico
  await generateIcon(32, join(publicIconsDir, 'favicon.ico'), 'ico')
  console.log('  ✓ favicon.ico generated')

  // 复制主要 SVG 文件
  const baseSvg = getSimplifiedSVG(512)
  await writeFile(join(publicIconsDir, 'icon.svg'), baseSvg)
  await writeFile(join(publicIconsDir, 'favicon.svg'), getSimplifiedSVG(32))
  await writeFile(join(publicIconsDir, 'apple-touch-icon.svg'), getSimplifiedSVG(180))
  console.log('  ✓ SVG source files copied\n')

  // 生成汇总报告
  console.log('📋 Summary')
  console.log('================================')
  console.log(`iOS icons:     ${iosOutputDir}`)
  console.log(`Android icons: ${androidOutputDir}`)
  console.log(`Web icons:     ${publicIconsDir} (APPLIED)`)
  console.log('')
  console.log('✅ iOS icons have been applied to the project.')
  console.log('⏸️  Android icons are ready but NOT applied (awaiting your approval).')
  console.log('')
}

main().catch(console.error)
