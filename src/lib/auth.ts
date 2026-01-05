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

// 获取应用 URL：优先使用 BETTER_AUTH_URL（运行时），然后 NEXT_PUBLIC_APP_URL，最后回退到 localhost
const appUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// 构建受信任的 origins 列表
const trustedOriginsList = [
  appUrl,
  'https://flash.xinwen-li.com',  // 生产域名
  'https://research-flash.vercel.app',  // Vercel 默认域名
  'capacitor://localhost',  // iOS Capacitor WebView
  'http://localhost',  // Android Capacitor WebView
].filter((url, index, arr) => arr.indexOf(url) === index); // 去重

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
    requireEmailVerification: false, // 不强制验证，采用渐进式验证
    sendResetPassword: async ({ user, url }) => {
      console.log('[Auth] Sending password reset email to:', user.email);
      await sendPasswordResetEmail(user.email, url, user.name);
    },
  },

  // 邮箱验证配置
  emailVerification: {
    sendOnSignUp: true, // 注册时自动发送
    autoSignInAfterVerification: true, // 验证后自动登录
    sendVerificationEmail: async ({ user, url }) => {
      console.log('[Auth] sendVerificationEmail triggered for:', user.email);
      console.log('[Auth] Verification URL:', url);
      const result = await sendVerificationEmail(user.email, url, user.name);
      console.log('[Auth] Email send result:', result);
      if (!result.success) {
        throw new Error(result.error || 'Failed to send verification email');
      }
    },
  },

  // 数据库钩子 - 用户创建后发送验证邮件（作为 sendOnSignUp 的备用方案）
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          console.log('[Auth Hook] User created:', user.id, user.email);
          // 如果 sendOnSignUp 没有触发，这里会作为备用
          // 注意：这里不直接发送邮件，因为 sendVerificationEmail 需要验证 URL
          // Better Auth 应该已经通过 emailVerification.sendVerificationEmail 发送了
        },
      },
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

  // Cookie 配置 - 支持 Capacitor WebView 跨域
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
    },
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
    },
  },

  // 信任的请求来源
  trustedOrigins: trustedOriginsList,

  // 基础 URL 配置
  baseURL: appUrl,
});

export type Auth = typeof auth;
