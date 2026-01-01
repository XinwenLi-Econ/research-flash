// scripts/db-audit.ts
// 数据库审计脚本 - 用于验证端到端流程
// 使用: bun run --env-file=.env.local scripts/db-audit.ts [command]

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users, sessions, accounts, devices, flashes } from '../src/lib/db/schema';
import { desc } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const command = process.argv[2] || 'status';

async function main() {
  switch (command) {
    case 'users':
      console.log('\n📋 用户表 (users):');
      const userList = await db.select().from(users).orderBy(desc(users.createdAt)).limit(10);
      console.table(userList.map(u => ({
        id: u.id.slice(0, 8) + '...',
        name: u.name,
        email: u.email,
        verified: u.emailVerified,
        createdAt: u.createdAt?.toISOString().slice(0, 19),
      })));
      console.log(`共 ${userList.length} 条记录`);
      break;

    case 'sessions':
      console.log('\n🔐 会话表 (sessions):');
      const sessionList = await db.select().from(sessions).orderBy(desc(sessions.createdAt)).limit(10);
      console.table(sessionList.map(s => ({
        id: s.id.slice(0, 8) + '...',
        userId: s.userId.slice(0, 8) + '...',
        expiresAt: s.expiresAt?.toISOString().slice(0, 19),
        ipAddress: s.ipAddress,
      })));
      console.log(`共 ${sessionList.length} 条记录`);
      break;

    case 'accounts':
      console.log('\n🔑 账户表 (accounts):');
      const accountList = await db.select().from(accounts).orderBy(desc(accounts.createdAt)).limit(10);
      console.table(accountList.map(a => ({
        id: a.id.slice(0, 8) + '...',
        userId: a.userId.slice(0, 8) + '...',
        provider: a.providerId,
        accountId: a.accountId.slice(0, 15) + '...',
      })));
      console.log(`共 ${accountList.length} 条记录`);
      break;

    case 'devices':
      console.log('\n📱 设备表 (devices):');
      const deviceList = await db.select().from(devices).orderBy(desc(devices.createdAt)).limit(10);
      console.table(deviceList.map(d => ({
        id: d.id.slice(0, 8) + '...',
        userId: d.userId ? d.userId.slice(0, 8) + '...' : '(未关联)',
        name: d.name || '(未命名)',
        lastActive: d.lastActiveAt?.toISOString().slice(0, 19),
      })));
      console.log(`共 ${deviceList.length} 条记录`);
      break;

    case 'flashes':
      console.log('\n💡 灵感表 (flashes):');
      const flashList = await db.select().from(flashes).orderBy(desc(flashes.createdAt)).limit(10);
      console.table(flashList.map(f => ({
        id: f.id,
        content: f.content.slice(0, 30) + (f.content.length > 30 ? '...' : ''),
        status: f.status,
        deviceId: f.deviceId.slice(0, 8) + '...',
        userId: f.userId ? f.userId.slice(0, 8) + '...' : '(匿名)',
        synced: f.syncedAt ? '✓' : '✗',
      })));
      console.log(`共 ${flashList.length} 条记录`);
      break;

    case 'status':
    default:
      console.log('\n📊 数据库状态概览:');
      const [userCount] = await db.select().from(users);
      const [sessionCount] = await db.select().from(sessions);
      const [deviceCount] = await db.select().from(devices);
      const [flashCount] = await db.select().from(flashes);

      const allUsers = await db.select().from(users);
      const allSessions = await db.select().from(sessions);
      const allDevices = await db.select().from(devices);
      const allFlashes = await db.select().from(flashes);

      console.table({
        users: { count: allUsers.length },
        sessions: { count: allSessions.length },
        devices: { count: allDevices.length },
        flashes: { count: allFlashes.length },
      });
      break;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('数据库查询失败:', err);
    process.exit(1);
  });
