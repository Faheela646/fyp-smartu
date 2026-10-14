# SmartU Transport: new frontend

React + TypeScript (Vite), Tailwind (token-based light/dark), Radix primitives, TanStack Query, Zustand (UI/session/realtime state only), react-hook-form + zod, Framer Motion, Recharts, Leaflet, html5-qrcode, qrcode.react.

## Run

```bash
npm install
npm run demo       # RECOMMENDED: production build + preview, fast. http://localhost:4173
npm run dev        # development server (slower first load): http://localhost:5173
npm run build
```

## Demo mode

`VITE_DEMO_MODE=true` (default in `.env`) uses mock services and a WebSocket simulator (4 buses moving, seat counts changing, notifications). Set it to `false` and point `VITE_API_BASE_URL` / `VITE_WS_URL` at the real backend.

Routes, stops, timings and authorised persons come from the university's *Complete Buses Route FALL-2026* PDF (`src/demo/uniRoutes.ts`).

Demo logins: `admin / admin123`, `22F-3082 / 3082@fast` (day scholar), `22F-3091 / 3091@fast` (hostelite), `conductor_1 / conductor123`. Drivers are employee records managed by the admin and have no login.

## Tests

```bash
npm test        # 162 service-level tests (admin, students, tickets, conductor, RBAC)
```

See `TEST-CHECKLIST.md` for the full feature checklist and manual test results.

## Structure

- `src/app`: router, role guards, layouts (`AppShell`), nav config
- `src/components/ui`: presentational primitives (no logic)
- `src/components/domain`: StatCard, SeatCounter, LiveSeatsCard, ConnectionStatus, ...
- `src/services`: axios client + per-resource services (mock vs real switch)
- `src/hooks`, `src/store`: data hooks, realtime/auth/theme state
- `src/demo`: mock data and the simulator
- `src/types`: API models and WebSocket event union (the assumed contract)
- `src/styles/globals.css`: design tokens
