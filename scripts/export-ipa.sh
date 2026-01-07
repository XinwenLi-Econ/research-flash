#!/bin/bash
# iOS IPA 一键导出脚本
# 使用方法: bun run cap:export-ipa

set -e

# 配置
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$PROJECT_DIR/ios"
XCODEPROJ="$IOS_DIR/App/App.xcodeproj"
SCHEME="App"
ARCHIVE_PATH="$IOS_DIR/build/App.xcarchive"
EXPORT_PATH="$IOS_DIR/build/ipa"
EXPORT_OPTIONS="$IOS_DIR/ExportOptions.plist"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "============================================"
echo "  ResearchFlash iOS IPA 一键导出"
echo "============================================"
echo ""

# Step 1: 清理旧的构建
echo -e "${YELLOW}[1/5]${NC} 清理旧的构建文件..."
rm -rf "$IOS_DIR/build"
mkdir -p "$IOS_DIR/build"

# Step 2: 构建 Web 内容并同步到 iOS
echo -e "${YELLOW}[2/5]${NC} 构建 Web 内容并同步..."
cd "$PROJECT_DIR"
bun run cap:build

# Step 3: 确保图标等资源同步
echo -e "${YELLOW}[3/5]${NC} 同步 iOS 资源..."
npx cap sync ios

# Step 4: Archive
echo -e "${YELLOW}[4/5]${NC} 执行 Xcode Archive（这可能需要几分钟）..."
xcodebuild archive \
  -project "$XCODEPROJ" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  -allowProvisioningUpdates \
  CODE_SIGNING_ALLOWED=YES \
  | grep -E "(Compiling|Linking|Archive|error:|warning:)" || true

# 检查 Archive 是否成功
if [ ! -d "$ARCHIVE_PATH" ]; then
  echo -e "${RED}❌ Archive 失败！${NC}"
  echo "请在 Xcode 中手动检查签名配置："
  echo "  1. 打开 Xcode: bun run cap:ios"
  echo "  2. Signing & Capabilities → 选择你的 Team"
  exit 1
fi

echo -e "${GREEN}✅ Archive 成功${NC}"

# Step 5: 导出 IPA
echo -e "${YELLOW}[5/5]${NC} 导出 IPA..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates \
  | grep -E "(Export|error:|warning:)" || true

# 查找生成的 IPA
IPA_FILE=$(find "$EXPORT_PATH" -name "*.ipa" -type f 2>/dev/null | head -1)

if [ -z "$IPA_FILE" ]; then
  echo -e "${RED}❌ IPA 导出失败！${NC}"
  echo ""
  echo "可能的原因："
  echo "  1. 签名配置问题 - 请先在 Xcode 中手动 Archive 一次"
  echo "  2. Team ID 未配置"
  echo ""
  echo "手动导出步骤："
  echo "  1. 运行: bun run cap:ios"
  echo "  2. Xcode: Product → Archive"
  echo "  3. Distribute App → Custom → Development"
  exit 1
fi

# 复制到项目根目录并重命名
FINAL_IPA="$PROJECT_DIR/ResearchFlash_${TIMESTAMP}.ipa"
cp "$IPA_FILE" "$FINAL_IPA"

echo ""
echo "============================================"
echo -e "${GREEN}✅ IPA 导出成功！${NC}"
echo "============================================"
echo ""
echo "IPA 文件位置:"
echo "  $FINAL_IPA"
echo ""
echo "下一步："
echo "  1. 将 IPA 文件 AirDrop 到 iPhone"
echo "  2. 在 iPhone「文件」App 中打开"
echo "  3. 选择用 SideStore 安装"
echo ""
