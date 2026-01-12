# skillmap - Skyrim Skill Tree Prototype

A Vue 3 + Vite application with a separate Service Worker module for local data persistence using OPFS (Origin Private File System).

## Workspace Structure

This is a monorepo with two main subprojects:

### frontend/

Vue 3 + Vite SPA that handles the UI and skill tree visualization.

```bash
cd frontend
npm install
npm run dev           # Start development server (http://localhost:5173)
npm run build         # Build production (includes service-worker build)
npm run test          # Run unit tests
npm run lint          # Lint source code
```

### service-worker/

Standalone service worker module that handles:
- Skill tree data persistence (OPFS backend)
- Cross-window synchronization (BroadcastChannel)
- Message-based API for the frontend

```bash
cd service-worker
npm install
npm run build         # Compile TypeScript to public/sw.js
npm run test          # Run unit tests
npm run lint          # Lint source code
```

## Getting Started

### Development

1. Install dependencies for both projects:
```bash
npm install
cd frontend && npm install
cd ../service-worker && npm install
cd ..
```

2. Start the development server:
```bash
cd frontend
npm run dev
```

The development server will serve both the frontend and automatically copy the service worker.

### Production Build

Build both subprojects:

```bash
cd frontend
npm run build
```

This will:
1. Build the service-worker and output `public/sw.js`
2. Run TypeScript type checking
3. Build the Vite frontend

Output will be in `frontend/docs/` for deployment.

## Architecture

- **Frontend** (`frontend/src`): Vue 3 components, stores (Pinia), utilities
- **Service Worker** (`service-worker/src`):
  - `domain/`: Type definitions and normalizers (pure logic)
  - `application/`: Business logic (SkillTreeService, SkillStatusService)
  - `infrastructure/`: OPFS file system, cache, notifications
  - `service/`: Service Worker lifecycle and message handlers

## Data Flow

1. Frontend UI → Message to Service Worker
2. Service Worker → OPFS reads/writes
3. Service Worker → BroadcastChannel notification
4. Frontend stores → Updates UI

All data persists locally in the browser; there is no backend API.

## License

MIT License (see [LICENSE](LICENSE))
