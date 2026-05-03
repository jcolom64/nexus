# @theme — UI shell, layout tokens, theming

## What lives here

```
@theme/
├── CLAUDE.md
├── theme.module.ts                ← shared Nebular modules + FormsModule
├── components/
│   ├── header/                    ← logo, theme toggle, profile modal, user menu
│   └── footer/
├── layouts/
│   ├── one-column/                ← used by everything in /pages
│   ├── two-columns/
│   └── three-columns/
├── pipes/                         ← capitalize, plural, round, timing, number-with-commas
└── styles/
    ├── themes.scss                ← theme registrations + token overrides
    ├── _layout.scss               ← global layout rules (loaded via styles.scss)
    ├── _overrides.scss            ← Nebular component tweaks
    ├── styles.scss                ← entry point
    └── pace.theme.scss            ← page-load progress bar
```

## Layout tokens (the most important file)

`styles/themes.scss` registers four themes (default/dark/cosmic/corporate)
but the cosmic and corporate variants are not user-selectable — only
`default` and `dark` are. The other two are kept registered to avoid
breaking `nb-theme()` lookups inside the Nebular SCSS.

The same file overrides several Nebular layout tokens. **All layout sizing
flows from these — don't hardcode pixel/rem values elsewhere.**

| Token              | Override   | Default              | Why                                            |
|--------------------|------------|----------------------|------------------------------------------------|
| `sidebar-width`    | `10rem`    | `16rem`              | Tighter rail for short menu labels             |
| `header-height`    | `2.25rem`  | `4.75rem`            | Slimmer header                                 |
| `header-padding`   | `0 1rem`   | `1.25rem 1.125rem`   | Vertically centered content in slim header     |

Changing any of these cascades to:

