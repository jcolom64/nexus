# src/app — Angular application root

Top-level Angular module. Most details live in subdirectory CLAUDE.md files
— this file is just a router.

## Structure

```
src/app/
├── CLAUDE.md                 ← you are here
├── app.module.ts             ← root module: CoreModule, ThemeModule, HttpClientModule
├── app.component.ts          ← <ngx-app><router-outlet/></ngx-app>
├── app-routing.module.ts     ← / → /pages, /auth/* (Nebular built-ins), AuthGuard on /pages
├── @core/                    ← see @core/CLAUDE.md
├── @theme/                   ← see @theme/CLAUDE.md
└── pages/                    ← see pages/CLAUDE.md
```

## App-level wiring

- **`AppModule`** imports `CoreModule.forRoot()` (singleton services) and
  `ThemeModule.forRoot()` (Nebular theme registration with default theme
  `'default'`). Also `HttpClientModule` (used by the auth strategy and API
  services).
- **`app-routing.module.ts`** routes:
  - `/auth/**` → Nebular's prebuilt login/register/reset components.
  - `/pages/**` → lazy-loaded `PagesModule`, gated by `AuthGuard`.
  - `''` → redirects to `/pages`.
  - `**` → catch-all redirects to `/pages` (which redirects again to
    `/auth/login` if no token).

That's the whole app shell. Everything else lives in the three subdirectories.

## When to edit this layer

- **Adding a global module/provider**: edit `app.module.ts` *if* it must be
  truly global. Most things belong in `@core` or `@theme` instead.
- **Adding a top-level route**: edit `app-routing.module.ts` only for routes
  outside `/pages` and `/auth` (e.g. a public landing page). Internal pages
  go in `pages-routing.module.ts`.
- **Auth flow change**: usually `@core/core.module.ts` (strategy config) or
  `@core/auth.guard.ts`. The app-routing only attaches the guard.

## Conventions

- **No business logic here.** Anything heavier than module wiring belongs
  in a service in `@core` or a feature module under `pages/`.
- **No new mocks.** The legacy mocks under `@core/mock/` are being phased
  out as real APIs land.
