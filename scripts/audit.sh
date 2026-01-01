#!/bin/bash
# 数据库审计脚本包装器
# 用法: ./scripts/audit.sh [users|sessions|devices|flashes|status]

cd "$(dirname "$0")/.."
unset http_proxy https_proxy all_proxy

# 加载环境变量（去除引号）
while IFS= read -r line; do
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  # 去除首尾引号
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  export "$key=$value"
done < .env.local

bun run scripts/db-audit.ts "${1:-status}"
