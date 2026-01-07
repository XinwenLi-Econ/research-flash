/**
 * 生成 Android 自适应图标 (Adaptive Icons)
 * - ic_launcher_foreground.png: 前景层（带安全区域内边距）
 * - ic_launcher_round.png: 圆形图标
 */

import sharp from 'sharp'
import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')

// Android mipmap 尺寸配置
const ANDROID_DENSITIES = [
  { density: 'xxxhdpi', size: 192, foregroundSize: 432 },
  { density: 'xxhdpi', size: 144, foregroundSize: 324 },
  { density: 'xhdpi', size: 96, foregroundSize: 216 },
  { density: 'hdpi', size: 72, foregroundSize: 162 },
  { density: 'mdpi', size: 48, foregroundSize: 108 },
]

// 自适应图标前景层 SVG（带安全区域）
function getForegroundSVG(canvasSize: number): string {
  // 前景图标应该在画布的中心 66% 区域内（安全区域）
  const safeZone = canvasSize * 0.66
  const padding = (canvasSize - safeZone) / 2
  const scale = safeZone / 1024

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}">
    <defs>
      <linearGradient id="gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#f5e6a3"/>
        <stop offset="30%" style="stop-color:#d4af37"/>
        <stop offset="100%" style="stop-color:#9a7b2c"/>
      </linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="${15 * scale}" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g transform="translate(${padding}, ${padding}) scale(${scale})">
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
    </g>
  </svg>`
}

// 牛津蓝配色 - 更明亮版本
const OXFORD_BLUE_LIGHT = '#0d4f8b'
const OXFORD_BLUE_DARK = '#002147'

// 圆形图标 SVG
function getRoundSVG(size: number): string {
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
      <clipPath id="circle">
        <circle cx="512" cy="512" r="512"/>
      </clipPath>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="20" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g clip-path="url(#circle)">
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <ellipse cx="512" cy="512" rx="280" ry="400" fill="rgba(212, 175, 55, 0.03)"/>
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
    </g>
  </svg>`
}

async function main() {
  console.log('\n🤖 Generating Android Adaptive Icons...\n')

  const androidResDir = join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'res')

  for (const { density, size, foregroundSize } of ANDROID_DENSITIES) {
    const mipmapDir = join(androidResDir, `mipmap-${density}`)

    // 生成 foreground
    const foregroundSvg = Buffer.from(getForegroundSVG(foregroundSize))
    await sharp(foregroundSvg)
      .resize(foregroundSize, foregroundSize)
      .png()
      .toFile(join(mipmapDir, 'ic_launcher_foreground.png'))
    console.log(`  ✓ mipmap-${density}/ic_launcher_foreground.png (${foregroundSize}x${foregroundSize})`)

    // 生成 round
    const roundSvg = Buffer.from(getRoundSVG(size))
    await sharp(roundSvg)
      .resize(size, size)
      .png()
      .toFile(join(mipmapDir, 'ic_launcher_round.png'))
    console.log(`  ✓ mipmap-${density}/ic_launcher_round.png (${size}x${size})`)
  }

  console.log('\n✅ Android adaptive icons generated successfully!')
}

main().catch(console.error)
