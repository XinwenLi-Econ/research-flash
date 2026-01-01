// lib/auth.ts
// @source: cog.md
// Better Auth 服务端配置

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './db/schema';
import { sendVerificationEmail, sendPasswordResetEmail } from './email';

// 为 Better Auth 创建专用的数据库连接
function createAuthDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('[AUTH] DATABASE_URL not set, auth features will not work');
    return null;
  }

  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

const authDb = createAuthDb();
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const auth = betterAuth({
  database: authDb ? drizzleAdapter(authDb, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }) : undefined as never,

  // 邮箱密码登录
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // 邮箱验证配置
    requireEmailVerification: false, // 不强制验证，采用渐进式验证
    sendVerificationEmail: true, // 注册后自动发送验证邮件
    sendResetPassword: async ({ user, url }) => {
      // 密码重置邮件
      await sendPasswordResetEmail(user.email, url, user.name);
    },
  },

  // 邮箱验证配置
  emailVerification: {
    sendOnSignUp: true, // 注册时自动发送
    autoSignInAfterVerification: true, // 验证后自动登录
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url, user.name);
    },
  },

  // GitHub OAuth
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },
  },

  // Session 配置
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 天
    updateAge: 60 * 60 * 24, // 每天更新
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 分钟缓存
    },
  },

  // 信任代理（用于获取正确的 IP 地址）
  trustedOrigins: [appUrl],

  // 基础 URL 配置
  baseURL: appUrl,
});

export type Auth = typeof auth;
