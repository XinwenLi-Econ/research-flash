// components/FlashInput.tsx
// @source: real.md R1, R2
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { CharCounter } from './CharCounter';
import { useFlash } from '@/hooks/useFlash';
import { useOffline } from '@/hooks/useOffline';

const MAX_LENGTH = 280; // @R2

export function FlashInput() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { createFlash } = useFlash();
  const { isOffline } = useOffline();

  // @R1: 首屏自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || content.length > MAX_LENGTH) return;

    setIsSaving(true);
    try {
      await createFlash({ content: content.trim() });
      setContent('');
      // 保存成功反馈（< 300ms）
    } catch (error) {
      console.error('保存灵感失败:', error);
    } finally {
      setIsSaving(false);
    }
  }, [content, createFlash]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter 或 Cmd+Enter 提交
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isOverLimit = content.length > MAX_LENGTH;
  const canSubmit = content.trim().length > 0 && !isOverLimit && !isSaving;

  return (
    <div className="w-full max-w-md mx-auto p-4">
      {isOffline && (
        <div className="mb-2 text-sm text-amber-600">
          离线模式 - 灵感将在网络恢复后同步
        </div>
      )}
      <textarea
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="捕捉你的灵感..."
        className="w-full h-32 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
        disabled={isSaving}
      />
      <div className="flex justify-between items-center mt-2">
        <CharCounter current={content.length} max={MAX_LENGTH} />
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
      {isOverLimit && (
        <div className="mt-1 text-sm text-red-500">
          请精简至280字内 {/* @R2 */}
        </div>
      )}
    </div>
  );
}
