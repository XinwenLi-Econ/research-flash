// components/EmailVerificationBanner.tsx
// 邮箱验证提示条 - 未验证用户显示黄色警告
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { sendVerificationEmail } from '@/lib/auth-client';

export function EmailVerificationBanner() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // 不显示条件：加载中、未登录、已验证、已关闭
  if (isLoading || !isAuthenticated || !user || user.emailVerified || dismissed) {
    return null;
  }

  const handleSendEmail = async () => {
    if (isSending) return;

    setIsSending(true);
    try {
      await sendVerificationEmail({ email: user.email });
      setSent(true);
      // 3秒后恢复按钮
      setTimeout(() => setSent(false), 3000);
    } catch {
      alert('发送失败，请稍后重试');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* 警告图标 */}
            <svg
              className="w-5 h-5 text-amber-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>

            <div className="text-sm">
              <span className="text-amber-800 font-medium">
                请验证您的邮箱
              </span>
              <span className="text-amber-700 ml-1">
                — 验证后可使用「忘记密码」功能找回账户
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 发送验证邮件按钮 */}
            <button
              onClick={handleSendEmail}
              disabled={isSending || sent}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                sent
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50'
              }`}
            >
              {isSending ? '发送中...' : sent ? '已发送' : '发送验证邮件'}
            </button>

            {/* 关闭按钮 */}
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-amber-600 hover:text-amber-800 rounded"
              title="暂时关闭"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
