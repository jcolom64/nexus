import { Component } from '@angular/core';

type Severity = 'success' | 'info' | 'warning' | 'danger';
type SourceStatus = 'connected' | 'degraded' | 'disconnected';

interface KpiTile {
  label: string;
  value: string;
  delta: number;
  trend: number[];
  status: Severity;
}

interface TopSource {
  name: string;
  type: string;
  records: number;
  fillPct: number;
}

interface FeedEvent {
  time: string;
  severity: Severity;
  source: string;
  message: string;
}

interface DataSourceCard {
  name: string;
  type: string;
  status: SourceStatus;
  latencyMs: number;
  uptimePct: number;
  throughput: number;
  trend: number[];
}

interface Alert {
  id: string;
  severity: Severity;
  title: string;
  source: string;
  age: string;
  acknowledged: boolean;
}

@Component({
  selector: 'ngx-dashboard',
  styleUrls: ['./dashboard.component.scss'],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {

  views: { id: 'overview' | 'sources' | 'alerts'; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview',     icon: 'grid-outline' },
    { id: 'sources',  label: 'Data Sources', icon: 'hard-drive-outline' },
    { id: 'alerts',   label: 'Alerts',       icon: 'bell-outline' },
  ];

  activeView: 'overview' | 'sources' | 'alerts' = 'overview';

  // ---- Overview ----------------------------------------------------------

  overviewKpis: KpiTile[] = [
    {
      label: 'Connected Sources',
      value: '12 / 14',
      delta: 0,
      trend: [11, 12, 12, 12, 11, 12, 12, 13, 13, 13, 13, 12, 12, 12],
      status: 'info',
    },
    {
      label: 'Records Ingested (24h)',
      value: '4.82M',
      delta: 8.4,
      trend: [120, 138, 142, 156, 170, 161, 184, 199, 210, 224, 218, 232, 245, 268, 271, 280, 289, 295, 302, 311, 318, 326, 334, 341],
      status: 'success',
    },
    {
      label: 'Avg Ingest Latency',
      value: '142 ms',
      delta: -4.1,
      trend: [180, 178, 175, 168, 165, 162, 158, 154, 152, 150, 148, 146, 144, 142],
      status: 'success',
    },
    {
      label: 'Error Rate',
      value: '0.27%',
      delta: 12.6,
      trend: [0.18, 0.19, 0.21, 0.20, 0.22, 0.24, 0.25, 0.27, 0.27, 0.28, 0.27, 0.26, 0.27, 0.27],
      status: 'warning',
    },
  ];

  hourlyThroughput: number[] = [
    180, 192, 175, 168, 156, 142, 130, 145, 168, 195, 220,
    245, 268, 282, 271, 263, 258, 247, 232, 218, 205, 198,
    192, 187,
  ];

  topSources: TopSource[] = [
    { name: 'orders-db',           type: 'postgres',  records: 1_420_000, fillPct: 100 },
    { name: 'analytics-warehouse', type: 'snowflake', records: 1_180_000, fillPct: 83 },
    { name: 'metrics-stream',      type: 'kafka',     records:   870_000, fillPct: 61 },
    { name: 'object-store',        type: 's3',        records:   712_000, fillPct: 50 },
    { name: 'partner-api',         type: 'rest-api',  records:   315_000, fillPct: 22 },
  ];

  recentFeed: FeedEvent[] = [
    { time: '14:32', severity: 'warning', source: 'metrics-stream', message: 'Consumer lag exceeded 30s threshold' },
    { time: '14:18', severity: 'info',    source: 'platform',       message: 'Auto-scaled ingestion pool 4 → 6' },
    { time: '13:55', severity: 'success', source: 'scheduler',      message: 'Nightly checkpoint completed in 4m 12s' },
    { time: '13:21', severity: 'info',    source: 'auth',           message: 'Token signing key rotated' },
    { time: '12:04', severity: 'danger',  source: 'partner-api',    message: 'Connector failed after 3 retries' },
    { time: '11:47', severity: 'success', source: 'deploy',         message: 'Release v1.0.0 promoted to production' },
  ];

  // ---- Data Sources ------------------------------------------------------

  sourceStats: { label: string; count: number; status: Severity }[] = [
    { label: 'Connected',     count: 4, status: 'success' },
    { label: 'Degraded',      count: 1, status: 'warning' },
    { label: 'Disconnected',  count: 1, status: 'danger' },
    { label: 'Stale (>1h)',   count: 1, status: 'info' },
  ];

  dataSourceCards: DataSourceCard[] = [
    { name: 'orders-db',           type: 'postgres',  status: 'connected',    latencyMs: 18,  uptimePct: 99.98, throughput: 1420, trend: [1100,1180,1240,1310,1320,1380,1400,1410,1420,1420,1430,1420] },
    { name: 'analytics-warehouse', type: 'snowflake', status: 'connected',    latencyMs: 312, uptimePct: 99.91, throughput: 1180, trend: [900,950,1000,1080,1120,1150,1170,1180,1190,1180,1180,1180] },
    { name: 'metrics-stream',      type: 'kafka',     status: 'degraded',     latencyMs: 84,  uptimePct: 98.4,  throughput: 870,  trend: [750,820,860,890,920,950,920,890,870,860,850,830] },
    { name: 'object-store',        type: 's3',        status: 'connected',    latencyMs: 45,  uptimePct: 99.99, throughput: 712,  trend: [550,600,640,680,700,710,712,712,712,710,712,712] },
    { name: 'partner-api',         type: 'rest-api',  status: 'disconnected', latencyMs: 0,   uptimePct: 92.1,  throughput: 0,    trend: [240,260,280,300,310,315,200,100,50,20,10,0] },
    { name: 'session-cache',       type: 'redis',     status: 'connected',    latencyMs: 2,   uptimePct: 99.99, throughput: 4200, trend: [3800,3900,4000,4100,4150,4200,4200,4200,4200,4180,4200,4200] },
  ];

  // ---- Alerts ------------------------------------------------------------

  alertCounts: { label: string; count: number; status: Severity }[] = [
    { label: 'Critical',  count: 1, status: 'danger' },
    { label: 'Warning',   count: 4, status: 'warning' },
    { label: 'Info',      count: 7, status: 'info' },
    { label: 'Resolved (24h)', count: 12, status: 'success' },
  ];

  activeAlerts: Alert[] = [
    { id: 'a-101', severity: 'danger',  title: 'partner-api connector down for 24m',          source: 'partner-api',    age: '24m',  acknowledged: false },
    { id: 'a-102', severity: 'warning', title: 'Consumer lag exceeded 30s on metrics-stream',  source: 'metrics-stream', age: '38m',  acknowledged: true  },
    { id: 'a-103', severity: 'warning', title: 'Cache eviction rate 3× baseline',             source: 'session-cache',  age: '1h 12m', acknowledged: false },
    { id: 'a-104', severity: 'warning', title: 'analytics-warehouse query p95 above SLO',     source: 'analytics-warehouse', age: '2h 8m', acknowledged: false },
    { id: 'a-105', severity: 'warning', title: 'Audit retention nearing capacity (89%)',     source: 'audit-store',    age: '3h 41m', acknowledged: true  },
    { id: 'a-106', severity: 'info',    title: 'Auto-scale event: ingestion pool 4 → 6',      source: 'platform',       age: '4h 14m', acknowledged: true  },
    { id: 'a-107', severity: 'info',    title: 'Token signing key rotated',                   source: 'auth',           age: '5h 3m', acknowledged: true  },
  ];

  // ---- Helpers -----------------------------------------------------------

  setView(v: 'overview' | 'sources' | 'alerts'): void {
    this.activeView = v;
  }

  // Returns an SVG path for a sparkline given values, drawn into a 100x30 viewBox.
  sparklinePath(values: number[]): string {
    if (!values.length) return '';
    const w = 100;
    const h = 30;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = w / (values.length - 1);
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
    const w = 100;
    const h = 30;
    return `${path} L ${w} ${h} L 0 ${h} Z`;
  }

  formatRecords(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
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
      case 'disconnected': return 'suspended';
    }
  }

  sourceStatusLabel(s: SourceStatus): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
