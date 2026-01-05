#!/bin/bash
# 移动端构建脚本
# 临时排除 API 路由以支持静态导出

set -e

API_DIR="src/app/api"
API_BACKUP="_api_backup"

echo "📱 开始移动端构建..."

# 1. 备份 API 目录
if [ -d "$API_DIR" ]; then
  echo "  → 临时移除 API 路由..."
  mv "$API_DIR" "$API_BACKUP"
fi

# 2. 执行静态导出构建
echo "  → 执行 Next.js 静态导出..."
BUILD_TARGET=mobile bun run build
BUILD_EXIT_CODE=$?

# 3. 恢复 API 目录
if [ -d "$API_BACKUP" ]; then
  echo "  → 恢复 API 路由..."
  mv "$API_BACKUP" "$API_DIR"
fi

# 检查构建结果
if [ $BUILD_EXIT_CODE -ne 0 ]; then
  echo "❌ 构建失败"
  exit $BUILD_EXIT_CODE
fi

echo "✅ 移动端构建完成！输出目录: out/"
