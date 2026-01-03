'use client';

/**
 * ResearchFlash 首页
 * 符合 real.md 约束：首屏直接展示输入框 @R1
 */

import { useState } from 'react';
import { FlashInput } from '@/components/FlashInput';
import { FlashList } from '@/components/FlashList';
import { useFlash } from '@/hooks/useFlash';
import { useSync } from '@/hooks/useSync';

export default function Home() {
  const { flashes, isLoading, archiveFlash, getIncubating, getSurfaced, getArchived } = useFlash();
  const [activeTab, setActiveTab] = useState<'incubating' | 'surfaced' | 'archived'>('incubating');

  // 初始化同步
  useSync();

  // 过滤灵感
  const filteredFlashes =
    activeTab === 'incubating' ? getIncubating() :
    activeTab === 'surfaced' ? getSurfaced() :
    getArchived();

  // 统计数量
  const counts = {
    incubating: getIncubating().length,
    surfaced: getSurfaced().length,
    archived: getArchived().length,
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      {/* 头部 */}
      <header className="max-w-2xl mx-auto mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">
          ResearchFlash
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          你的第二海马体：零摩擦捕捉，算法化重现
        </p>
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
        </div>
      </div>

      {/* 灵感列表 */}
      <section className="max-w-2xl mx-auto">
        <FlashList
          flashes={filteredFlashes}
          onArchive={archiveFlash}
          showArchiveButton={activeTab === 'surfaced'}
          emptyMessage={
            activeTab === 'incubating'
              ? '还没有灵感，记录第一个吧！'
              : activeTab === 'surfaced'
              ? '暂无待回顾的灵感'
              : '暂无已归档的灵感'
          }
        />
      </section>

      {/* 底部提示 */}
      <footer className="max-w-2xl mx-auto mt-12 text-center text-sm text-gray-400">
        <p>灵感会在 7 天后自动进入「待回顾」状态</p>
        <p className="mt-1">每周日晚 8 点推送本周灵感回顾</p>
      </footer>
    </main>
  );
}

// 标签按钮组件
function TabButton({
  children,
  active,
  onClick,
  count,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors
                  ${active
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
    >
      {children}
      {count > 0 && (
        <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full
                         ${active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}
