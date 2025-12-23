'use client';

/**
 * 灵感卡片组件
 */

import { Flash } from '@/types/flash';

interface FlashCardProps {
  flash: Flash;
  onArchive?: (id: string) => void;
  showArchiveButton?: boolean;
}

export function FlashCard({ flash, onArchive, showArchiveButton = false }: FlashCardProps) {
  const statusColors = {
    incubating: 'bg-yellow-100 text-yellow-800',
    surfaced: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-600',
  };

  const statusLabels = {
    incubating: '孵化中',
    surfaced: '待回顾',
    archived: '已归档',
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const getISOString = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString();
  };

  return (
    <article
      className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm
                 hover:shadow-md transition-shadow duration-200"
      data-entity="flash"
      data-flash-id={flash.id}
    >
      {/* 内容 */}
      <p className="text-gray-800 whitespace-pre-wrap break-words">
        {flash.content}
      </p>

      {/* 底部信息栏 */}
      <div className="mt-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {/* 时间 */}
          <time
            dateTime={getISOString(flash.createdAt)}
            className="text-sm text-gray-400"
          >
            {formatDate(flash.createdAt)}
          </time>

          {/* 状态标签 */}
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${statusColors[flash.status]}`}
          >
            {statusLabels[flash.status]}
          </span>
        </div>

        {/* 归档按钮 */}
        {showArchiveButton && flash.status !== 'archived' && onArchive && (
          <button
            onClick={() => onArchive(flash.id)}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            归档
          </button>
        )}
      </div>
    </article>
  );
}
