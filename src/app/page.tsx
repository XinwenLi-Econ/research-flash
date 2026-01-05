'use client';

/**
 * ResearchFlash 首页
 * 符合 real.md 约束：首屏直接展示输入框 @R1
 */

import { useState, useCallback, useEffect } from 'react';
import { FlashInput } from '@/components/FlashInput';
import { FlashList } from '@/components/FlashList';
import { AuthButton } from '@/components/AuthButton';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { useFlash } from '@/hooks/useFlash';
import { useSync } from '@/hooks/useSync';
import type { Flash } from '@/types/flash';

// 撤销提示组件
function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 text-white rounded-lg shadow-lg">
        <span className="text-sm">{message}</span>
        <button
          onClick={onUndo}
          className="px-3 py-1 text-sm font-medium bg-white text-gray-800 rounded hover:bg-gray-100 transition-colors"
        >
          撤销
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const {
    isLoading,
    archiveFlash,
    deleteFlash,
    restoreFlash,
    permanentDeleteFlash,
    updateFlashContent,
    getIncubating,
    getSurfaced,
    getArchived,
    getDeleted,
  } = useFlash();

  const [activeTab, setActiveTab] = useState<'incubating' | 'surfaced' | 'archived' | 'deleted'>('incubating');
  const [undoState, setUndoState] = useState<{
    flash: Flash;
    show: boolean;
  } | null>(null);

  // 初始化同步
  useSync();

  // 处理删除（带撤销）
  const handleDelete = useCallback(async (id: string) => {
    const deletedFlash = await deleteFlash(id);
    if (deletedFlash) {
      setUndoState({ flash: deletedFlash, show: true });
    }
  }, [deleteFlash]);

  // 撤销删除
  const handleUndo = useCallback(async () => {
    if (undoState?.flash) {
      await restoreFlash(undoState.flash.id);
      setUndoState(null);
    }
  }, [undoState, restoreFlash]);

  // 关闭撤销提示
  const dismissUndo = useCallback(() => {
    setUndoState(null);
  }, []);

  // 过滤灵感
  const filteredFlashes =
    activeTab === 'incubating' ? getIncubating() :
    activeTab === 'surfaced' ? getSurfaced() :
    activeTab === 'archived' ? getArchived() :
    getDeleted();

  // 统计数量
  const counts = {
    incubating: getIncubating().length,
    surfaced: getSurfaced().length,
    archived: getArchived().length,
    deleted: getDeleted().length,
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </main>
    );
  }

  return (
    <>
      {/* 邮箱验证提示条 */}
      <EmailVerificationBanner />

      <main className="min-h-screen pt-[max(2rem,env(safe-area-inset-top))] pb-8 px-4">
        {/* 头部 */}
        <header className="max-w-2xl mx-auto mb-8">
        <div className="flex justify-end mb-4">
          <AuthButton />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">
            ResearchFlash
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            捕捉灵感，让它在对的时候回来
          </p>
        </div>
      </header>

      {/* 输入区域 - 首屏核心 @R1 */}
      <section className="mb-8">
        <FlashInput />
      </section>

      {/* 标签切换 */}
      <div className="max-w-2xl mx-auto mb-4">
        <div className="flex gap-2 border-b border-gray-200">
          <TabButton
            active={activeTab === 'incubating'}
            onClick={() => setActiveTab('incubating')}
            count={counts.incubating}
          >
            孵化中
          </TabButton>
          <TabButton
            active={activeTab === 'surfaced'}
            onClick={() => setActiveTab('surfaced')}
            count={counts.surfaced}
          >
            待回顾
          </TabButton>
          <TabButton
            active={activeTab === 'archived'}
            onClick={() => setActiveTab('archived')}
            count={counts.archived}
          >
            已归档
          </TabButton>
          <TabButton
            active={activeTab === 'deleted'}
            onClick={() => setActiveTab('deleted')}
            count={counts.deleted}
            variant="danger"
          >
            回收站
          </TabButton>
        </div>
      </div>

      {/* 灵感列表 */}
      <section className="max-w-2xl mx-auto">
        <FlashList
          flashes={filteredFlashes}
          onArchive={archiveFlash}
          onDelete={handleDelete}
          onRestore={restoreFlash}
          onPermanentDelete={permanentDeleteFlash}
          onEdit={updateFlashContent}
          showArchiveButton={activeTab === 'surfaced'}
          showDeleteButton={activeTab !== 'deleted'}
          isTrashView={activeTab === 'deleted'}
          emptyMessage={
            activeTab === 'incubating'
              ? '还没有灵感，记录第一个吧！'
              : activeTab === 'surfaced'
              ? '暂无待回顾的灵感'
              : activeTab === 'archived'
              ? '暂无已归档的灵感'
              : '回收站是空的'
          }
        />
      </section>

      {/* 底部提示 */}
      <footer className="max-w-2xl mx-auto mt-12 text-center text-sm text-gray-400">
        <p>灵感会在 7 天后自动进入「待回顾」状态</p>
        <p className="mt-1">每周日晚 8 点推送本周灵感回顾</p>
      </footer>
    </main>

    {/* 撤销提示 */}
    {undoState?.show && (
      <UndoToast
        message="灵感已移至回收站"
        onUndo={handleUndo}
        onDismiss={dismissUndo}
      />
    )}
    </>
  );
}

// 标签按钮组件
function TabButton({
  children,
  active,
  onClick,
  count,
  variant = 'default',
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count: number;
  variant?: 'default' | 'danger';
}) {
  const baseStyles = 'px-4 py-2 text-sm font-medium transition-colors';
  const activeStyles = variant === 'danger'
    ? 'text-red-600 border-b-2 border-red-600'
    : 'text-blue-600 border-b-2 border-blue-600';
  const inactiveStyles = variant === 'danger'
    ? 'text-gray-400 hover:text-red-500'
    : 'text-gray-500 hover:text-gray-700';
  const badgeActiveStyles = variant === 'danger'
    ? 'bg-red-100 text-red-600'
    : 'bg-blue-100 text-blue-600';

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${active ? activeStyles : inactiveStyles}`}
    >
      {children}
      {count > 0 && (
        <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full
                         ${active ? badgeActiveStyles : 'bg-gray-100 text-gray-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}
