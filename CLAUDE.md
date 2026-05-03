# Nexus — project documentation

> Source of truth for AI assistants and contributors. Keep this file in sync as
> the project evolves. Each subdirectory has its own `CLAUDE.md` for narrower
> concerns.

## What is Nexus

A data-concentrator admin interface: an Angular dashboard backed by a NestJS
API. Pulls heterogeneous data sources (databases, message streams, object
stores, REST partners) into a single pane of glass with a data catalog,
system administration, audit log, and live operational dashboards.

User-facing copy lives in [README.md](./README.md). This file documents the
*project* itself.

## Repository layout

Monorepo with two apps that talk over HTTP. Each app builds and runs
independently — split into `frontend/` and `backend/` subdirs so the
boundary stays explicit.

```
nexus/                ← repo root (this monorepo)
├── CLAUDE.md         ← you are here
├── README.md         ← user-facing
├── frontend/         ← Angular 10 + Nebular UI 6 dashboard (port 4204)
└── backend/          ← NestJS 10 + PostgreSQL 16 + Prisma 5 (port 3001)
```

Inside the frontend:

```
frontend/
├── README.md
├── src/app/
│   ├── @core/                         ← singleton services
│   │   ├── CLAUDE.md
│   │   ├── api/                       ← typed HTTP wrappers (UsersApiService etc.)
│   │   ├── auth.guard.ts              ← protects /pages/**
│   │   └── core.module.ts             ← NbAuthModule, role provider, JWT interceptor
│   ├── @theme/                        ← UI: layouts, header, footer, theme tokens
│   │   ├── CLAUDE.md
│   │   ├── components/header/         ← title, theme toggle, profile modal
│   │   ├── layouts/                   ← one/two/three-column shells
│   │   └── styles/                    ← _layout.scss, themes.scss, _overrides.scss
│   └── pages/                         ← lazy-loaded feature modules
│       ├── CLAUDE.md
│       ├── dashboard/                 ← three-view (Overview / Sources / Alerts)
│       ├── assets/                    ← Catalog / Domains / Lineage stub
│       └── system/                    ← Health / Account / Groups / Security / Config / Audit
└── src/environments/                  ← apiBase URL (dev: http://localhost:3001/api)
```

## Tech stack

- **Frontend**: Angular 10, Nebular UI 6, Eva Icons, RxJS 6.5, Bootstrap 4 (grid only).
- **Backend**: NestJS 10, Postgres 16, Prisma 5, Passport-JWT, bcryptjs.
- **Local dev**: Docker Compose for Postgres; ng serve for the frontend.
- **No state library** — component state + RxJS is enough at this scale.

## Default ports

