// lib/email.ts
// @source: cog.md
// 邮件发送服务

import { Resend } from 'resend';

// 延迟初始化 Resend 客户端
let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * 发送邮箱验证邮件
 */
export async function sendVerificationEmail(
  to: string,
  verificationUrl: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();

  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set, skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'ResearchFlash <noreply@resend.dev>',
      to,
      subject: '验证你的 ResearchFlash 邮箱',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">验证你的邮箱</h1>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            ${userName ? `你好 ${userName}，` : '你好，'}
          </p>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            感谢注册 ResearchFlash！请点击下方按钮验证你的邮箱地址：
          </p>
          <div style="margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background-color: #3b82f6; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: 500;
                      display: inline-block;">
              验证邮箱
            </a>
          </div>
          <p style="color: #6a6a6a; font-size: 14px;">
            如果按钮无法点击，请复制以下链接到浏览器：
          </p>
          <p style="color: #3b82f6; font-size: 14px; word-break: break-all;">
            ${verificationUrl}
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
          <p style="color: #9a9a9a; font-size: 12px;">
            此链接 24 小时内有效。如果你没有注册 ResearchFlash，请忽略此邮件。
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Send failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[Email] Send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * 发送密码重置邮件
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();

  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set, skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'ResearchFlash <noreply@resend.dev>',
      to,
      subject: '重置你的 ResearchFlash 密码',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">重置密码</h1>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            ${userName ? `你好 ${userName}，` : '你好，'}
          </p>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            我们收到了重置你 ResearchFlash 账户密码的请求。点击下方按钮设置新密码：
          </p>
          <div style="margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #3b82f6; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: 500;
                      display: inline-block;">
              重置密码
            </a>
          </div>
          <p style="color: #6a6a6a; font-size: 14px;">
            如果按钮无法点击，请复制以下链接到浏览器：
          </p>
          <p style="color: #3b82f6; font-size: 14px; word-break: break-all;">
            ${resetUrl}
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
          <p style="color: #9a9a9a; font-size: 12px;">
            此链接 1 小时内有效。如果你没有请求重置密码，请忽略此邮件。
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Send failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[Email] Send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}
