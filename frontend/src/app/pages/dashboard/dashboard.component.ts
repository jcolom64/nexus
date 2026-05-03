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
  private apiRecentEvents: ApiAuditEntry[] = [];
  private apiFailures: ApiAuditEntry[] = [];
  failuresTotal = 0; // template-bound on the Failures view header

  // Derived view-state, recomputed in `recompute()` after each fetch and
  // on tz/fmt change.
  overviewKpis: KpiTile[] = [];
  topSources: TopSource[] = [];
  recentFeed: FeedEvent[] = [];
  sourceStats: { label: string; count: number; status: Severity }[] = [];
  sourceCards: SourceCard[] = [];
  failures: FeedEvent[] = [];

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
      sources:       this.sourcesApi.list(),
      assets:        this.assetsApi.list(),
      users:         this.usersApi.list(),
      recentEvents:  this.auditApi.query({ pageSize: 10, page: 1 }),
      failures:      this.auditApi.query({ pageSize: 10, page: 1, outcome: 'FAILED' }),
    }).subscribe({
      next: ({ sources, assets, users, recentEvents, failures }) => {
        this.apiSources       = sources;
        this.apiAssets        = assets;
        this.apiUsers         = users;
        this.apiRecentEvents  = recentEvents.entries;
        this.apiFailures      = failures.entries;
        this.failuresTotal    = failures.total;
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

    this.overviewKpis = this.computeKpis();
    this.topSources   = this.computeTopSources();
    this.recentFeed   = this.apiRecentEvents.map((e) => this.toFeedEvent(e, tz, fmt));
    this.sourceStats  = this.computeSourceStats();
    this.sourceCards  = this.apiSources.map((s) => this.toSourceCard(s, tz, fmt));
    this.failures     = this.apiFailures.map((e) => this.toFeedEvent(e, tz, fmt));
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
          : 'See Recent Failures tab.',
        status: failuresStatus,
        icon: 'alert-triangle-outline',
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