- Frontend dev server: `4204` (we used 4201 originally; 4204 is what's documented and what current commands assume).
- Backend API: `3001` (port `3000` is occupied on the dev machine by another app, so we deliberately chose 3001).
- Postgres: `5432`.

## Auth model

- `NbPasswordAuthStrategy` against `${apiBase}/auth/login` returning `{ accessToken, user }`.
- Token type: `NbAuthJWTToken`, key `accessToken`.
- `NbAuthJWTInterceptor` auto-attaches the bearer header to outgoing requests, **scoped to `environment.apiBase` only** so it never leaks to Eva CDN, Google Maps, etc.
- `AuthGuard` blocks `/pages/**` when no valid JWT.
- `NbSimpleRoleProvider` reads the `role` claim from the JWT, lower-cases it. The access-control map is `administrator → manager → user → auditor → guest`, each inheriting from the previous.
- Header avatar: email/role pulled from the JWT payload immediately, displayName fetched from `GET /api/auth/me` afterwards (the JWT does not carry the name).

## Data invariants (server-authoritative)

These are non-negotiable rules. The frontend mirrors them for UX, but the server enforces them — so direct curl/Postman calls obey the same rules.

### Last-administrator lockout protection

There must always be at least one user with `role=ADMINISTRATOR AND state=ACTIVE`.

- Enforced in `backend/src/users/users.service.ts` inside `prisma.$transaction`. After any update or delete, the service re-counts active admins; if the count would be zero, throws `BadRequestException` and the transaction rolls back.
- Frontend mirrors via `SystemComponent.isLastActiveAdmin()` and `editWouldRemoveLastAdmin` getter — disables the delete button on the last admin and the modal Save button when an edit would violate.
- Pattern to copy when adding new server-authoritative invariants: do the mutation **inside a transaction**, then validate, then `throw` to roll back. Don't pre-check before the mutation — racy.

## Theme model

- Two themes: `default` (light) and `dark`. The cosmic / corporate themes from the ngx-admin starter are removed.
- Switched via the small sun/moon slide-toggle in the header (not a dropdown). State persists in `localStorage` via `SettingsService`.
- Any pre-existing `cosmic`/`corporate` value in `localStorage` is silently coerced to `default` on init.

## Layout conventions

### Theme tokens drive layout

Sidebar width, header height/padding are overridden in
`src/app/@theme/styles/themes.scss`:

| Token              | Override   | Default   |
|--------------------|------------|-----------|
| `sidebar-width`    | `10rem`    | `16rem`   |
| `header-height`    | `2.25rem`  | `4.75rem` |
| `header-padding`   | `0 1rem`   | `1.25rem 1.125rem` |

Changing these cascades to:

- The visual sidebar/header (Nebular reads tokens directly).
- The full-bleed System page's `top` and `left` offsets in `_layout.scss`.
- The CSS rules that push Dashboard/Assets right of the sidebar.
- The body `min-width` (window can't shrink below the sidebar).

**Don't hardcode these values anywhere. Always reference the theme token.**

### Sidebar state and column resize

Nebular puts the sidebar's state class (`expanded` / `compacted` / `collapsed`)
on `<nb-sidebar>` itself, **not** on `<nb-layout>`. Use `:has()` to react:

```scss
nb-layout:has(nb-sidebar.expanded)  nb-layout-column.main-content { … }
nb-layout:has(nb-sidebar.compacted) nb-layout-column.main-content { … }
```

Column margin/width is now driven by these CSS rules **and** by JS in
`one-column.layout.ts` that reads the class state (not measured width — see
the lesson below). Both layers exist as a belt-and-suspenders.

### CDK overlay z-index

Nebular's `cdk-overlay-container` sits at `z-1040` by default, **below**
modal overlays (`z-1100`). When a select dropdown opens inside a modal it
lands behind the dimmer and looks like nothing happened. We bump the CDK
container globally:

```scss
.cdk-overlay-container { z-index: 1200 !important; }
```

In `_layout.scss`. Don't remove this.

## UI conventions

### Table layout standard

Every data table in the app follows the same structure: intro text →
table card with three-slot control bar (`Display [N] Resources` left,
search middle, pagination right) → column headers → rows → bottom count
line. Reference implementation: **System → Account**. Full spec and
copy-paste boilerplate in [`src/app/pages/CLAUDE.md`](./src/app/pages/CLAUDE.md#table-layout-standard-mandatory-for-all-data-tables).

When adding any new table, follow that pattern. When touching an existing
one, retrofit it to match.

## Lessons learned (architectural)

These are the non-obvious traps that have already burned us. If you're
debugging something that looks like it should work but doesn't, suspect one
of these first.

### 1. Modal-overlay must escape parent stacking contexts

Any element with `position: fixed; z-index: N` inside an ancestor that has
its own stacking context is **trapped** at the ancestor's z-index in document
order. Hit twice now (System page modal, profile modal). Two ways to fix:

- **Render the modal at the component root** (sibling of the page wrapper, not
  nested inside `.ngx-system-fullbleed` or any z-indexed ancestor). The
  System page Add-User-Group modal lives at the very top of
  `system.component.html` for this reason.
- Or **bump the ancestor's z-index** above whatever else might compete (e.g.
  Nebular's fixed header at `z-1040`).

If clicks aren't reaching inputs in a modal, suspect this.

### 2. Modal scope mismatch with `.account-tab`

Most styles in `system.component.scss` are nested under `.account-tab`. Modal
SCSS that's nested there only matches when the modal HTML is also inside
that wrapper. Symptoms when this is wrong: modal renders but as a normal
inline block, pushing the page down.

Fix: keep modal HTML inside `.account-tab` *or* hoist its SCSS rules to the
top level of `nb-install-component()`.

### 3. Global `[class*="col-"]` rule collapses grid cells

`one-column.layout.scss` has a `::ng-deep` rule under `nb-layout-column`:

```scss
[class*="col-"] {
  width: 100%;
  flex: 0 0 100%;
  padding-left: 15px; padding-right: 15px;
}
```

Intended for Bootstrap grid columns, but matches **any class with the `col-`
prefix** (`col-time`, `col-actor`, etc.). On a CSS-grid row those declarations
collapse every cell to row width, so the row visually stacks vertically.

Defensive override pattern (use it for new grid tables):

```scss
.users-row > [class*="col-"] {
  width: auto; max-width: none; flex: initial;
  padding-left: 0; padding-right: 0;
}
```

### 4. Don't measure during transitions

`one-column.layout.ts` originally measured the sidebar's `getBoundingClientRect()`
to decide how far to push the column. During the 300 ms CSS transition this
returns intermediate values — the column lands at the wrong margin. **Read
the state class, not the rendered width.**

### 5. JWT interceptor must be scoped

Without a filter, `NbAuthJWTInterceptor` attaches the bearer to *every*
outgoing HTTP call — including third-party requests for fonts, icons, maps.
Scope it with `NB_AUTH_TOKEN_INTERCEPTOR_FILTER` to skip URLs that don't
start with `environment.apiBase`. See `core.module.ts`.

### 6. Server invariants live in transactions

Don't pre-check then mutate — racy. Mutate inside `prisma.$transaction`,
re-validate, throw to roll back. See `UsersService.update/remove`.

### 7. `*ngFor` over a getter that remaps objects

A property getter that maps over an underlying array and returns *brand-new
object references on every call* will:

- run on every change-detection cycle,
- produce fresh references each time,
- and — without `trackBy` — make `*ngFor` destroy and rebuild every row's
  DOM each cycle.

The visible symptom: row-action buttons (edit, delete) silently do nothing —
the button between `mousedown` and `mouseup` is gone. No console error.
Other tables in the same component are unaffected if their pagination
getters only `slice`/`filter` without remapping.

**Fix**: memoize on the source array's reference identity. Pattern:

```ts
private _cache: { src: Source[]; result: View[] } | null = null;
get viewArray(): View[] {
  if (this._cache && this._cache.src === this.source) return this._cache.result;
  const result = this.source.map((s) => ({ /* mapped */ }));
  this._cache = { src: this.source, result };
  return result;
}
```

This requires `source` to be **reassigned** (not mutated) when its contents
change — `arr = [...arr, x]` not `arr.push(x)`. We already do that
everywhere. Hit this on `SystemComponent.userGroups`; the Account / Audit
/ Assets tables were fine because their pagination chains don't remap.

### 8. ngx-admin's tslint conflict

`npm install` in this repo fails without `--legacy-peer-deps` because
`tslint-language-service` peer-needs `tslint < 6` while `codelyzer` peer-needs
`tslint >= 6`. Always:

```bash
npm install --legacy-peer-deps
```

### 9. Memoization keys must include every reactive input

When a `*ngFor`-fed getter remaps source data (lesson 7), the cache must
key on **every** value that changes the output — not just source identity.
The `userGroups` getter originally cached on `apiGroups` reference only;
when `created`/`lastUpdated` started routing through `formatInZone`, a
System → Configuration save (changing tz/dateFormat) wouldn't reflow the
column because the cache was still valid. Fix: extend the cache key with
the formatter inputs:

```ts
private _cache: { src: ApiUserGroup[]; tz: string; fmt: string; result: UserGroup[] } | null = null;
```

Apply to any memoized projection that depends on values outside `src`.

### 10. Honest UI: mark non-functional fields and mock data

If a settings field has no consumer (Reserved), or a widget shows mock
data, **say so visibly**. Three concrete patterns we landed on:

- **Reserved** field with no consumer (e.g. `firstDayOfWeek` until calendar
  features land): disable the input, append a `label-help` line saying so.
- **Reserved** card section (e.g. Performance & Limits has no cache layer
  / job queue yet): inline `info-banner` at the top of the card body
  explaining values persist and audit-log but no subsystem reads them.
- **Mock** data in real-data widgets (e.g. four placeholder Service Status
  pills before Phase 5/6 wires them): visual treatment — dashed border,
  `DEMO` tag — so it's obvious which numbers are authoritative.

Why: silently storing a setting that doesn't drive behavior surfaces as
"I changed it but nothing happened" bug reports. Saving the user that
mental cost is cheaper than fixing the report later. We hit this twice
(`firstDayOfWeek`, Performance & Limits); the third time we caught it
in advance.

### 11. Timestamps respect `systemConfig.defaultTimezone` + `dateFormat`

Every user-facing timestamp routes through `@core/utils/formatInZone`,
which honours the saved tz + dateFormat. Three modes:

- default → `<date> HH:mm` (footer clock, last-login)
- `{ seconds: true }` → `<date> HH:mm:ss` (audit, recent events)
- `{ dateOnly: true }` → `<date>` (User Groups created/updated, license expires)

Don't render raw ISO strings or `.slice(0, 10)`-style formatting in the
UI — it bypasses the user's chosen format.

### 12. App vs system metrics

Node's `os.cpus()` / `os.totalmem()` report **the host**, not the cgroup
limit, in containers. `process.cpuUsage()` / `process.memoryUsage().rss`
are accurate everywhere. The Health page shows both with a footnote
about the host-vs-cgroup caveat — the app row is always truthful, the
system row may overstate.

For "what disk does Nexus use", the honest answer for a stateless API
is **Postgres**: `pg_database_size(current_database())`. Don't fake an
"App disk" metric.

### 13. Health endpoint auth split

`/health/check` is public (uptime monitors, load balancers); `/health/metrics`
is auth-gated (leaks process internals). When adding a new health-shaped
endpoint, classify it by what it leaks before deciding the guard.

### 14. Prisma migrations: data updates need hand-edited SQL

`npx prisma migrate dev --create-only` only generates DDL changes. If a
schema change has to backfill an existing row (e.g. the dev-license
migration changing column defaults *and* updating the existing singleton
row), append the `UPDATE` statement to the generated `migration.sql`
manually before running `migrate dev` to apply it. Default-only schema
edits don't touch existing rows.

## Phase plan (backend)

Phases 1–4 are shipped end-to-end. Subsequent phases:

| Phase | Backend                                      | Frontend                                | Status |
|-------|----------------------------------------------|-----------------------------------------|--------|
| 1     | `AuthModule` + `UsersModule`                 | System → Account                        | done   |
| 2     | `GroupsModule` — User Groups CRUD            | System → Groups                         | done   |
| 3     | `AuditModule` — query + ingestion            | System → Audit                          | done   |
| 4     | `ConfigModule` + `SecurityModule`            | System → Configuration + Security       | done   |
| H     | `HealthModule` (`/health/check`, `/health/metrics`) | System → Health (real status + CPU/mem/DB size + audit-driven Recent Events) | done   |
| 5     | `SourcesModule` + `AssetsModule` + connectors| replace mock catalog in Assets          | queued |
| 6     | WebSocket gateway for live KPIs              | stream Dashboard sparklines             | queued |

### Phase 4 — singleton settings pattern

Both `SystemConfig` and `SecuritySettings` are single-row tables keyed by a
fixed `id = 'singleton'`. The service uses `prisma.<model>.upsert` so the
first GET seeds the row from defaults — there's no migration step needed
to populate it. Writes are gated to `ADMINISTRATOR` and audited under
`category=CONFIG` / `category=SECURITY`. PUT accepts a partial payload:
fields the client omits keep their stored value. Pattern to copy for any
future "exactly one row per environment" config (feature-flag overrides,
maintenance windows, etc.).

Singleton config that drives chrome (header text, footer clock) needs a
process-wide store, not per-component fetches. `@core/utils/system-config.store.ts`
holds the `BehaviorSubject<ApiSystemConfig | null>`, fetches once when the
JWT becomes valid via `NbAuthService.onTokenChange()`, and exposes
`update()` so a save propagates to subscribers without a page reload.

### Phase H — Health endpoints

- `GET /api/health/check` — **public** (no `JwtAuthGuard`). External uptime
  monitors / load-balancer probes need to reach it without a credential.
  Payload is minimal: `{ overall, components: [{ name, status, latencyMs, message }], timestamp }`.
  API Gateway is "up" trivially (you got a response); Database runs `SELECT 1`.
- `GET /api/health/metrics` — **auth-gated**. Leaks process internals (memory
  size, CPU %, DB size on disk), so requires JWT. CPU sampled in-request via
  two `os.cpus()` snapshots ~100ms apart; same for `process.cpuUsage()`. The
  app vs system split is deliberate — see "App vs system metrics" below.

### License module (split out of SystemConfig)

License is install-time data — key, plan, seat cap, expiry — owned by the
operator, not the tenant admin. It lives in its own `License` singleton
table (`licenses`), separate from `SystemConfig`.

- `GET /api/license` — **auth-gated** (leaks license details). Read-only.
- **No PUT/PATCH endpoint by design.** Writes happen out-of-band:
  ```bash
  npm --prefix backend run license:apply -- \
    --key NEXUS-XXXX-XXXX-XXXX --plan enterprise --seats 100 \
    --expires 2027-12-31 --by jcolom@example.com
  ```
  `--expires` is optional (omit for perpetual). The CLI lives at
  `backend/scripts/apply-license.ts`. Future work: validate a signed
  license bundle instead of accepting raw flags.
- `seatsUsed` is **not stored** — the UI derives in-use seats from the
  live user count (`apiUsers.length`) instead. The previous orphaned
  column was dropped in the split migration.

Frontend reads via `LicenseApiService` and renders the Licensing card on
System → Configuration plus the corresponding rows in System → Health
"System Information". Read-only everywhere; the Configuration tab's
banner explains how to rotate.

The roadmap snapshot in [README.md](./README.md#roadmap-snapshot) is the
source of truth for in-flight items — keep it updated.

## Documentation system

- **Root `CLAUDE.md`** (this file): project overview, conventions, lessons.
- **`@core/CLAUDE.md`**: services, auth, API client patterns.
- **`@theme/CLAUDE.md`**: layout tokens, header, footer, theme toggle.
- **`pages/CLAUDE.md`**: feature module guide.
- **`README.md`**: user-facing setup + run instructions.

The auto-memory system at
`~/.claude/projects/-Users-JaimeC-Workspace-nexus/memory/` holds
session-specific lessons (see the indexed entries in
`MEMORY.md`); CLAUDE.md is for the project itself.

---

*Last updated: 2026-05-03.*
