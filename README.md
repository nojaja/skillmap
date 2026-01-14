# skillmap

**The Elder Scrolls V: Skyrim** inspired skill tree simulator. Built with Vue 3, Vite, Pinia, and Tailwind CSS. All data is stored locally in the browser via Service Worker + OPFS with zero external backend dependency.

🌐 **[Live Demo](https://nojaja.github.io/skillmap/?skillTreeUrl=https%3A%2F%2Fgist.githubusercontent.com%2Fnojaja%2F019ae39c7317287b2ae9991d8496edb9%2Fraw%2F049161f078ce4b4e70af9566132cb66e5612521e%2Fdestruction_magic)**  
📖 **[日本語ドキュメント (Japanese)](README_ja.md)**

## Project Overview

skillmap is a web application for creating, editing, and simulating any **skill tree** (skill nodes and their connections). Design custom progression systems with visual editing and interactive skill exploration.

### Key Features
- 📊 **Skill Tree Simulation** - Interactively explore trees and verify skill unlock conditions
- ✏️ **Editor Mode** - Add, edit, delete skills and manage dependency relationships
- 💾 **Local Storage** - Persistent data via Service Worker + Origin Private File System (OPFS)
- 📤 **Export/Import** - Save and share skill trees in JSON format
- 🎨 **Visual Placement** - Intuitive SVG canvas for spatial skill arrangement
- 📱 **Responsive** - Works seamlessly on desktop, tablet, and mobile
- ⚡ **Zero Backend** - Fully client-side, no external server required

## Project Structure

This project consists of **two independent modules**:

### 1. Frontend (Vue 3 SPA)
```
frontend/
├── src/
│   ├── App.vue                  # Root component
│   ├── main.ts                  # Vite entry point
│   ├── components/
│   │   ├── SkillConstellation.vue    # Skill tree display (SVG canvas)
│   │   ├── SkillEditorPanel.vue      # Skill editor panel
│   │   ├── SkyView.vue              # View management (zoom & pan)
│   │   ├── SkillCollectionModal.vue  # Skill tree management dialog
│   │   └── ...
│   ├── services/
│   │   ├── browserApiAdapter.ts     # Service Worker IPC bridge
│   │   └── skillNormalizer.ts       # Data normalization
│   ├── stores/
│   │   └── skillStore.ts            # Pinia store (state management)
│   ├── types/
│   │   └── skill.ts                 # Type definitions
│   └── utils/
│       └── grid.ts                  # Grid snap utilities
├── test/unit/                       # Jest unit tests
└── package.json
```

### 2. Service Worker (TypeScript WebWorker)
```
service-worker/
├── src/
│   ├── sw.ts                        # Entry point
│   ├── application/
│   │   ├── skillTreeService.ts      # Business logic
│   │   ├── skillTreeRepository.ts   # Repository layer
│   │   └── ...
│   ├── domain/
│   │   ├── skillTypes.ts            # Domain type definitions
│   │   └── skillNormalizer.ts       # Domain normalization
│   ├── infrastructure/
│   │   ├── cache/
│   │   │   └── skillTreeCache.ts    # Memory cache
│   │   ├── opfs/
│   │   │   ├── opfsClient.ts        # OPFS I/O
│   │   │   └── fileStore.ts         # File management
│   │   └── notification/
│   │       └── broadcastChannelGateway.ts
│   ├── service/
│   │   ├── swAdapter.ts             # Message handler
│   │   └── swLifecycle.ts           # SW lifecycle
│   └── test/unit/                   # Jest unit tests
└── package.json
```

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Vue 3 | ^3.5.24 | UI Framework |
| TypeScript | ^5.4.5 | Type-safe development |
| Vite | ^7.2.4 | Bundler & dev server |
| Pinia | ^3.0.4 | State management |
| Tailwind CSS | ^3.4.17 | UI styling |
| Axios | ^1.13.2 | HTTP client |

### Service Worker
| Technology | Version | Purpose |
|-----------|---------|---------|
| TypeScript | ^5.4.5 | Type-safe development |
| OPFS API | - | Local storage |
| BroadcastChannel API | - | Inter-process communication |

### Development Tools
| Tool | Version | Purpose |
|------|---------|---------|
| Jest | ^29.6.1 | Unit testing |
| ESLint | ^8.57.0 | Linting |
| TypeDoc | ^0.28.0 | API documentation generation |
| dependency-cruiser | ^16.9.0 | Dependency analysis |

## Setup

### Prerequisites
- Node.js v22 or higher
- npm v10 or higher

### Installation
```bash
# Clone the project
git clone https://github.com/nojaja/skillmap.git
cd skillmap/master01

# Setup Frontend
cd frontend
npm install

# Setup Service Worker
cd ../service-worker
npm install
```

## Usage

### Web Application (Development)
```bash
cd frontend
npm run dev
```
- Access `http://localhost:5173` in your browser
- Vite Hot Module Replacement (HMR) automatically reloads on file changes

### Web Application (Production Build)
```bash
cd frontend
npm run build
```
- Production bundle output to `dist/` directory
- Service Worker automatically compiled to `public/sw.js`

### Running Tests

#### Frontend Unit Tests
```bash
cd frontend
npm run test                    # Run tests
npm run test:ci               # Run with coverage
```

#### Service Worker Unit Tests
```bash
cd service-worker
npm run test                   # Run tests
npm run test:ci              # Run with coverage
```

### Linting & Type Checking
```bash
# Frontend
cd frontend
npm run lint                  # Run ESLint
npm run build                 # TypeScript compile check

# Service Worker
cd service-worker
npm run lint                  # Run ESLint
```

### API Documentation
```bash
# Generate Markdown documentation
npm run docs
```

### Dependency Analysis
```bash
npm run depcruise            # Analyze dependency graph
```

## Features

### 1. Skill Tree Display & Simulation
- **SVG Canvas** for visual skill node placement
- **Zoom & Pan** controls for canvas navigation
- Tap nodes to view skill details
- **Auto Dependency Analysis** - visualize prerequisites for selected skills

### 2. Skill Tree Editing
- ✏️ **Add Nodes** - create new skills anywhere on canvas
- 🗑️ **Delete Nodes** - remove skills with orphan detection
- 🔗 **Dependency Management** - define prerequisites with AND/OR logic
- 📍 **Spatial Arrangement** - drag & drop to reposition nodes

### 3. Skill Tree Management
- 📂 **Multiple Trees** - manage multiple skill tree projects
- 💾 **JSON Export** - save trees to files
- 📥 **JSON Import** - load from files
- 🔄 **Sync** - automatic synchronization across browser tabs (BroadcastChannel API)

### 4. Local Persistence
- **Service Worker + OPFS** - storage in browser's Origin Private File System
- ⚡ **Offline Support** - fully functional without network connection
- 🔐 **Privacy** - data isolated per origin/domain

## Implementation Status

### ✅ Completed Features
- SVG-based skill tree visualization
- Editor mode (add/delete/edit nodes)
- Dependency management (AND/OR logic)
- Service Worker integration
- Local storage via OPFS
- Cross-tab synchronization (BroadcastChannel)
- JSON export/import
- Pinia state management
- Vite dev server & build pipeline
- Unit tests (Jest)

### ⚠️ Experimental Features
- **Skill Point System** (`SKILL_POINT_SYSTEM_ENABLED = false`)
  - When enabled, applies a consumable point mechanic for skill unlocks
  - Currently disabled - all skills can be unlocked immediately

### 📋 Future Considerations
- [ ] Mobile UI optimization
- [ ] Skill tree template library
- [ ] Undo/Redo functionality
- [ ] Skill tree versioning
- [ ] Cloud sync (optional)
- [ ] Multi-user collaboration

## Architecture

### Layered Design
```
┌─────────────────────────────────┐
│  Vue Components (Presentation)  │  UI Layer
├─────────────────────────────────┤
│  Pinia Store (State Management) │  State Layer
├─────────────────────────────────┤
│  Service Adapter (IPC Bridge)   │  Communication Layer
├─────────────────────────────────┤
│  Service Worker (Backend)       │  Worker Layer
│  ├─ Application Layer           │    Business Logic
│  ├─ Domain Layer                │    Domain Models
│  └─ Infrastructure Layer        │    OPFS/Cache
└─────────────────────────────────┘
```

### Communication Flow
1. **UI User Interaction** → Vue Components
2. **State Update** → Pinia Store
3. **Message Send** → Service Adapter (`postMessage`)
4. **Backend Processing** → Service Worker (Business Logic)
5. **Storage Operations** → OPFS / Cache Layer
6. **Result Return** → Message Handler → Pinia
7. **UI Reflection** → Vue Reactivity

## Development Workflow

### Local Development
```bash
# Terminal 1: Frontend dev server
cd frontend
npm run dev

# Terminal 2: Test watch mode (optional)
cd frontend
npm run test -- --watch
```

### Build & Deploy
```bash
# Build
cd frontend
npm run build

# Verify output
ls -la dist/

# Automated GitHub Pages deployment (CI/CD configured)
# ➜ https://nojaja.github.io/skillmap/
```

### Test-Driven Development
```bash
# Run tests
npm run test

# Generate coverage report
npm run test:ci

# View report
open coverage/frontend/lcov-report/index.html
```

## Performance & Goals

- **Bundle Size**: ~500 KB (~150 KB gzipped)
- **Initial Load Time**: < 1 second (post-cache)
- **Test Coverage**: > 80% (continuously improving)
- **Accessibility**: WCAG 2.1 AA target

## Troubleshooting

### Service Worker not registering
```bash
# Clear browser cache
# DevTools → Application → Clear site data
```

### OPFS unavailable
```bash
# Check browser compatibility (Chrome 124+, Edge, etc.)
# Not available in Incognito/Private modes
```

### Tests failing
```bash
# Reset node_modules
rm -rf node_modules package-lock.json
npm install
npm run test
```

## License

This project is published under the **MIT License**.  
See [LICENSE](LICENSE) for details.

## Author

**nojaja** - [GitHub Profile](https://github.com/nojaja)

---

**Related Resources**
- 📖 [Architecture Documentation](docs/architecture/)
- 🛠️ [Development Documentation](docs/steering/)
- 📚 [API Documentation](docs/typedoc-md/)
- 🎮 Official Skyrim Site: https://elderscrolls.bethesda.net/skyrim