- Visual sidebar/header (Nebular reads tokens directly).
- `.ngx-system-fullbleed` `top` and `left` offsets in `_layout.scss`.
- Body `min-width` (so the window can't shrink below the sidebar).
- The `:has()` rules that push `nb-layout-column.main-content` right of the
  sidebar.
- The system page's tab content area.

## Header

`components/header/`. One of the larger components — handles logo, version,
What's-New button, theme toggle, user dropdown, **and** the profile modal.

### App-name binding

The `Nexus` text next to the logo is bound to the `appName` field, which
subscribes to `SystemConfigStore.config$` (`@core/utils/system-config.store.ts`)
and tracks `appNameOverride`. Falls back to `'Nexus'` if the store hasn't
loaded yet (pre-auth) or the override is blank. Saving an app-name change
in System → Configuration propagates here within the same change-detection
cycle — no reload needed.

### Profile modal

The "Profile" item in the user-menu context menu opens a self-contained
modal embedded in the header template. Modal markup is *outside* the header
component's flex container, with `position: fixed; z-index: 1100`. It edits
a local `UserProfile` object hydrated from `localStorage`
(`nexus-user-profile`) on init, and re-hydrated from `GET /api/auth/me`
whenever the auth token changes (the JWT carries email/role but not
displayName, so we fetch).

Save behaviour is hybrid:

- **Display name** is the only field that round-trips to the server. On
  save, if it changed, the modal calls `usersApi.updateMe({ name })` →
  `PATCH /api/users/me`. localStorage is then written for everything else.
- **Email** is read-only in the modal. `PATCH /users/me` deliberately
  doesn't accept email changes (privilege-escalation vector); admins can
  change a user's email via `PATCH /users/:id` from System → Account.
- **Job title, locale, timezone, date format, email digest, notification
  toggles, MFA toggle** stay in localStorage. They aren't read by any
  feature today and there's no `UserPreferences` model; an info-banner
  in the modal labels them honestly so the user knows what syncs.

When a `UserPreferences` model lands, those fields move out of
localStorage and through `usersApi.updateMe` (or a sibling
`PATCH /users/me/preferences`).

### Theme toggle

Small sun/moon slide toggle (40 × 20 px), not a dropdown. Sits between
"What's New" and the user avatar. Replaces the original 4-option select.

Click flips between `default` and `dark`, persisted via `SettingsService`.
Legacy `cosmic`/`corporate` values in localStorage are coerced to
`default` on init.

Also driven from System → Configuration: when an admin saves a new
`defaultTheme` there, `SystemComponent.saveSystemConfig()` calls
`settingsService.setTheme(...)` so the active session reflects the change
immediately (otherwise the help text "applied to new users" leaves admins
puzzled when their own theme doesn't change).

## Footer

`components/footer/`. Has two pieces:

- **Clock** (left): live `<timezone> · <formatted-date> HH:mm`, ticking
  once a minute. Subscribes to `SystemConfigStore.config$` for the
  timezone + date format; uses `formatInZone` from `@core/utils`.
- **Socials** (right): vestigial GitHub/Facebook/Twitter/LinkedIn icons.

The clock is the simplest demonstration that
`systemConfig.defaultTimezone` + `systemConfig.dateFormat` actually drive
something visible — every other usage is per-page (Audit, Account,
Groups timestamps).

## Layouts

Three layouts ship; only `one-column` is in active use. The pages module's
`PagesComponent` template wraps `<router-outlet>` in `<ngx-one-column-layout>`.

`one-column.layout.ts` template:

```html
<nb-layout windowMode>
  <nb-layout-header fixed><ngx-header></ngx-header></nb-layout-header>
  <nb-sidebar class="menu-sidebar" tag="menu-sidebar" start
              responsive [collapsedBreakpoints]="[]">
    <ng-content></ng-content>
  </nb-sidebar>
  <nb-layout-column class="main-content"><ng-content select="router-outlet"></ng-content></nb-layout-column>
  <nb-layout-footer fixed><ngx-footer></ngx-footer></nb-layout-footer>
</nb-layout>
```

Key behaviors:

- `responsive [collapsedBreakpoints]="[]"` — sidebar auto-compacts on
  smaller viewports but never fully collapses.
- The TS file's `adjustContentArea()` reads the sidebar's state class
  (`expanded`/`compacted`/`collapsed`) and sets inline `margin-left` /
  `width` on `.main-content`. **Don't measure the sidebar's
  `getBoundingClientRect()` here** — during the 300 ms transition that
  returns intermediate values and the column lands at the wrong margin.
  We learned this the hard way; the comment in the file documents it.
- A pure-CSS counterpart exists in `_layout.scss` using
  `nb-layout:has(nb-sidebar.expanded|.compacted|.collapsed)` — belt-and-
  suspenders for cases where the JS misses an event.

## Lessons (theme/layout-specific)

### `:has()` for sidebar state

Nebular puts `expanded`/`compacted`/`collapsed` host classes on
`<nb-sidebar>`, not on `<nb-layout>`. To react from the layout root use
`:has()`:

```scss
nb-layout:has(nb-sidebar.compacted) .ngx-system-fullbleed {
  left: nb-theme(sidebar-width-compact);
}
```

This is the canonical pattern — used for the System page's full-bleed
content offset and for the column resize.

### CDK overlay must beat the modal

`cdk-overlay-container` is `z-1040` by default. Modal overlays in this
project sit at `z-1100`. Without lifting the CDK container, `nb-select`
dropdowns inside a modal open *behind* the modal's dimmer and look like
nothing happened. `_layout.scss` lifts it to `z-1200`. **Don't remove
that rule.**

### Body min-width prevents sidebar overflow

`_layout.scss` sets `html, body { min-width: nb-theme(sidebar-width) }`.
When the user shrinks the window narrower than the sidebar, they get a
horizontal scrollbar instead of the sidebar overlapping content.

### Full-bleed pages need top-level fixed positioning

The System page uses `.ngx-system-fullbleed` to fill the visible content
area regardless of how the column is sized by JS or media queries. The
class lives in `_layout.scss`, not in the system component, because it
needs to escape any parent stacking context. Pattern: `position: fixed`
with `top/right/bottom/left` driven by theme tokens, plus `:has()` rules
to react to sidebar state.

## Conventions

- **Don't hardcode layout dimensions.** Always reference `nb-theme(token)`.
- **Add new tokens in `themes.scss`** — once for each of the four registered
  themes (use `replace_all` carefully).
- **No `style="..."` attributes for sizing.** Use SCSS classes or theme tokens.
- **Header is the only place the user identity surfaces** in chrome. New
  identity-aware UI elsewhere should subscribe to `NbAuthService.onTokenChange()`.

## Done / queued

- [x] Slim header (2.25rem) via theme tokens
- [x] Theme dropdown → sun/moon toggle (light + dark only)
- [x] Profile modal in header (localStorage-backed)
- [x] Sidebar narrowed to 10rem; body min-width matches
- [x] Pure-CSS column resize via `:has(nb-sidebar.…)`
- [x] CDK overlay z-index lifted to 1200
- [x] System full-bleed page positioned via theme tokens
- [x] Header app-name bound to `SystemConfigStore` (Phase 4)
- [x] Footer clock driven by `systemConfig` tz + dateFormat (Phase 4)
- [x] Wire profile display-name to `PATCH /api/users/me` (other fields still localStorage-only pending a `UserPreferences` model)
- [ ] Mobile breakpoint review — currently desktop-tuned
