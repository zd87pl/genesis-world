# Genesis World

AI-Orchestrated Virtual World Platform - A browser-based virtual world where users explore procedurally generated 3D environments, interact with intelligent NPCs through voice and text, and share experiences with other players in real-time.

## Features

- **3D World Rendering**: WebGPU/WebGL rendering with Gaussian Splatting support
- **AI NPCs**: Intelligent NPCs powered by Claude AI with distinct personalities
- **Multiplayer**: Real-time state synchronization using CRDTs (Yjs)
- **Procedural Generation**: AI Game Master dynamically expands the world
- **Voice Interaction**: Voice conversations with NPCs (Deepgram + ElevenLabs)

## Tech Stack

### Frontend
- Vanilla TypeScript + Vite
- Three.js with WebGPU renderer
- Gaussian Splats 3D
- Yjs for CRDT state sync
- Socket.io client

### Backend
- Node.js + Fastify
- Socket.io for real-time communication
- PostgreSQL + Drizzle ORM
- Redis + BullMQ for job queues
- Claude API for AI orchestration

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for local development databases)

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Start local databases
docker compose up -d

# Run database migrations
pnpm db:push

# Start development servers
pnpm dev
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# AI Services (required for full functionality)
ANTHROPIC_API_KEY=sk-...        # Claude API for Game Master
INWORLD_API_KEY=...             # Inworld AI for NPCs (optional)
DEEPGRAM_API_KEY=...            # Voice transcription (optional)
ELEVENLABS_API_KEY=...          # Voice synthesis (optional)

# Infrastructure
DATABASE_URL=postgres://genesis:genesis_dev_password@localhost:5432/genesis_world
REDIS_URL=redis://localhost:6379

# App
JWT_SECRET=your-secret-key
CLIENT_URL=http://localhost:5173
PORT=3000
```

## Project Structure

```
genesis-world/
├── apps/
│   ├── client/          # Browser application
│   │   └── src/
│   │       ├── engine/  # Three.js rendering
│   │       ├── network/ # Socket.io & Yjs sync
│   │       └── ui/      # UI components
│   └── server/          # Backend server
│       └── src/
│           ├── routes/  # REST API endpoints
│           ├── ws/      # WebSocket handlers
│           └── services/
│               ├── game-master/  # AI orchestration
│               ├── npc/          # NPC management
│               └── sync/         # State management
├── packages/
│   └── shared/          # Shared types & utilities
│       └── src/
│           ├── game-theory/  # NPC behavior matrices
│           └── world/        # World utilities
├── docker-compose.yml
└── README.md
```

## Controls

- **WASD** - Move
- **Mouse** - Look around
- **Click** - Lock cursor for mouse look
- **ESC** - Unlock cursor
- **Enter** - Open chat
- **F3** - Toggle debug HUD

## Development

```bash
# Run both client and server in development mode
pnpm dev

# Build for production
pnpm build

# Run linting
pnpm lint

# Run tests
pnpm test
```

## Architecture

### Client-Server Communication

1. **REST API**: Authentication, world state queries
2. **Socket.io**: Real-time player updates, NPC conversations
3. **Yjs/WebRTC**: P2P state synchronization between players

### AI Integration

1. **Game Master**: Claude orchestrates world expansion and narrative
2. **NPC Conversations**: Inworld AI or Claude for dynamic dialogue
3. **World Generation**: Meshy.ai for 3D asset generation

### State Management

- **CRDTs (Yjs)**: Eventual consistency for player positions
- **Server Authority**: NPC states, world chunks, events
- **Local Persistence**: IndexedDB for offline support

## MVP Checklist

- [x] 3D world rendering with Three.js
- [x] WASD + mouse controls
- [x] Placeholder spawn area
- [x] Socket.io real-time sync
- [x] Yjs CRDT state management
- [x] Basic NPC conversation system
- [x] Game Master world expansion
- [ ] Voice conversation pipeline
- [ ] Gaussian Splat asset loading
- [ ] Full authentication flow
- [ ] World persistence

## License

MIT
