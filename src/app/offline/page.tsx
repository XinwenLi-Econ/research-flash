'use client';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="text-center">
        <div className="text-6xl mb-4">📴</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          暂时离线
        </h1>
        <p className="text-gray-500 mb-6">
          请检查网络连接后重试
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          重新加载
        </button>
      </div>
    </main>
  );
}
