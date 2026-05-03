# pages — feature modules

## What lives here

```
pages/
├── CLAUDE.md
├── pages.component.ts          ← shell (sidebar menu + router-outlet)
├── pages.module.ts             ← shared imports for all child pages
├── pages-routing.module.ts     ← child routes for /pages/**
├── pages-menu.ts               ← Dashboard / Assets / System
├── dashboard/                  ← three-view operational dashboard
├── assets/                     ← data catalog (Catalog / Domains / Lineage)
└── system/                     ← System Administration tabs
```

`/pages/**` is gated by `AuthGuard` — unauthenticated users land on
`/auth/login`.

## Routing

`pages-routing.module.ts` mounts child routes under `<ngx-pages>`:

| Path                | Component               | Notes                                          |
|---------------------|-------------------------|------------------------------------------------|
| `/pages/dashboard`  | `DashboardComponent`    | Default redirect target                        |
| `/pages/assets`     | `AssetsComponent`       | Catalog + Domains + Lineage stub               |
| `/pages/system`     | `SystemComponent`       | Six tabs (Health / Account / Groups / …)        |

The sidebar menu lives in `pages-menu.ts`. Adding a new top-level page:
add a route here, declare the component in `pages.module.ts` (or its own
feature module), add a `MENU_ITEM` in `pages-menu.ts`.

## Page-by-page

### Dashboard (`dashboard/`)

Three switchable views via a pill selector at the top:

- **Overview** — KPI tiles (status-colored accent bars + sparklines),
  big throughput sparkline, top-source bar list, recent events feed.
- **Data Sources** — Status-tile counts (connected / degraded / disconnected /
  stale), per-source cards with throughput sparkline + latency + uptime.
- **Alerts** — Severity tiles, active-alerts list with acknowledge/view
  buttons.

All data is mock arrays on `DashboardComponent`. SVG sparklines (no chart
library). Replaces the original ngx-admin "Hello sandbox" placeholder.

### Assets (`assets/`)

Three views:

- **Catalog** — searchable grid of all assets fetched from `/api/assets`.
  One universal "Search all fields" input does the filtering — the
  per-facet dropdowns (type/source/domain/tag) were removed once the
  search proved sufficient. Clicking a row opens a right-side detail
  panel with description, schema (with PII flag), tags, and clickable
  upstream/downstream lineage chips. Lineage edges are *qualifiedNames*;
  the `assetByQName(qn)` helper resolves them and the `*ngIf` guard
  skips chips for assets that aren't currently loaded (cross-source or
  not-yet-registered).
