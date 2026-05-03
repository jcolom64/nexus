import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ApiAsset, AssetsApiService } from '../../@core/api/assets-api.service';
import { ApiSource, SourcesApiService } from '../../@core/api/sources-api.service';
import { ApiUser, UsersApiService } from '../../@core/api/users-api.service';
import {
  ApiAuditCategory,
  ApiAuditEntry,
  AuditApiService,
} from '../../@core/api/audit-api.service';
import { SystemConfigStore, formatInZone } from '../../@core/utils';

type Severity = 'success' | 'info' | 'warning' | 'danger';
type SourceStatus = 'connected' | 'degraded' | 'disconnected' | 'stale';

interface KpiTile {
  label: string;
  value: string;
  hint: string;
  status: Severity;
  icon: string;
  trend?: number[]; // optional sparkline series — only the failures tile carries one today
}

interface CategoryTile {
  category: ApiAuditCategory;
  label: string;
  count: number;
}

interface TopSource {
  sourceId: string;
  name: string;
  type: string;
  rowCount: number;
  fillPct: number;
}

interface FeedEvent {
  id: string;
  timestamp: string;          // ISO — used for tz/fmt reflow
  displayTime: string;        // formatted via formatInZone
  category: ApiAuditCategory;
  severity: Severity;
  source: string;
  message: string;
}

interface SourceCard {
  id: string;
  name: string;
  type: string;
  status: SourceStatus;
  lastSyncDisplay: string;
  hasCredentials: boolean;
}

