// app/auth/verify/page.tsx
// 邮箱验证结果页面
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api-config';

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('验证链接无效');
      return;
    }

    // 调用验证 API
    const verifyEmail = async () => {
      try {
        const response = await fetch(apiUrl(`/api/auth/verify-email?token=${encodeURIComponent(token)}`));
        const result = await response.json();

        if (!response.ok || result.error) {
          setStatus('error');
          setMessage(result.error?.message || result.message || '验证失败');
        } else {
          setStatus('success');
          setMessage('邮箱验证成功！');
          // 3秒后跳转首页
          setTimeout(() => router.push('/'), 3000);
        }
      } catch {
        setStatus('error');
        setMessage('验证过程出错，请稍后重试');
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-800">正在验证...</h1>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-800 mb-2">{message}</h1>
            <p className="text-gray-600 mb-4">你现在可以使用密码重置功能了</p>
            <p className="text-sm text-gray-500">3 秒后自动跳转首页...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-800 mb-2">验证失败</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:underline"
            >
              返回首页
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </main>
    }>
      <VerifyContent />
    </Suspense>
  );
}