- **Domains** — six domain cards (sales, finance, marketing, product,
  compliance, ops) computed from the loaded asset list. Asset count,
  top assets, and unique-owner avatar stack come from grouping by
  `domain`. The "Open" button drops into Catalog with the search box
  prefilled to the domain name (search hits the asset's `domain` field).
- **Lineage** — static SVG mock with "v2 preview" badge. Real graph editor
  lands in Phase 5b/c.

Data shape: API enums (`TABLE`, `SALES`, `PII`, …) lowercase-mapped at the
component boundary (see `assetTypeApiToWire` etc. in `AssetsComponent`).
`lastUpdated` is formatted via `formatInZone` on receipt; the
`SystemConfigStore` subscription in `ngOnInit` triggers a refetch + reformat
when the user changes timezone / date format on System → Configuration.

### System (`system/`)

Six tabs in a left rail. The component is large (~900-line `system.component.ts`)
because it owns the state for all six tabs. Each tab corresponds to a
section in CLAUDE.md → architecture / phase plan.

| Tab            | State source                | Phase     |
|----------------|-----------------------------|-----------|
| Health         | `HealthApiService` + per-source pills (5c) + `AuditApiService` for events | **Phase H + 5c — done** |
| Account        | `UsersApiService` (real)    | **Phase 1 — done** |
| User Groups    | `GroupsApiService` (real)              | **Phase 2 — done** |
| Security       | `SecurityApiService` (singleton row)    | **Phase 4 — done** |
| Configuration  | `ConfigApiService` (singleton row)      | **Phase 4 — done** |
| Audit          | `AuditApiService` (real, server-paginated) | **Phase 3 — done** |

The Account tab is the model for how to migrate the others to real APIs:
typed service in `@core/api/`, modal for create/edit, soft-confirm for
delete, error banner for API errors.

The Account row currently shows a **Groups** column derived from a
hardcoded email→groups map (`SystemComponent.userGroupMembership`). This
is mock data; when Phase 2 ships `/api/groups` the helper
`groupsForUser(user)` should query the API instead. The column displays
group names as info-colored chips between Role and Status.

#### Last-administrator lockout protection

`System → Account` enforces a server-authoritative invariant: there must
always be at least one user with `role=ADMINISTRATOR AND state=ACTIVE`.

- Backend: `backend/src/users/users.service.ts` wraps update/delete in
  `prisma.$transaction`, recounts after the change, throws if zero.
- Frontend: `SystemComponent.isLastActiveAdmin()` and
  `editWouldRemoveLastAdmin` mirror the rule for UX (disabled delete
  button with tooltip, modal warning banner, Save disabled).

Pattern to copy when adding new server-authoritative invariants for other
resources.

#### Health tab composition

`System → Health` doesn't follow the table-layout standard — it's a
dashboard. Four blocks:

1. **Status strip** — split into two labelled sections after Phase 5c:
   - **Platform Services**: API Gateway + Database, populated from
     `GET /api/health/check` on every Health-tab visit.
   - **Data Sources**: one pill per registered Source, derived from the
     already-loaded `dataSources` array. Status maps `connected → success`,
     `degraded → warning`, `disconnected → danger`. Empty state when no
     sources are registered.

   The four DEMO pills (Message Queue / Cache Layer / Auth Service /
   Object Storage) and their `class="is-mock"` styling were retired in
   Phase 5c — real per-source pills replaced them.

2. **Metrics grid** — two `.split-card`s (CPU, Memory). Each shows an
   App row and a System row, both as labelled progress bars. Driven by
   `GET /api/health/metrics`. App values come from `process.cpuUsage()`
   / `process.memoryUsage().rss` (always accurate); system values come
   from `os.cpus()` / `os.totalmem()` (host-wide; may overstate inside a
   container — note the footnote below the grid).

3. **System Information card** — derived from `systemConfig` + `apiUsers`
   + `healthMetrics` (the last for `databaseSizeBytes`) + `license`.
   Surfaces the tenant configuration as a snapshot: app name (config),
   plan / license key / seats-in-use / expiry (license), locale /
   timezone / date format (config), DB size (health). License values
   come from `GET /api/license` — install-time data, separate from
   `/api/config`. Seats-in-use is `apiUsers.length`, never a stored
   counter.

4. **Recent Events card** — most recent N audit-log entries via
   `AuditApiService.query({ pageSize: N })`. Header has a `Last [N] events`
   selector (5 / 10 / 25 / 50). `.events-card > nb-card-body` has
   `max-height: 22rem; overflow-y: auto` so the list scrolls without
   pushing the grid below.

All timestamps in the Health tab route through `formatInZone` so they
respect the saved tz/dateFormat (audit log seconds-precision, license
expiry date-only). See `@core/CLAUDE.md` for the helper.

## Reserved / DEMO indicator pattern

When a UI element doesn't drive real behavior, mark it visibly. Three
flavors in use:

| Situation | Treatment | Example |
|---|---|---|
| Field with no consumer | `disabled` input + `<span class="label-help">Reserved — …</span>` | `firstDayOfWeek` in System → Configuration → General |
| Whole card section reserved | `<div class="info-banner">` at top of `.settings-body` explaining values persist but no subsystem reads them | Performance & Limits, Licensing (also display-only) |
| Mock data inside a real-data widget | `class="is-mock"` (dashed border) + `<span class="mock-tag">DEMO</span>` | (No live example — the original Service Status DEMO pills were retired in Phase 5c when real per-source pills replaced them. Re-introduce when a future widget needs to mix mock and real entries.) |

Why: silently storing a setting that doesn't drive behavior surfaces as
"I changed it but nothing happened" bug reports. Be honest up front.

## Lessons (page-specific)

### Modal lives outside its parent wrapper, not inside

The User Groups Add modal originally lived nested inside
`.account-tab.groups-tab` *and* its SCSS was scoped under `.account-tab`. The
combination broke modal positioning. Two valid placements:

1. Modal HTML outside `.account-tab` **and** modal SCSS at top level of
   `nb-install-component()`. (Current pattern for the User Groups and
   Account user modals — they're at the very top of `system.component.html`,
   above the `.system-container.ngx-system-fullbleed` wrapper.)
2. Modal HTML inside `.account-tab` **and** modal SCSS nested under
   `.account-tab`. Works but harder to reuse across tabs.

Pick one and stick with it per modal. Mixing breaks `position: fixed`.

### `[class*="col-"]` global rule eats grid cells

`one-column.layout.scss` has a `::ng-deep` rule that targets every class
starting with `col-` (intended for Bootstrap grid). On CSS-grid rows it
collapses cells to row width. The Account/Audit/Group tables use the
defensive override:

```scss
.users-row > [class*="col-"] {
  width: auto; max-width: none; flex: initial;
  padding-left: 0; padding-right: 0;
}
```

When adding a new grid table, copy that override or avoid `col-` prefix.

### CDK overlay vs modal z-index

`nb-select` dropdowns inside our modals only work because we lifted
`cdk-overlay-container` to `z-1200` globally (in `_layout.scss`).
If you change either z-index, keep the relationship intact:

```
modal-overlay (z-1100) < cdk-overlay-container (z-1200)
```

### System tabs share one component

`SystemComponent` is a single class with state for all six tabs (toolbar,
search, filters, modal state, settings models). This is intentional — the
tabs share a header, sidebar rail, and persistence patterns; splitting them
into separate route components would force more cross-component plumbing
than it's worth at this scale. If `SystemComponent` grows past ~1200 lines,
revisit.

## Table layout standard (mandatory for all data tables)

Every data table in the application follows this structure. Reference
implementation: **System → Account** (`SystemComponent.paginatedApiUsers`).
Apply it identically to new tables and any existing table that doesn't
already match.

### Visual structure

```
[Section title]                              [Refresh] [+ Add Resource]   ← header row
Your X are shown below. Click Edit to view and modify ...                  ← intro paragraph

┌────────────────────────────────────────────────────────────────────────┐
│ Display [10▼] Resources                              [search box]      │  ← top bar
├────────────────────────────────────────────────────────────────────────┤
│ Col1   Col2   Col3   ...                                                │  ← column headers
│ row 1  ...                                                              │
│ row 2  ...                                                              │
├────────────────────────────────────────────────────────────────────────┤
│ < 1 2 3 >                       Resources 1–10 of 24 (filtered from 38) │  ← bottom bar
└────────────────────────────────────────────────────────────────────────┘
```

### Top control bar (inside the table card, above the column headers)

Two slots:

- **Left**: literal `Display` + page-size `<nb-select>` + plural resource
  label (e.g. `Accounts`, `Groups`, `Events`, `Assets`).
  Page size options: `[10, 25, 50, 100]`. Default: `10`.
  - Tables with a small set of additional category/type filters that need
    to remain UI-accessible (e.g. Audit's Category dropdown) extend the
    left slot with a `·` divider followed by the extra control. Use
    `flex-wrap: wrap` (already in `.users-controls-left`) so it line-breaks
    gracefully.
- **Right**: search input — and *only* the search input — with placeholder
  `Search all fields`. Matches across **every visible column** using a
  lower-cased joined-string haystack — see Account tab.

**Don't add filter dropdowns to the right slot.** When in doubt, the
universal search is enough; only keep an explicit dropdown if it
materially helps the user (e.g. Audit's category is a top-level facet
worth single-clicking). Assets / Catalog deliberately removed its
type/source/domain/tag dropdowns once the search proved sufficient.

### Bottom bar (inside the table card)

Two slots:

- **Left**: pagination — `<` prev, page numbers, `>` next. Active page
  highlighted with `color-primary-transparent-100` background. Prev/next
  disabled at the edges.
- **Right**: count text `<Resources> N–M of TOTAL`. When a filter has
  narrowed the result set, append `(filtered from X)` so the user knows
  the broader total.

### Component-state convention

For a resource named `Foo`, the component owns:

- `fooPageSize: number = 10`
- `fooCurrentPage: number = 1`
- `readonly fooPageSizeOptions = [10, 25, 50, 100]`
- Getters: `filteredFoos`, `paginatedFoos`, `fooTotalPages`, `fooPageNumbers`,
  `fooPageStart`, `fooPageEnd`
- Methods: `setFooPage(p)`, `prevFooPage()`, `nextFooPage()`,
  `onFooSearchChange()`, `onFooPageSizeChange()`
- The two `on…Change()` handlers reset `fooCurrentPage = 1`.
- `paginatedFoos` clamps `fooCurrentPage` to `fooTotalPages` so a
  shrinking filter doesn't strand the user on an empty page.

### SCSS classes

Reuse the classes already defined in `system.component.scss`:

- `.account-intro` — the descriptive paragraph above the table.
- `.users-controls` — three-slot control bar (`grid-template-columns: auto minmax(0, 1fr) auto`).
- `.users-controls-left`, `.users-controls-search`, `.users-controls-pager`.
- `.page-num` (with `.active`).
- `.users-footer` and `.users-footer-count`.

If a table needs richer filters (multiple dropdowns), extend the middle
slot — don't add slots to the left/right.

### When adding a new table

Copy the `paginatedApiUsers` / `userPageNumbers` / `setUserPage` / etc.
block from `SystemComponent` and rename for the new resource. Reuse the
SCSS classes — don't reinvent.

## Conventions

- **Lazy load top-level pages.** `pages.module.ts` is loaded via
  `loadChildren` from `app-routing.module.ts`.
- **Mock data → real API.** New tabs should start with localStorage
  persistence and an inline mock array; migrate to `@core/api/<resource>.service.ts`
  when the backend lands.
- **Modal pattern**: position-fixed overlay with `z-1100`, dialog inside.
  See User Groups or Account user modal for shape.
- **No deep imports across pages.** A page module should be relocatable;
  shared pieces go in `@theme` or `@core`.

## Done / queued

- [x] Dashboard (three views, mock data)
- [x] Assets (catalog/domains/lineage stub)
- [x] System → Health (real API+DB pills, per-source pills, CPU/memory, audit-driven Recent Events) — Phase H + 5c
- [x] System → Account (real API, lockout protection)
- [x] System → User Groups (real API — Phase 2)
- [x] System → Security (real API — Phase 4)
- [x] System → Configuration (real API — Phase 4)
- [x] System → Audit (real API — Phase 3)
- [x] Wire User Groups to `/api/groups` — Phase 2
- [x] Wire Audit to `/api/audit` — Phase 3
- [x] Wire Security + Configuration to API — Phase 4
- [x] Wire Health page to `/api/health/check` + `/api/health/metrics` — Phase H
- [x] Wire Configuration → Data Sources card to `/api/sources` — Phase 5a
- [x] Wire Assets page to `/api/assets` (catalog + domains, with real lineage edges) — Phase 5a
- [x] Test / Sync buttons on Postgres sources (real connector) — Phase 5b
- [x] Source create/edit modal on Configuration → Data Sources card — Phase 5b follow-up
- [x] Per-source health pills on Health tab; DEMO pills retired — Phase 5c
- [ ] Wire Notifications & Email card (still Reserved until delivery subsystem ships)
- [ ] Live Dashboard via WebSocket — Phase 6
