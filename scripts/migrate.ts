// scripts/migrate.ts
// 手动执行数据库迁移脚本

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// 手动加载 .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

async function migrate() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!);

  console.log('🗑️  删除旧表 posts...');
  try {
    await sql`DROP TABLE IF EXISTS posts CASCADE`;
    console.log('✓ posts 表已删除');
  } catch (err) {
    console.log('⚠️  posts 表不存在或已删除');
  }

  console.log('\n📦 创建新表...');

  // 按依赖顺序创建表
  // 1. users (无依赖)
  console.log('  创建 users 表...');
  await sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "email" text NOT NULL,
      "email_verified" boolean DEFAULT false NOT NULL,
      "image" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "users_email_unique" UNIQUE("email")
    )
  `;

  // 2. sessions (依赖 users)
  console.log('  创建 sessions 表...');
  await sql`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "token" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "ip_address" text,
      "user_agent" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "sessions_token_unique" UNIQUE("token")
    )
  `;

  // 3. accounts (依赖 users)
  console.log('  创建 accounts 表...');
  await sql`
    CREATE TABLE IF NOT EXISTS "accounts" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "account_id" text NOT NULL,
      "provider_id" text NOT NULL,
      "access_token" text,
      "refresh_token" text,
      "access_token_expires_at" timestamp with time zone,
      "refresh_token_expires_at" timestamp with time zone,
      "scope" text,
      "id_token" text,
      "password" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `;

  // 4. verifications (无依赖)
  console.log('  创建 verifications 表...');
  await sql`
    CREATE TABLE IF NOT EXISTS "verifications" (
      "id" text PRIMARY KEY NOT NULL,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `;

  // 5. devices (依赖 users)
  console.log('  创建 devices 表...');
  await sql`
    CREATE TABLE IF NOT EXISTS "devices" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text,
      "name" text,
      "last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `;

  // 6. flashes (依赖 devices, users)
  console.log('  创建 flashes 表...');
  await sql`
    CREATE TABLE IF NOT EXISTS "flashes" (
      "id" varchar(14) PRIMARY KEY NOT NULL,
      "content" varchar(280) NOT NULL,
      "status" varchar(20) DEFAULT 'incubating' NOT NULL,
      "device_id" text NOT NULL,
      "user_id" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "synced_at" timestamp with time zone,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "version" timestamp with time zone DEFAULT now() NOT NULL
    )
  `;

  console.log('\n🔗 添加外键约束...');

  // 外键约束
  try {
    await sql`ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action`;
  } catch (e) { console.log('  accounts_user_id_users_id_fk 已存在'); }

  try {
    await sql`ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action`;
  } catch (e) { console.log('  devices_user_id_users_id_fk 已存在'); }

  try {
    await sql`ALTER TABLE "flashes" ADD CONSTRAINT "flashes_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action`;
  } catch (e) { console.log('  flashes_device_id_devices_id_fk 已存在'); }

  try {
    await sql`ALTER TABLE "flashes" ADD CONSTRAINT "flashes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action`;
  } catch (e) { console.log('  flashes_user_id_users_id_fk 已存在'); }

  try {
    await sql`ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action`;
  } catch (e) { console.log('  sessions_user_id_users_id_fk 已存在'); }

  console.log('\n📇 创建索引...');

  try {
    await sql`CREATE INDEX IF NOT EXISTS "devices_user_id_idx" ON "devices" USING btree ("user_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "flashes_status_idx" ON "flashes" USING btree ("status")`;
    await sql`CREATE INDEX IF NOT EXISTS "flashes_device_id_idx" ON "flashes" USING btree ("device_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "flashes_user_id_idx" ON "flashes" USING btree ("user_id")`;
  } catch (e) { console.log('  部分索引已存在'); }

  console.log('\n✅ 数据库迁移完成！');

  // 验证表结构
  console.log('\n📋 验证表结构...');
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log('已创建的表:', tables.map((t: any) => t.table_name).join(', '));
}

migrate().catch(console.error);
