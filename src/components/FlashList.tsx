'use client';

/**
 * 灵感列表组件
 */

import { Flash } from '@/types/flash';
import { FlashCard } from './FlashCard';

interface FlashListProps {
  flashes: Flash[];
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onEdit?: (id: string, content: string) => void;
  showArchiveButton?: boolean;
  showDeleteButton?: boolean;
  isTrashView?: boolean;
  emptyMessage?: string;
}

export function FlashList({
  flashes,
  onArchive,
  onDelete,
  onRestore,
  onPermanentDelete,
  onEdit,
  showArchiveButton = false,
  showDeleteButton = true,
  isTrashView = false,
  emptyMessage = '还没有灵感，记录第一个吧！',
}: FlashListProps) {
  if (flashes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flashes.map((flash) => (
        <FlashCard
          key={flash.id}
          flash={flash}
          onArchive={onArchive}
          onDelete={onDelete}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
          onEdit={onEdit}
          showArchiveButton={showArchiveButton}
          showDeleteButton={showDeleteButton}
          isTrashView={isTrashView}
        />
      ))}
    </div>
  );
}
