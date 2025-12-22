# skillmap

The Elder Scrolls V: Skyrim inspired skill constellation prototype built with Vue 3, Vite, Pinia, Tailwind CSS on the frontend and Express + SQLite (Prisma) on the backend.

## Getting started

### Backend
```bash
cd server
npm install
npm run prisma:push   # prepares SQLite schema
npm run start         # starts the API on http://localhost:3000
```
Endpoints:
- `GET /api/status` — returns remaining skill points and unlocked skill IDs
- `POST /api/save` — updates remaining skill points and unlocked skill IDs

### Frontend
```bash
cd frontend
npm install
npm run dev           # launches Vite dev server on http://localhost:5173
```
The Vite dev server proxies `/api` requests to the backend.
