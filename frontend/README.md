# Nexus — frontend

Angular 10 dashboard for the Nexus data-concentrator admin tool, backed by
the NestJS API at [`../backend/`](../backend/).

The project was bootstrapped from the [ngx-admin starter](https://github.com/akveo/ngx-admin)
and has since been heavily reworked — most pages, look-and-feel, navigation,
and auth flow are Nexus-specific.

## Quick start

For a full quick-start (frontend + backend + Postgres), see the
[root README](../README.md). Frontend-only:

```bash
npm install --legacy-peer-deps    # see ../CLAUDE.md lesson #8 for why
npm start                         # dev server on :4204
npm run build                     # production bundle in dist/
npm test                          # karma + jasmine
```

The dev server expects the backend at `http://localhost:3001/api` (set in
`src/environments/environment.ts`).

## What's where

```
frontend/
├── src/app/
│   ├── @core/      ← singleton services, auth, API clients   (CLAUDE.md)
│   ├── @theme/     ← layout, header, footer, theme tokens    (CLAUDE.md)
│   └── pages/      ← dashboard, assets, system tabs          (CLAUDE.md)
├── src/environments/
└── angular.json, tsconfig.*, package.json, …
```

Each marked subdirectory has its own `CLAUDE.md` with conventions and
architecture notes specific to that area.

## Conventions

- **No HTTP outside `@core/api/`.** Components consume services; services
  call `HttpClient`.
- **No business logic in components.** Push it to `@core` services or
  page-level helpers.
- **Timestamps go through `formatInZone`** (`@core/utils/date-format.ts`)
  so they honour the user's saved timezone + date format.
- **`localStorage` is being phased out** as real APIs land. Only the
  user-profile modal still uses it; everything else (theme aside) routes
  through `@core/api/*` or `SystemConfigStore`.

See the per-directory CLAUDE.md files for narrower guidance and the
[root CLAUDE.md](../CLAUDE.md) for project-wide architecture and the
phase plan.
