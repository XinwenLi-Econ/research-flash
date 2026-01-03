# ResearchFlash

A minimalist idea-capture app for researchers. Offline-first architecture ensures your fleeting thoughts are never lost.

## Features

- **Instant Capture** - Input box on first screen, no barriers
- **Offline-First** - Works without network, syncs when online
- **280 Character Limit** - Forces fragmented thinking, prevents perfectionism
- **Cross-Device Sync** - Login to merge ideas across devices
- **Idea Lifecycle** - `incubating` → `surfaced` → `archived` (one-way flow)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| State | Zustand |
| Offline Storage | IndexedDB (idb) |
| Database | PostgreSQL (Neon) |
| ORM | Drizzle |
| Auth | Better Auth |
| Styling | Tailwind CSS |

## Quick Start

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build
```

## Project Structure

```
src/
├── app/              # Next.js App Router + API routes
├── components/       # React components (FlashInput, FlashCard, FlashList)
├── hooks/            # Custom hooks (useFlash, useSync, useOffline)
├── lib/
│   ├── db/           # Drizzle schema & connection
│   └── offline/      # IndexedDB operations
├── services/         # Business logic
├── stores/           # Zustand global state
└── types/            # TypeScript definitions
```

## Architecture

### Data Flow

```
User Input → Zustand (optimistic update) → IndexedDB → Sync Queue → API → PostgreSQL
```

### Conflict Resolution

Uses Last-Write-Wins (LWW) strategy based on `version` timestamp for cross-device sync.

### Flash ID Format

`YYYYMMDDHHmmss` - Timestamp-based ID for natural ordering.

## Core Constraints

1. No login wall - capture first, authenticate later
2. Max 280 characters per flash
3. Must work offline in weak network environments
4. Weekly Sunday 8PM push notification for review

## Database Commands

```bash
bun run db:generate   # Generate Drizzle types
bun run db:migrate    # Run migrations
bun run db:push       # Push schema to database
bun run db:studio     # Open Drizzle Studio
```

## License

MIT
