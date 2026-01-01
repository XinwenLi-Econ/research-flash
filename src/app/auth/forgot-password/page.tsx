// app/auth/forgot-password/page.tsx
// 忘记密码页面 - 请求密码重置
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      // 直接调用 API
      const response = await fetch('/api/auth/forget-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: '/auth/reset-password' }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setStatus('error');
        setMessage(result.error?.message || result.message || '发送失败');
      } else {
        setStatus('success');
        setMessage('重置链接已发送到你的邮箱');
      }
    } catch {
      setStatus('error');
      setMessage('请求失败，请稍后重试');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">忘记密码</h1>
        <p className="text-gray-600 mb-6">
          输入你的注册邮箱，我们将发送密码重置链接
        </p>

        {status === 'success' ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-800 mb-4">{message}</p>
            <p className="text-sm text-gray-500 mb-4">
              请检查你的邮箱（包括垃圾邮件文件夹）
            </p>
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:underline"
            >
              返回首页
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                邮箱地址
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com"
                required
              />
            </div>

            {status === 'error' && (
              <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? '发送中...' : '发送重置链接'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="text-sm text-gray-600 hover:underline"
              >
                返回登录
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-xs text-gray-500 text-center">
          注意：只有已验证邮箱的用户才能重置密码
        </p>
      </div>
    </main>
  );
}
