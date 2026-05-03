# Nexus API

NestJS + PostgreSQL + Prisma backend for the Nexus admin dashboard.

## Phase 1 scope

This is the first vertical slice. Endpoints implemented:

| Method | Path                 | Auth          | Description                          |
|--------|----------------------|---------------|--------------------------------------|
| POST   | `/api/auth/login`    | public        | Email + password → JWT               |
| POST   | `/api/auth/logout`   | public        | Stateless no-op (client drops token) |
| GET    | `/api/auth/me`       | bearer        | Current authenticated user           |
| GET    | `/api/users`         | bearer        | List users                           |
| GET    | `/api/users/:id`     | bearer        | Fetch one user                       |
| POST   | `/api/users`         | ADMINISTRATOR | Create user                          |
| PATCH  | `/api/users/:id`     | ADMINISTRATOR | Update user                          |
| DELETE | `/api/users/:id`     | ADMINISTRATOR | Delete user                          |

Subsequent phases (User Groups, Audit, System Configuration, Security
Policies, Assets) will land in this same project.

## Local setup

Prereqs: Node 18+, npm, Docker.

```bash
# 1. install deps
npm install

# 2. start Postgres
docker compose up -d

# 3. run migrations + seed (six users from the frontend mock; password 'nexus123')
npm run prisma:migrate -- --name init
npm run prisma:seed

# 4. start the API in watch mode
npm run start:dev
```

API will be at `http://localhost:3001/api`.

## Quick smoke test

```bash
# Login as the seeded administrator
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"john.doe@nexus.com","password":"nexus123"}'

# Use the returned accessToken
TOKEN=...
curl -s http://localhost:3001/api/auth/me   -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3001/api/users     -H "Authorization: Bearer $TOKEN"
```

## Project layout

```
backend/
├── docker-compose.yml         # Postgres for local dev
├── prisma/
│   ├── schema.prisma          # User model (more tables come in later phases)
│   └── seed.ts                # Mirrors the six mock users in the frontend
├── src/
│   ├── main.ts                # Bootstrap, /api prefix, CORS, global ValidationPipe
│   ├── app.module.ts
│   ├── prisma/                # PrismaService (global)
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts    # login, /me, JWT signing
│   │   ├── auth.module.ts
│   │   ├── dto/login.dto.ts
│   │   ├── strategies/jwt.strategy.ts
│   │   ├── guards/{jwt-auth,roles}.guard.ts
│   │   └── decorators/{current-user,roles}.decorator.ts
│   └── users/
│       ├── users.controller.ts
│       ├── users.service.ts
│       ├── users.module.ts
│       └── dto/{user,create-user,update-user}.dto.ts
└── .env                       # local-only secrets (not committed)
```

## Connecting the frontend

The Nexus Angular app currently uses `NbDummyAuthStrategy` (3-second fake
login) and a hardcoded `'guest'` role. To wire it to this API:

1. Replace `NbDummyAuthStrategy` with `NbPasswordAuthStrategy` in
   `src/app/@core/core.module.ts`, pointing at `http://localhost:3001/api/auth`.
2. Add `canActivate: [NbAuthJWTToken-backed AuthGuard]` to the `pages` route.
3. Replace the hardcoded `users` array on the Account tab with an HTTP call
   to `/api/users`.
4. Have `NbSimpleRoleProvider.getRole()` read `role` from the JWT instead
   of returning `'guest'`.

See the next phase commit for the frontend wiring.
