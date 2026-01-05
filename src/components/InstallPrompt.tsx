'use client';

import { useState, useEffect } from 'react';
import { isNative } from '@/lib/api-config';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 如果是原生应用（Capacitor），不显示 PWA 安装提示
    if (isNative()) {
      return;
    }

    // 检查是否已经是 standalone 模式
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // 检查是否已关闭提示
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      return;
    }

    // 检查是否是 iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // 监听 beforeinstallprompt 事件（Android Chrome）
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // 如果是 iOS 且未安装，3秒后显示提示
    if (iOS && !standalone) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Install prompt outcome:', outcome);
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // 已安装或用户已关闭，不显示
  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-50">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-gray-800">安装 ResearchFlash</p>
          {isIOS ? (
            <p className="text-sm text-gray-500">
              点击 <span className="inline-block">⎋</span> 分享按钮，然后选择「添加到主屏幕」
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              添加到主屏幕，随时记录灵感
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            稍后
          </button>
          {!isIOS && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              安装
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
