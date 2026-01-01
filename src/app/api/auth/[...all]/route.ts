// app/api/auth/[...all]/route.ts
// @source: cog.md
// Better Auth API 路由处理

import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
