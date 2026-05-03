# @core — singleton services, auth, API clients

## What lives here

```
@core/
├── CLAUDE.md
├── core.module.ts          ← NbAuthModule, role provider, JWT interceptor
├── auth.guard.ts           ← protects /pages/**
├── module-import-guard.ts  ← throws if @core is imported twice
├── api/                    ← typed HTTP wrappers (one file per resource)
│   ├── users-api.service.ts
│   ├── groups-api.service.ts
│   ├── audit-api.service.ts
│   ├── config-api.service.ts
│   ├── security-api.service.ts
│   └── health-api.service.ts
├── data/                   ← legacy interfaces (UserData, etc.) — phased out
├── mock/                   ← mock data services — phased out as real APIs land
└── utils/
    ├── settings.service.ts        ← theme + sidebar persisted in localStorage
    ├── system-config.store.ts     ← BehaviorSubject<ApiSystemConfig | null>
    ├── date-format.ts             ← formatInZone helper (tz + dateFormat)
    └── analytics.service.ts, seo.service.ts
```

`@core` is imported **once** via `CoreModule.forRoot()` in `AppModule`. The
import guard aborts the build if any other module tries to import it again
— singletons stay singletons.

## Authentication

Auth is real, not mocked.

- **Strategy**: `NbPasswordAuthStrategy` against `${environment.apiBase}/auth`.
  - `login`: POST `/login` returning `{ accessToken, user }`. Token class:
    `NbAuthJWTToken`, key: `accessToken`. Success redirects to `/pages/dashboard`.
  - `logout`: POST `/logout` (server is stateless; client just discards).
- **Role provider**: `NbSimpleRoleProvider` reads the `role` claim from the JWT
  and lower-cases it. Returns `'guest'` when there's no valid token.
- **Access control map** in `core.module.ts`: `administrator → manager → user
  → auditor → guest`. Each role inherits from the previous via Nebular's
  `parent:` field; permission strings are `'view'`, `'create'`, `'edit'`,
  `'remove'`.
- **JWT interceptor**: `NbAuthJWTInterceptor` is registered globally but
  scoped to `environment.apiBase` via `NB_AUTH_TOKEN_INTERCEPTOR_FILTER`.
  Without that filter, the bearer would leak to every outgoing request
  (Eva Icons CDN, Google Maps, etc.). **Don't remove the filter.**
- **Auth guard**: `auth.guard.ts` checks the token via `NbAuthService.getToken()`
  and redirects to `/auth/login` when invalid. Applied to `/pages` in
  `app-routing.module.ts`.

## API client pattern

One service per resource under `api/`. Convention:

- Inject `HttpClient`. Don't subclass anything Nebular-specific.
- Use `environment.apiBase` for the base URL — never hardcode hosts.
- Typed request/response interfaces alongside the service:
  - `ApiUser` for the wire shape (uppercase enums matching Prisma).
  - `CreateUserPayload`, `UpdateUserPayload` for inputs.
- All methods return `Observable<T>` — components subscribe and unsubscribe
  on destroy.

Reference: `api/users-api.service.ts`. Adding a new resource? Create
`api/groups-api.service.ts`, etc., following the same shape.

## Settings service

`utils/settings.service.ts` persists user preferences in `localStorage` under
`nexus-app-settings`. Currently tracks:

- `theme`: `'default' | 'dark'` (cosmic/corporate are coerced to default on
  load — they were removed when the header dropdown was replaced with the
  sun/moon toggle).
- `sidebarCollapsed`: boolean.

Other localStorage keys owned by features (managed by their own components):

- `nexus-user-profile` (Header → Profile modal)

Each will move to its API counterpart in subsequent phases. Earlier
phases retired:

- `nexus-user-groups` → `/api/groups` (Phase 2)
- `nexus-security-settings` → `/api/security` (Phase 4)
- `nexus-system-config` → `/api/config` (Phase 4)

## SystemConfigStore (singleton store pattern)

`utils/system-config.store.ts` holds the latest `ApiSystemConfig` in a
process-wide `BehaviorSubject<ApiSystemConfig | null>`. Components subscribe
to `config$` and react to changes; `update(payload)` calls the API and
pushes the response to the subject so saves propagate live.

- **Initial fetch is auth-gated.** The constructor subscribes to
  `NbAuthService.onTokenChange()` and only fires `GET /api/config` once a
  valid `NbAuthJWTToken` lands. Don't fetch in the service constructor —
  it would 401 before login and silently stay null.
- **Subscribers**: header (app-name override), footer (clock tz + format),
  `SystemComponent` (System → Configuration page).
- **Save path**: `SystemComponent.saveSystemConfig()` calls
  `configStore.update(...)` rather than `configApi.update(...)` directly,
  so the new value reaches the header/footer the same change-detection
  cycle.

Pattern to copy when adding any other "one row that drives chrome
elsewhere" config (e.g. branding overrides, feature gates).

## Timestamp formatting (`utils/date-format.ts`)

`formatInZone(date, timezone, pattern, options?)` is the canonical helper
for any user-facing timestamp. Always honours
`systemConfig.defaultTimezone` + `systemConfig.dateFormat`. Three modes:

| Mode | Output | Used by |
|------|--------|---------|
| default | `<date> HH:mm` | footer clock, Account `lastLoginAt` |
| `{ seconds: true }` | `<date> HH:mm:ss` | Audit log, Recent Events |
| `{ dateOnly: true }` | `<date>` | Groups created/updated, License expires |

Don't render `entry.timestamp` raw or use `.slice(0, 10)`/`.replace('T', ' ')`
hacks — they bypass the user's chosen format. Read tz/fmt off
`this.systemConfig` (in `SystemComponent`) or off the `SystemConfigStore`
(everywhere else).

When a `*ngFor` getter formats timestamps, **the memoization cache must
include tz + fmt**, otherwise a System → Configuration save won't reflow
the column. See lesson #9 in the root CLAUDE.md.

## Conventions

- **No business logic in components** — push it into a service in `@core`.
- **No HTTP calls outside `@core/api/`** — components call services, services
  call HTTP.
- **No mock data services for new code.** The pattern in `mock/` and `data/`
  predates the real backend; new features should use `api/` services.
- **No leaking secrets to third parties.** If you add a new HTTP interceptor
  that handles tokens, scope it to `environment.apiBase`.

## Done / queued

- [x] Settings persistence (theme)
- [x] Real auth (`NbPasswordAuthStrategy`, JWT, role from claims)
- [x] Auth guard on `/pages/**`
- [x] JWT interceptor scoped to API origin
- [x] `UsersApiService` (Account tab end-to-end)
- [x] `GroupsApiService` (User Groups tab end-to-end + accounts read-only) — Phase 2
- [x] `AuditApiService` (server-paginated query) — Phase 3
- [x] `ConfigApiService`, `SecurityApiService` (singleton GET/PUT) — Phase 4
- [x] `SystemConfigStore` (BehaviorSubject + auth-gated fetch) — Phase 4
- [x] `formatInZone` helper (tz + dateFormat aware timestamps) — Phase 4
- [x] `HealthApiService` (`/health/check` public, `/health/metrics` auth-gated) — Phase H
- [x] `LicenseApiService` (read-only — install-time data; written by backend CLI)
- [x] `SourcesApiService`, `AssetsApiService` (CRUD over the metadata layer) — Phase 5a
- [x] `SourcesApiService.test/.sync` (Postgres connector — probe + introspect) — Phase 5b
- [ ] Per-source health pills on Health tab — Phase 5c