@Component({
  selector: 'ngx-dashboard',
  styleUrls: ['./dashboard.component.scss'],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {

  private readonly destroy$ = new Subject<void>();

  views: { id: 'overview' | 'sources' | 'failures'; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview',         icon: 'grid-outline' },
    { id: 'sources',  label: 'Data Sources',     icon: 'hard-drive-outline' },
    { id: 'failures', label: 'Recent Failures',  icon: 'alert-triangle-outline' },
  ];

  activeView: 'overview' | 'sources' | 'failures' = 'overview';

  // Section-level loading/error so each card can render independently. The
  // initial fetch fires them in parallel through forkJoin; refresh() reuses
  // the same code path.
  loading = true;
  error: string | null = null;

  // Raw API state — kept around so we can recompute derived views without
  // re-fetching (e.g. when SystemConfigStore tz/fmt changes).
  private apiSources: ApiSource[] = [];
  private apiAssets: ApiAsset[] = [];
  private apiUsers: ApiUser[] = [];
  // Wide audit pages we bucket client-side. 1000-row pages are fine for dev
  // volume; if production volume grows we'd add a `/api/audit/hourly`
  // aggregation endpoint instead of bigger pages.
  private apiActivity: ApiAuditEntry[] = []; // all categories, last 24h-ish
  private apiFailures: ApiAuditEntry[] = []; // outcome=FAILED, last ~200
  failuresTotal = 0; // template-bound — total all-time, not per-page

  // Derived view-state, recomputed in `recompute()` after each fetch and
  // on tz/fmt change.
  overviewKpis: KpiTile[] = [];
  topSources: TopSource[] = [];
  hourlyActivity: number[] = [];
  hourlyPeak = 0;
  sourceStats: { label: string; count: number; status: Severity }[] = [];
  sourceCards: SourceCard[] = [];
  failures: FeedEvent[] = [];
  failureCategoryTiles: CategoryTile[] = [];
  private failures7Day: number[] = [];

  // Config-driven formatting inputs cached so we know when to reflow.
  private lastTz = 'UTC';
  private lastFmt = 'YYYY-MM-DD';

  constructor(
    private readonly sourcesApi: SourcesApiService,
    private readonly assetsApi: AssetsApiService,
    private readonly usersApi: UsersApiService,
    private readonly auditApi: AuditApiService,
    private readonly configStore: SystemConfigStore,
  ) {}

  ngOnInit(): void {
    this.refresh();
    // If the user changes timezone or date format on System → Configuration,
    // reformat the timestamps we already hold without refetching.
    this.configStore.config$.pipe(takeUntil(this.destroy$)).subscribe((c) => {
      const tz = c?.defaultTimezone || 'UTC';
      const fmt = c?.dateFormat || 'YYYY-MM-DD';
      if (tz === this.lastTz && fmt === this.lastFmt) return;
      this.lastTz = tz;
      this.lastFmt = fmt;
      this.recompute();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      sources:  this.sourcesApi.list(),
      assets:   this.assetsApi.list(),
      users:    this.usersApi.list(),
      // Activity feed for the 24h hourly chart — wide enough that the bucket
      // covers a full day at typical dev volume. We filter to the last 24h
      // client-side; older entries in the page are ignored.
      activity: this.auditApi.query({ pageSize: 1000, page: 1 }),
      // Failures power the KPI tile total, the 7-day mini-bar trend, the
      // category severity tiles, and the Recent Failures list (top 10 of
      // these). pageSize=200 covers a comfortable 7-day window in dev.
      failures: this.auditApi.query({ pageSize: 200, page: 1, outcome: 'FAILED' }),
    }).subscribe({
      next: ({ sources, assets, users, activity, failures }) => {
        this.apiSources    = sources;
        this.apiAssets     = assets;
        this.apiUsers      = users;
        this.apiActivity   = activity.entries;
        this.apiFailures   = failures.entries;
        this.failuresTotal = failures.total;
        this.recompute();
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || err?.message || 'Failed to load dashboard';
        this.loading = false;
      },
    });
  }

  setView(v: 'overview' | 'sources' | 'failures'): void {
    this.activeView = v;
  }

  // ---- Derived views ----------------------------------------------------

  private recompute(): void {
    const tz = this.configStore.value?.defaultTimezone || 'UTC';
    const fmt = this.configStore.value?.dateFormat || 'YYYY-MM-DD';
    this.lastTz = tz;
    this.lastFmt = fmt;

    // Compute time-series first so the KPI tile can consume failures7Day.
    this.hourlyActivity        = this.bucketHourly(this.apiActivity);
    this.hourlyPeak            = Math.max(0, ...this.hourlyActivity);
    this.failures7Day          = this.bucketFailuresByDay(this.apiFailures);
    this.failureCategoryTiles  = this.computeFailureCategories(this.apiFailures);

    this.overviewKpis = this.computeKpis();
    this.topSources   = this.computeTopSources();
    this.sourceStats  = this.computeSourceStats();
    this.sourceCards  = this.apiSources.map((s) => this.toSourceCard(s, tz, fmt));
    // Recent Failures list shows the 10 most recent regardless of age,
    // not just the past 7 days.
    this.failures     = this.apiFailures.slice(0, 10).map((e) => this.toFeedEvent(e, tz, fmt));
  }

  private computeKpis(): KpiTile[] {
    const connected = this.apiSources.filter((s) => s.status === 'CONNECTED').length;
    const total = this.apiSources.length;
    const degraded = this.apiSources.filter((s) => s.status === 'DEGRADED').length;
    const failuresStatus: Severity =
      this.failuresTotal === 0 ? 'success'
        : this.failuresTotal < 5 ? 'warning'
        : 'danger';
    const connStatus: Severity =
      total === 0 ? 'info'
        : connected === total ? 'success'
        : (total - connected) <= 1 ? 'warning'
        : 'danger';
    return [
      {
        label: 'Connected sources',
        value: total === 0 ? '—' : `${connected} / ${total}`,
        hint: total === 0
          ? 'Register a source in Configuration → Data Sources.'
          : (degraded > 0 ? `${degraded} degraded` : 'All healthy'),
        status: connStatus,
        icon: 'hard-drive-outline',
      },
      {
        label: 'Registered assets',
        value: this.formatRecords(this.apiAssets.length),
        hint: this.apiAssets.length === 0
          ? 'Run Sync on a source to discover assets.'
          : `${this.formatRecords(this.totalRowCount())} rows tracked`,
        status: 'info',
        icon: 'cube-outline',
      },
      {
        label: 'Users',
        value: this.apiUsers.length.toString(),
        hint: `${this.apiUsers.filter((u) => u.state === 'ACTIVE').length} active`,
        status: 'info',
        icon: 'people-outline',
      },
      {
        label: 'Recent failures',
        value: this.failuresTotal.toString(),
        hint: this.failuresTotal === 0
          ? 'No FAILED audit entries.'
          : 'Last 7 days shown.',
        status: failuresStatus,
        icon: 'alert-triangle-outline',
        trend: this.failures7Day,
      },
    ];
  }

  private computeTopSources(): TopSource[] {
    const byId = new Map<string, { sourceId: string; name: string; type: string; rowCount: number }>();
    for (const a of this.apiAssets) {
      const ent = byId.get(a.sourceId);
      if (ent) {
        ent.rowCount += a.rowCount;
      } else {
        byId.set(a.sourceId, {
          sourceId: a.sourceId,
          name: a.sourceName,
          type: this.sourceTypeFor(a.sourceId),
          rowCount: a.rowCount,
        });
      }
    }
    const rows = [...byId.values()].sort((a, b) => b.rowCount - a.rowCount).slice(0, 5);
    const max = Math.max(1, ...rows.map((r) => r.rowCount));
    return rows.map((r) => ({
      ...r,
      fillPct: Math.max(4, Math.round((r.rowCount / max) * 100)),
    }));
  }

  private sourceTypeFor(sourceId: string): string {
    const s = this.apiSources.find((x) => x.id === sourceId);
    return s ? s.type.toLowerCase() : '—';
  }

  private totalRowCount(): number {
    return this.apiAssets.reduce((sum, a) => sum + (a.rowCount || 0), 0);
  }

  private toFeedEvent(e: ApiAuditEntry, tz: string, fmt: string): FeedEvent {
    const severity: Severity =
      e.outcome === 'FAILED' ? 'danger'
        : e.outcome === 'WARNING' ? 'warning'
        : 'info';
    return {
      id: e.id,
      timestamp: e.timestamp,
      displayTime: formatInZone(new Date(e.timestamp), tz, fmt, { seconds: true }),
      category: e.category,
      severity,
      source: e.actorName || e.actorEmail,
      message: `${e.action.toLowerCase()} ${e.resourceType.toLowerCase()}: ${e.resource}`,
    };
  }

  private computeSourceStats(): { label: string; count: number; status: Severity }[] {
    const connected = this.apiSources.filter((s) => s.status === 'CONNECTED').length;
    const degraded = this.apiSources.filter((s) => s.status === 'DEGRADED').length;
    const disconnected = this.apiSources.filter((s) => s.status === 'DISCONNECTED').length;
    // Count anything the server flagged STALE plus any source whose
    // lastSyncAt is over an hour ago. Two signals that mean the same thing.
    const stale = this.apiSources.filter(
      (s) => s.status === 'STALE' || this.staleByTime(s.lastSyncAt),
    ).length;
    return [
      { label: 'Connected',    count: connected,    status: 'success' },
      { label: 'Degraded',     count: degraded,     status: 'warning' },
      { label: 'Disconnected', count: disconnected, status: 'danger'  },
      { label: 'Stale (>1h)',  count: stale,        status: 'info'    },
    ];
  }

  private staleByTime(lastSyncAt: string | null): boolean {
    if (!lastSyncAt) return false;
    return (Date.now() - new Date(lastSyncAt).getTime()) > 60 * 60 * 1000;
  }

  private toSourceCard(s: ApiSource, tz: string, fmt: string): SourceCard {
    return {
      id: s.id,
      name: s.name,
      type: s.type.toLowerCase(),
      status: s.status.toLowerCase() as SourceStatus,
      lastSyncDisplay: s.lastSyncAt
        ? formatInZone(new Date(s.lastSyncAt), tz, fmt)
        : 'Never synced',
      hasCredentials: s.hasCredentials,
    };
  }

  // ---- Time-series bucketing --------------------------------------------

  // Bucket the activity feed into 24 hourly counts, oldest → newest. The
  // rightmost bucket is the current hour. Anything older than 24h or in a
  // future-skewed clock is dropped.
  private bucketHourly(events: ApiAuditEntry[]): number[] {
    const now = new Date();
    // Anchor at the start of the *current* hour so a steady stream produces
    // 24 bins regardless of where in the hour we are.
    const currentHourStart = new Date(now);
    currentHourStart.setMinutes(0, 0, 0);
    const bins = new Array(24).fill(0);
    for (const e of events) {
      const t = new Date(e.timestamp).getTime();
      const offset = currentHourStart.getTime() - t;
      if (offset < 0) continue;             // future-skewed
      const hoursAgo = Math.floor(offset / (60 * 60 * 1000));
      if (hoursAgo >= 24) continue;         // outside the window
      // hoursAgo=0 = current hour = rightmost bin (index 23)
      bins[23 - hoursAgo] += 1;
    }
    return bins;
  }

  // Bucket failures into 7 daily counts, oldest → newest. Like the hourly
  // bucket above, this is anchored at start-of-today.
  private bucketFailuresByDay(events: ApiAuditEntry[]): number[] {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const bins = new Array(7).fill(0);
    for (const e of events) {
      const t = new Date(e.timestamp).getTime();
      const offset = todayStart.getTime() - t;
      const daysAgo = Math.floor(offset / (24 * 60 * 60 * 1000));
      // daysAgo=-1 means it landed today (after todayStart). Treat as bin 6.
      if (daysAgo < -1 || daysAgo >= 7) continue;
      const idx = daysAgo < 0 ? 6 : 6 - daysAgo;
      bins[idx] += 1;
    }
    return bins;
  }

  // Five tiles, one per audit category, counting entries from the last 7
  // days of failures. Categories with zero failures still render so the
  // row stays a stable shape.
  private computeFailureCategories(events: ApiAuditEntry[]): CategoryTile[] {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const categories: ApiAuditCategory[] = ['AUTH', 'USER', 'CONFIG', 'DATA', 'SECURITY'];
    const counts = new Map<ApiAuditCategory, number>(categories.map((c) => [c, 0]));
    for (const e of events) {
      const t = new Date(e.timestamp).getTime();
      if (t < sevenDaysAgo) continue;
      counts.set(e.category, (counts.get(e.category) || 0) + 1);
    }
    return categories.map((c) => ({
      category: c,
      label: c.charAt(0) + c.slice(1).toLowerCase(),
      count: counts.get(c) || 0,
    }));
  }

  // ---- Sparkline path generators ----------------------------------------

  // Returns an SVG path for a 100x30 viewBox sparkline. Keep these here
  // instead of in a directive — three sites use them, all in this file.
  sparklinePath(values: number[]): string {
    if (!values.length) return '';
    const w = 100;
    const h = 30;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = w / Math.max(1, values.length - 1);
    return values
      .map((v, i) => {
        const x = i * step;
        const y = h - ((v - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  sparklineArea(values: number[]): string {
    const path = this.sparklinePath(values);
    if (!path) return '';
    return `${path} L 100 30 L 0 30 Z`;
  }

  // True if the trend is non-empty AND has at least one non-zero bin.
  // Sparklining 24 zeros is just a flat line — the empty hint is more
  // informative.
  hasTrendData(values: number[] | undefined): boolean {
    if (!values?.length) return false;
    return values.some((v) => v > 0);
  }

  // ---- Helpers -----------------------------------------------------------

  trackKpi(_i: number, k: KpiTile): string { return k.label; }
  trackTopSource(_i: number, t: TopSource): string { return t.sourceId; }
  trackFeedEvent(_i: number, e: FeedEvent): string { return e.id; }
  trackSourceCard(_i: number, c: SourceCard): string { return c.id; }
  trackSourceStat(_i: number, s: { label: string }): string { return s.label; }

  formatRecords(n: number): string {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  statusIcon(s: Severity): string {
    switch (s) {
      case 'success': return 'checkmark-circle-2-outline';
      case 'info':    return 'info-outline';
      case 'warning': return 'alert-triangle-outline';
      case 'danger':  return 'close-circle-outline';
    }
  }

  sourceStatusPillState(s: SourceStatus): 'active' | 'invited' | 'suspended' {
    switch (s) {
      case 'connected':    return 'active';
      case 'degraded':     return 'invited';
      case 'stale':        return 'invited';
      case 'disconnected': return 'suspended';
    }
  }

  sourceStatusLabel(s: SourceStatus): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
