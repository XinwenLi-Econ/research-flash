#!/bin/bash

# ============================================================
# ResearchFlash Android 一键打包脚本
# 用途：重新构建 Web 资源并打包最新 APK（含最新图标）
# 使用：在 Mac 上运行 ./refresh-android.sh
# 产物：项目根目录 ResearchFlash.apk
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目路径
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"
APK_OUTPUT="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APK_DEST="$PROJECT_DIR/ResearchFlash.apk"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ResearchFlash Android 打包工具           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# 检查 Java 环境（AGP 8.13 要求 JDK 17+，仅检查"是否存在"不够，必须校验版本）
AS_JDK="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

java_major() {
    # 解析主版本号：version "21.0.8" -> 21；"11.0.28" -> 11；"1.8.0" -> 1
    "$1" -version 2>&1 | head -1 | sed -E 's/.*version "([0-9]+).*/\1/'
}

JAVA_OK=false
if command -v java &> /dev/null && [ "$(java_major java)" -ge 17 ] 2>/dev/null; then
    JAVA_OK=true
    echo -e "${GREEN}✓ 使用系统 Java $(java_major java)${NC}"
fi

if [ "$JAVA_OK" = false ]; then
    if [ -x "$AS_JDK/bin/java" ] && [ "$(java_major "$AS_JDK/bin/java")" -ge 17 ] 2>/dev/null; then
        export JAVA_HOME="$AS_JDK"
        export PATH="$JAVA_HOME/bin:$PATH"
        echo -e "${GREEN}✓ 使用 Android Studio 自带 JDK $(java_major "$AS_JDK/bin/java")${NC}"
    else
        echo -e "${RED}✗ 错误：未找到 JDK 17+（AGP 8.13 要求）。请安装 Android Studio 或 JDK 17+${NC}"
        exit 1
    fi
fi

# 1. 构建 Web 资源（静态导出）
echo -e "${YELLOW}➤ 构建 Web 资源...${NC}"
cd "$PROJECT_DIR"
bash scripts/build-mobile.sh

# 2. 同步到 Android（拷贝 out/ 与原生资源）
echo -e "${YELLOW}➤ 同步资源到 Android...${NC}"
bunx cap sync android 2>&1 | tail -3
echo -e "${GREEN}✓ 资源同步完成${NC}"
echo ""

# 3. Gradle 打包
echo -e "${YELLOW}➤ 正在打包 APK...${NC}"
echo "  请稍候，这可能需要 1-3 分钟..."
cd "$ANDROID_DIR"
./gradlew assembleDebug 2>&1 | grep -E "(BUILD|error|FAILED)" | head -10

if [ ! -f "$APK_OUTPUT" ]; then
    echo -e "${RED}✗ 打包失败，未找到 APK 产物${NC}"
    exit 1
fi

# 4. 拷贝到项目根目录
cp "$APK_OUTPUT" "$APK_DEST"
APK_SIZE=$(du -h "$APK_DEST" | cut -f1)

# 5. 校验 APK 内图标是最新的（与仓库 res 对比）
ICON_NEW=$(md5 -q "$ANDROID_DIR/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png" 2>/dev/null || md5sum "$ANDROID_DIR/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png" | cut -d' ' -f1)
ICON_APK=$(unzip -p "$APK_DEST" "res/mipmap-xxxhdpi-v4/ic_launcher.png" 2>/dev/null | { md5 -q /dev/stdin 2>/dev/null || md5sum | cut -d' ' -f1; })

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            ✓ 打包完成！                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  APK 路径：${APK_DEST}"
echo -e "  APK 大小：${APK_SIZE}"
if [ -n "$ICON_APK" ] && [ "$ICON_NEW" = "$ICON_APK" ]; then
    echo -e "  图标校验：${GREEN}✓ APK 内图标与仓库最新图标一致${NC}"
else
    echo -e "  图标校验：${YELLOW}⚠ 无法确认图标一致性，请手动安装核对${NC}"
fi
echo ""
echo -e "${BLUE}下一步：上传到 GitHub Release${NC}"
echo -e "  替换现有版本：${YELLOW}gh release upload v0.2.2 ResearchFlash.apk --clobber${NC}"
echo -e "  或发布新版本：${YELLOW}gh release create v0.2.3 ResearchFlash.apk --title \"v0.2.3\" --notes \"修复 APK 图标\"${NC}"
echo ""
