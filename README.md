# Codenames

> Codenames is a word association game for two teams, each led by a spymaster. The spymasters give one-word clues and a number, guiding their teammates to guess specific words from a shared grid. Teams aim to identify their own words while avoiding the opponent's, neutral words, and the deadly assassin word, which ends the game immediately if guessed. The first team to identify all their words wins.

## Development Setup

### Prerequisites
- Node.js 22+
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Lint all packages
pnpm lint
```

### Running Locally

**Frontend:**
```bash
cd packages/web
pnpm dev
# Visit http://localhost:3000
```

**Backend:**
```bash
cd packages/api
pnpm dev
# WebSocket server at ws://localhost:8787
```

### Environment Variables

Copy `packages/web/.env.example` to `packages/web/.env.local` and configure:
- `NEXT_PUBLIC_API_URL`: WebSocket API URL (default: ws://localhost:8787 for dev)

## Architecture

This is a monorepo with 5 packages:
- **api**: Cloudflare Workers backend with Durable Objects for game state
- **web**: Next.js 15 frontend with React 19
- **game**: Core game logic (Codenames class)
- **schema**: Zod schemas for type-safe communication
- **words**: Word lists and utilities

## Deployment

Deployment happens automatically via CI/CD on push to main branch.

**Manual deployment:**
```bash
# API
cd packages/api && pnpm deploy

# Web
cd packages/web && pnpm build && pnpm deploy
```

See [IMPROVEMENTS.md](./IMPROVEMENTS.md) for current development roadmap.
