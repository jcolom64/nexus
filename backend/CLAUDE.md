# backend — Nexus API documentation

User-facing run instructions live in [README.md](./README.md). This file is
for contributors and AI sessions: architecture, conventions, and lessons
learned.

## What it is

NestJS 10 + PostgreSQL 16 + Prisma 5 backend for the Nexus admin frontend.
Lives at `backend/` in the Nexus monorepo; the Angular app is at `frontend/`.

## Project layout

```
backend/
├── docker-compose.yml         ← Postgres for local dev
├── prisma/
│   ├── schema.prisma          ← Single source of truth for the data model
│   └── seed.ts                ← Mirrors the six users mocked in the frontend
├── src/
│   ├── main.ts                ← Bootstrap, /api prefix, ValidationPipe, CORS
│   ├── app.module.ts          ← ConfigModule + feature modules
│   ├── prisma/                ← Global PrismaService
│   ├── auth/                  ← login, /me, JWT strategy, guards, decorators
│   └── users/                 ← Phase 1 CRUD with last-admin protection
└── .env(.example)             ← DATABASE_URL, JWT_SECRET, PORT, CORS_ORIGINS
```

## Stack choices and why

- **NestJS** — module/decorator pattern matches Angular, so frontend
  contributors are productive immediately.
- **Prisma** — declarative schema, generated TS client. We do CRUD-and-a-bit;
  Prisma's ergonomics outweigh its lock-in here.
- **PostgreSQL** — relational fits all current resources (users, groups,
  audit, assets). TimescaleDB extension can layer in for metrics later
  without an architecture change.
- **JWT (`passport-jwt`)** — stateless, easy CORS story, frontend already
  expects bearer tokens.
- **bcryptjs** (not `bcrypt` native) — pure-JS, avoids node-gyp pain on
  contributors' machines.

## API conventions

### Routing

- Global prefix `/api`. All controllers register under it.
- One controller per resource (`auth`, `users`, …). Add new resources by
  creating `<resource>.module.ts`, controller, service, and DTOs under
  `src/<resource>/`.

### Validation

- `ValidationPipe` is registered globally in `main.ts` with
  `whitelist: true, forbidNonWhitelisted: true, transform: true`. DTOs use
  `class-validator` decorators (`@IsEmail`, `@IsEnum(UserRole)`, etc.).
- `forbidNonWhitelisted: true` rejects requests with unknown fields — keeps
  payload shape strict.

### Error shape

- Throw NestJS exceptions: `BadRequestException`, `NotFoundException`,
  `ConflictException`, `UnauthorizedException`, `ForbiddenException`.
- Map Prisma error codes in services:
  - `P2002` (unique violation) → `ConflictException`.
  - `P2025` (record not found) → `NotFoundException`.
- Surface error messages directly to the UI — they should be human-readable.
  Don't leak stack traces or DB internals.

### Auth & guards

- `JwtAuthGuard` (passport-jwt) decodes the bearer and populates `req.user`
  with `{ id, email, role }`.
- `RolesGuard` reads `@Roles(UserRole.X)` metadata via Reflector.
- `@CurrentUser()` parameter decorator pulls `req.user` into handlers.
- Apply both at the controller level: `@UseGuards(JwtAuthGuard, RolesGuard)`,
  then add `@Roles(...)` to the methods that need restriction. Methods
  without `@Roles` allow any authenticated caller.

## Server-authoritative invariants

These rules are enforced **inside `prisma.$transaction`**. Pre-checking
before mutation is racy; do the mutation, then re-validate, then throw to
roll back.

### Last-administrator lockout protection

In `users/users.service.ts`. After any update or delete, re-count
`role=ADMINISTRATOR AND state=ACTIVE`. If zero, throw
`BadRequestException` with a recovery hint. The transaction rolls back.

```ts
return this.prisma.$transaction(async (tx) => {
  const updated = await tx.user.update({ … });
  if (couldShrinkAdmins) {
    const remaining = await this.countActiveAdmins(tx);
    if (remaining < 1) throw new BadRequestException(LAST_ADMIN_ERROR);
  }
  return updated;
});
```

