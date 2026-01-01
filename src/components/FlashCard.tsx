'use client';

/**
 * 灵感卡片组件
 * 支持编辑（仅 incubating 状态）
 */

import { useState, useRef, useEffect } from 'react';
import { Flash, MAX_CONTENT_LENGTH } from '@/types/flash';

interface FlashCardProps {
  flash: Flash;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onEdit?: (id: string, content: string) => void;
  showArchiveButton?: boolean;
  showDeleteButton?: boolean;
  isTrashView?: boolean;
}

export function FlashCard({
  flash,
  onArchive,
  onDelete,
  onRestore,
  onPermanentDelete,
  onEdit,
  showArchiveButton = false,
  showDeleteButton = true,
  isTrashView = false,
}: FlashCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(flash.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 是否可编辑（仅 incubating 状态）
  const canEdit = flash.status === 'incubating' && onEdit && !isTrashView;

  // 进入编辑模式时聚焦并调整高度
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
      adjustTextareaHeight();
    }
  }, [isEditing]);

  // 自动调整 textarea 高度
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // 保存编辑
  const handleSave = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== flash.content && onEdit) {
      onEdit(flash.id, trimmed);
    }
    setIsEditing(false);
  };

  // 取消编辑
  const handleCancel = () => {
    setEditContent(flash.content);
    setIsEditing(false);
  };

  // 键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.metaKey) {
      // Cmd+Enter 保存
      handleSave();
    }
  };

  const statusColors: Record<string, string> = {
    incubating: 'bg-yellow-100 text-yellow-800',
    surfaced: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-600',
    deleted: 'bg-red-100 text-red-600',
  };

  const statusLabels: Record<string, string> = {
    incubating: '孵化中',
    surfaced: '待回顾',
    archived: '已归档',
    deleted: '已删除',
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
      {/* 内容区域 */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => {
              setEditContent(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            maxLength={MAX_CONTENT_LENGTH}
            className="w-full p-2 text-gray-800 border border-blue-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {editContent.length}/{MAX_CONTENT_LENGTH}
              <span className="ml-2 text-gray-300">Cmd+Enter 保存 | Esc 取消</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!editContent.trim() || editContent.trim() === flash.content}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p
          onClick={() => canEdit && setIsEditing(true)}
          className={`text-gray-800 whitespace-pre-wrap break-words ${
            canEdit ? 'cursor-text hover:bg-gray-50 -m-1 p-1 rounded transition-colors' : ''
          }`}
          title={canEdit ? '点击编辑' : undefined}
        >
          {flash.content}
        </p>
      )}

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

          {/* 可编辑提示 */}
          {canEdit && !isEditing && (
            <span className="text-xs text-gray-300">可编辑</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 编辑按钮（孵化中状态显示） */}
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-gray-400 hover:text-blue-500 transition-colors"
              title="编辑"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}

          {/* 归档按钮 */}
          {showArchiveButton && flash.status !== 'archived' && flash.status !== 'deleted' && onArchive && !isEditing && (
            <button
              onClick={() => onArchive(flash.id)}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              归档
            </button>
          )}

          {/* 回收站视图：恢复和永久删除按钮 */}
          {isTrashView && flash.status === 'deleted' && (
            <div className="flex items-center gap-3">
              {onRestore && (
                <button
                  onClick={() => onRestore(flash.id)}
                  className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
                >
                  恢复
                </button>
              )}
              {onPermanentDelete && (
                <button
                  onClick={() => {
                    if (confirm('确定永久删除这条灵感吗？此操作不可恢复。')) {
                      onPermanentDelete(flash.id);
                    }
                  }}
                  className="text-sm text-red-400 hover:text-red-600 transition-colors"
                >
                  永久删除
                </button>
              )}
            </div>
          )}

          {/* 普通视图：删除按钮 */}
          {!isTrashView && showDeleteButton && flash.status !== 'deleted' && onDelete && !isEditing && (
            <button
              onClick={() => onDelete(flash.id)}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors"
              title="删除"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
