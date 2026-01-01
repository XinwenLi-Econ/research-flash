import type { NextConfig } from "next";
import * as dotenv from 'dotenv';
import * as path from 'path';

// 手动加载 .env.local（覆盖 shell 环境中可能存在的空值）
dotenv.config({
  path: path.resolve(process.cwd(), '.env.local'),
  override: true,
  quiet: true,
});

const nextConfig: NextConfig = {
  // 显式暴露服务端环境变量
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
};

export default nextConfig;