The frontend mirrors this rule for UX (disabled buttons, banners) but
doesn't own it.

### Pattern to copy

When adding a new server-authoritative invariant for a different resource:

1. Define the rule in the service for that resource.
2. Wrap mutations in `prisma.$transaction(async (tx) => …)`.
3. Use the transaction client (`tx`) for the validation queries — don't fall
   back to `this.prisma`, or you'll see pre-mutation state.
4. Throw a NestJS exception (`BadRequestException` is usually right).
5. Mirror in the frontend for UX, but never *only* in the frontend.

## Config

`.env` (gitignored) and `.env.example` (committed).

| Var             | Purpose                                                      |
|-----------------|--------------------------------------------------------------|
| `DATABASE_URL`  | Prisma connection string (matches `docker-compose.yml`)      |
| `PORT`          | API port. Currently `3001` (3000 is taken on the dev machine)|
| `JWT_SECRET`    | HMAC secret for signing tokens. **Rotate in production.**    |
| `JWT_EXPIRES_IN`| Token lifetime (default `8h`)                                |
| `CORS_ORIGINS`  | Comma-separated allowed origins (frontend dev URLs)          |

`.env` exists in the working tree for local dev convenience. Never commit
secrets. The seed password (`nexus123`) is fine to share since the seed file
itself is checked in.

## Lessons (backend-specific)

### Prisma client must be generated

`@prisma/client` is generated, not pre-published. We added a `postinstall`
script (`prisma generate`) to `package.json` so `npm install` always
regenerates. Without that, the app boots but the dev server crashes on
first request to anything that imports a model type. Keep the postinstall.

### bcryptjs over bcrypt

The native `bcrypt` package fails to install on some contributor machines
(node-gyp / Python issues, especially on M-series macs). `bcryptjs` is
slower but pure JS, no compile step. Don't switch back unless we have
benchmarks proving it matters.

### Stateless logout

`POST /api/auth/logout` is a 204 no-op. The JWT is stateless — the client
just discards its copy. If we later need server-side revocation (compromised
token, kicked-out user), add a token denylist with TTL = max token lifetime.
Don't introduce sessions; defeats the JWT design.

### CORS lockdown

`main.ts` reads `CORS_ORIGINS` from env, defaults to allowing any origin
*only when the env var is empty*. In production this must be set to the
exact frontend host. The dev value allows both `:4200` and `:4204` since
`ng serve --port` varies on contributor machines.

## Phase plan

Phase 1 (Auth + Users) is shipped end-to-end. Subsequent phases add
modules to this same repo. See the
[roadmap snapshot in nexus README](../nexus/README.md#roadmap-snapshot)
for the live list.

| Phase | New module(s)                                  |
|-------|------------------------------------------------|
| 2     | `groups` (User Groups CRUD)                    |
| 3     | `audit` (event ingestion + paginated query)    |
| 4     | `system-config`, `security-policy`             |
| 5     | `sources`, `assets`, connector framework       |
| 6     | WebSocket gateway for live dashboard streams   |

## Done / queued

- [x] NestJS scaffold + Postgres + Prisma
- [x] `auth` module: login, /me, JWT strategy, guards
- [x] `users` module: full CRUD with role-based access control
- [x] Last-admin lockout protection (transactional)
- [x] Seed script for the six mock users
- [x] `accounts` module (read-only) + `groups` module (CRUD with member emails) — Phase 2
- [x] `audit` module — Phase 3 — append-only `AuditEntry` with `record()` API and paginated query. Ingestion wired into `auth.login/logout` and the `users` / `groups` CRUD controllers.
- [ ] `system-config` + `security-policy` — Phase 4
- [ ] `sources` + `assets` + connector framework — Phase 5
- [ ] WebSocket gateway — Phase 6
- [ ] Token denylist for forced logout (when needed)
- [ ] E2E tests (Jest + supertest)
- [ ] Production Dockerfile + multi-stage build
