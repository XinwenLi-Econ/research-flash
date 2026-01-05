// middleware.ts
// CORS 中间件 - 支持 Capacitor 原生应用跨域请求

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 允许的 origins 列表
const allowedOrigins = [
  'https://flash.xinwen-li.com',
  'https://research-flash.vercel.app',
  'capacitor://localhost',  // iOS Capacitor WebView
  'http://localhost',       // Android Capacitor WebView
  'http://localhost:3000',  // 本地开发
];

export function middleware(request: NextRequest) {
  // 只处理 API 路由
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin');
  const response = NextResponse.next();

  // 检查 origin 是否在允许列表中，或者 origin 为 null（Capacitor 可能发送 null origin）
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (!origin || origin === 'null') {
    // Capacitor 原生应用可能没有 origin 或 origin 为 'null'
    response.headers.set('Access-Control-Allow-Origin', 'capacitor://localhost');
  }

  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cookie');

  // 处理 preflight 请求
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: response.headers,
    });
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
