# Nexus

A data-concentrator admin interface — Angular dashboard backed by a NestJS API.
Pulls heterogeneous data sources (databases, message streams, object stores, REST
partners) into a single pane of glass with a data catalog, system administration,
audit log, and operational dashboards.

## Repository layout

```
nexus/
├── frontend/    Angular 10 + Nebular UI 6 (port 4204 in dev)
├── backend/     NestJS 10 + PostgreSQL 16 + Prisma 5 (port 3001 in dev)
├── CLAUDE.md    Architecture, conventions, lessons learned
└── README.md    You are here
```

Each subproject has its own `README.md` and `CLAUDE.md` for narrower setup
and convention notes.

## Quick start

You'll need:

- Node 18+ and npm
- Docker (for the dev Postgres) — or a Postgres 16 reachable at `localhost:5432`
- A `.env` file in `backend/` (copy `backend/.env.example` and fill in the
  values — DATABASE_URL, JWT_SECRET, PORT)

```bash
# 1. Postgres
cd backend && docker compose up -d            # Postgres on :5432

# 2. Install everything (root + both apps)
cd ..
npm install                                   # root deps (concurrently)
npm run install:all                           # backend + frontend (handles --legacy-peer-deps)

# 3. Apply database schema + seed
npm run prisma:migrate

# 4. Run both apps together
npm run dev                                   # backend :3001 + frontend :4204
```

Open http://localhost:4204 and log in with one of the seeded users
(see `backend/prisma/seed.ts` for credentials).

### Other root scripts

| Command                   | What it does                                    |
|---------------------------|-------------------------------------------------|
| `npm run dev`             | Run backend + frontend in parallel              |
| `npm run dev:backend`     | Backend only (`nest start --watch`)             |
| `npm run dev:frontend`    | Frontend only (`ng serve`)                      |
| `npm run typecheck`       | `tsc --noEmit` on both apps                     |
| `npm run build`           | Production builds for both apps                 |
| `npm run test:frontend`   | Karma tests headless                            |
| `npm run prisma:studio`   | Open Prisma's DB browser                        |

## Documentation

- **`CLAUDE.md`** — project-wide architecture, conventions, and accumulated
  lessons. Read this first if you're picking up the project.
- **`frontend/src/app/CLAUDE.md`** and the per-directory CLAUDE files
  (`@core/`, `@theme/`, `pages/`) — narrower notes for the frontend.
- **`backend/CLAUDE.md`** — backend module structure, auth model, audit
  invariants.
- **`README.md` files in each subproject** — setup-specific details that
  don't fit in this overview.

## License

[MIT](./LICENSE). The frontend is derived from
[akveo's ngx-admin](https://github.com/akveo/ngx-admin) starter (also MIT);
their copyright notice is preserved in `LICENSE` per the MIT attribution
requirement.
