// components/AuthButton.tsx
// @source: cog.md
// 认证按钮组件 - 支持登录/登出、验证状态显示和账户管理
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { sendVerificationEmail, changePassword } from '@/lib/auth-client';

export function AuthButton() {
  const { user, isAuthenticated, isLoading, signIn, signUp, signOut, deviceId, linkDevice } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="text-gray-400 text-sm animate-pulse">
        加载中...
      </div>
    );
  }

  if (isAuthenticated && user) {
    const isVerified = user.emailVerified;

    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
          <span className="font-medium">{user.name || user.email}</span>
          {!isVerified && (
            <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
              未验证
            </span>
          )}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-800 truncate">{user.email}</p>
              <p className="text-xs text-gray-500">
                {isVerified ? '邮箱已验证' : '邮箱未验证'}
              </p>
            </div>

            {!isVerified && (
              <button
                onClick={async () => {
                  try {
                    await sendVerificationEmail({ email: user.email });
                    alert('验证邮件已发送，请检查邮箱');
                  } catch {
                    alert('发送失败，请稍后重试');
                  }
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                重新发送验证邮件
              </button>
            )}

            <button
              onClick={() => {
                setShowPasswordModal(true);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              修改密码
            </button>

            {isVerified && (
              <button
                onClick={() => {
                  router.push('/auth/forgot-password');
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                忘记密码
              </button>
            )}

            <hr className="my-1" />

            <button
              onClick={() => {
                signOut();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
            >
              退出登录
            </button>
          </div>
        )}

        {showPasswordModal && (
          <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-3 py-2 -mr-3 text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer select-none active:bg-blue-50 rounded-lg transition-colors"
      >
        登录 / 注册
      </button>

      {showModal && (
        <AuthModal
          onClose={() => setShowModal(false)}
          onSuccess={async () => {
            setShowModal(false);
            // 登录成功后关联设备
            if (deviceId) {
              await linkDevice(deviceId);
            }
          }}
        />
      )}
    </>
  );
}

// 修改密码弹窗
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (newPassword.length < 8) {
      setError('新密码至少需要 8 个字符');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true, // 修改密码后登出其他设备
      });

      if (result.error) {
        setError(result.error.message || '修改失败');
      } else {
        setSuccess(true);
        setTimeout(onClose, 2000);
      }
    } catch {
      setError('修改失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">修改密码</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-800">密码修改成功！</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="至少 8 位"
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="再次输入新密码"
                minLength={8}
                required
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '修改中...' : '确认修改'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const result = await signIn.email({
          email,
          password,
        });

        if (result.error) {
          const msg = result.error.message || '登录失败';
          if (msg.includes('credentials') || msg.includes('password')) {
            setError('邮箱或密码错误');
          } else if (msg.includes('not found') || msg.includes('user')) {
            setError('该邮箱尚未注册');
          } else {
            setError(msg);
          }
          return;
        }
      } else {
        const result = await signUp.email({
          email,
          password,
          name,
        });

        if (result.error) {
          const msg = result.error.message || '注册失败';
          if (msg.includes('exists') || msg.includes('duplicate')) {
            setError('该邮箱已被注册，请直接登录');
          } else if (msg.includes('password')) {
            setError('密码格式不正确，请使用至少 8 位密码');
          } else {
            setError(msg);
          }
          return;
        }
      }

      onSuccess();
    } catch (err) {
      console.error('[Auth] 操作失败:', err);
      const msg = err instanceof Error ? err.message : String(err);
      // 显示详细错误信息以便调试
      const debugInfo = `[调试] ${msg || '未知错误'}`;
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
        setError(`网络连接失败: ${debugInfo}`);
      } else if (msg.includes('timeout')) {
        setError(`请求超时: ${debugInfo}`);
      } else {
        setError(`操作失败: ${debugInfo}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGitHubLogin = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      await signIn.social({
        provider: 'github',
        callbackURL: window.location.origin,
      });
    } catch {
      setError('GitHub 登录失败');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {mode === 'login' ? '登录账户' : '创建账户'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                名称
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="你的名称"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              邮箱
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="至少 8 位"
              minLength={8}
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push('/auth/forgot-password');
              }}
              className="text-sm text-gray-500 hover:text-blue-600"
            >
              忘记密码？
            </button>
          </div>
        )}

        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">或</span>
            </div>
          </div>

          <button
            onClick={handleGitHubLogin}
            disabled={isSubmitting}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            GitHub 登录
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          {mode === 'login' ? (
            <>
              还没有账户？{' '}
              <button
                onClick={() => setMode('signup')}
                className="text-blue-600 hover:underline"
              >
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账户？{' '}
              <button
                onClick={() => setMode('login')}
                className="text-blue-600 hover:underline"
              >
                立即登录
              </button>
            </>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500 text-center">
          登录后可跨设备同步灵感数据
        </p>
      </div>
    </div>
  );
}
