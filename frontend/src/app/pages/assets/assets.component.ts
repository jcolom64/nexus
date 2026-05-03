import { Component } from '@angular/core';

type AssetType = 'table' | 'view' | 'topic' | 'file' | 'api';
type AssetTag = 'pii' | 'gdpr' | 'sensitive' | 'certified' | 'deprecated' | 'golden';
type Domain = 'sales' | 'finance' | 'marketing' | 'product' | 'compliance' | 'ops';

interface AssetOwner {
  name: string;
  email: string;
}

interface SchemaField {
  name: string;
  type: string;
  pii?: boolean;
}

interface DataAsset {
  id: string;
  name: string;
  qualifiedName: string;
  type: AssetType;
  source: string;
  schema: SchemaField[];
  rowCount: number;
  sizeMb: number;
  owner: AssetOwner;
  domain: Domain;
  tags: AssetTag[];
  description: string;
  lastUpdated: string;
  upstream: string[];
  downstream: string[];
}

@Component({
  selector: 'ngx-assets',
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.scss'],
})
export class AssetsComponent {

  views: { id: 'catalog' | 'domains' | 'lineage'; label: string; icon: string }[] = [
    { id: 'catalog', label: 'Catalog', icon: 'list-outline' },
    { id: 'domains', label: 'Domains', icon: 'grid-outline' },
    { id: 'lineage', label: 'Lineage', icon: 'share-outline' },
  ];

  activeView: 'catalog' | 'domains' | 'lineage' = 'catalog';

  // The single "Search all fields" input is the only catalog filter — the
  // per-facet dropdowns were removed once the search covered everything.
  search = '';

  selectedAssetId: string | null = null;

  assetPageSize = 10;
  assetCurrentPage = 1;
  readonly assetPageSizeOptions: number[] = [10, 25, 50, 100];

  // Domain labels are still used by the Domains view to render section
  // headings; the Catalog itself no longer exposes per-facet dropdowns.
  domainOptions: { value: Domain | 'all'; label: string }[] = [
    { value: 'all',        label: 'All domains' },
    { value: 'sales',      label: 'Sales' },
    { value: 'finance',    label: 'Finance' },
    { value: 'marketing',  label: 'Marketing' },
    { value: 'product',    label: 'Product' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'ops',        label: 'Operations' },
  ];

  private owners: Record<string, AssetOwner> = {
    jane:   { name: 'Jane Smith',   email: 'jane.smith@nexus.com' },
    john:   { name: 'John Doe',     email: 'john.doe@nexus.com' },
    sarah:  { name: 'Sarah Wilson', email: 'sarah.wilson@nexus.com' },
    mike:   { name: 'Mike Johnson', email: 'mike.johnson@nexus.com' },
    priya:  { name: 'Priya Patel',  email: 'priya.patel@nexus.com' },
    david:  { name: 'David Brown',  email: 'david.brown@nexus.com' },
  };

  assets: DataAsset[] = [
    {
      id: 'a-001',
      name: 'transactions',
      qualifiedName: 'orders-db.public.transactions',
      type: 'table',
      source: 'orders-db',
      schema: [
        { name: 'transaction_id', type: 'uuid' },
        { name: 'customer_id', type: 'uuid' },
        { name: 'amount_cents', type: 'bigint' },
        { name: 'currency', type: 'varchar(3)' },
        { name: 'created_at', type: 'timestamp' },
        { name: 'card_last4', type: 'varchar(4)', pii: true },
      ],
      rowCount: 14_280_000,
      sizeMb: 8420,
      owner: this.owners.jane,
      domain: 'sales',
      tags: ['certified', 'golden'],
      description: 'Authoritative ledger of every customer transaction. Streaming CDC into the warehouse every minute.',
      lastUpdated: '2026-05-01 14:30',
      upstream: [],
      downstream: ['a-006', 'a-007', 'a-010'],
    },
    {
      id: 'a-002',
      name: 'customers',
      qualifiedName: 'orders-db.public.customers',
      type: 'table',
      source: 'orders-db',
      schema: [
        { name: 'customer_id', type: 'uuid' },
        { name: 'email', type: 'varchar', pii: true },
        { name: 'full_name', type: 'varchar', pii: true },
        { name: 'country', type: 'char(2)' },
        { name: 'signed_up_at', type: 'timestamp' },
      ],
      rowCount: 3_120_000,
      sizeMb: 1180,
      owner: this.owners.jane,
      domain: 'sales',
      tags: ['certified', 'pii', 'gdpr'],
      description: 'Master customer record. Source of truth for billing and CRM sync.',
      lastUpdated: '2026-05-01 14:20',
      upstream: [],
      downstream: ['a-006', 'a-009'],
    },
    {
      id: 'a-003',
      name: 'products',
      qualifiedName: 'orders-db.public.products',
      type: 'table',
      source: 'orders-db',
      schema: [
        { name: 'product_id', type: 'uuid' },
        { name: 'sku', type: 'varchar' },
        { name: 'name', type: 'varchar' },
        { name: 'price_cents', type: 'integer' },
        { name: 'is_active', type: 'boolean' },
      ],
      rowCount: 12_400,
      sizeMb: 8.2,
      owner: this.owners.mike,
      domain: 'product',
      tags: ['certified'],
      description: 'Active and historical product catalog.',
      lastUpdated: '2026-04-30 18:14',
      upstream: [],
      downstream: ['a-008'],
    },
    {
      id: 'a-004',
      name: 'refunds',
      qualifiedName: 'orders-db.public.refunds',
      type: 'table',
      source: 'orders-db',
      schema: [
        { name: 'refund_id', type: 'uuid' },
        { name: 'transaction_id', type: 'uuid' },
        { name: 'amount_cents', type: 'bigint' },
        { name: 'reason', type: 'varchar' },
        { name: 'created_at', type: 'timestamp' },
      ],
      rowCount: 184_000,
      sizeMb: 92,
      owner: this.owners.jane,
      domain: 'finance',
      tags: ['certified'],
      description: 'Refund events linked back to transactions.',
      lastUpdated: '2026-05-01 13:55',
      upstream: ['a-001'],
      downstream: ['a-007'],
    },
    {
      id: 'a-005',
      name: 'page_views',
      qualifiedName: 'metrics-stream.events.page_views',
      type: 'topic',
      source: 'metrics-stream',
      schema: [
        { name: 'session_id', type: 'string' },
        { name: 'user_id', type: 'string', pii: true },
        { name: 'url', type: 'string' },
        { name: 'referrer', type: 'string' },
        { name: 'timestamp', type: 'timestamp' },
      ],
      rowCount: 482_000_000,
      sizeMb: 142_300,
      owner: this.owners.priya,
      domain: 'marketing',
      tags: ['pii'],
      description: 'Every page-view event from the web and mobile apps. Retention 30 days.',
      lastUpdated: '2026-05-01 14:32',
      upstream: [],
      downstream: ['a-008', 'a-011'],
    },
    {
      id: 'a-006',
      name: 'customer_lifetime_value',
      qualifiedName: 'analytics-warehouse.dim.customer_lifetime_value',
      type: 'view',
      source: 'analytics-warehouse',
      schema: [
        { name: 'customer_id', type: 'string' },
        { name: 'tenure_days', type: 'integer' },
        { name: 'total_spend_usd', type: 'decimal(12,2)' },
        { name: 'predicted_ltv_usd', type: 'decimal(12,2)' },
        { name: 'segment', type: 'varchar' },
      ],
      rowCount: 3_120_000,
      sizeMb: 480,
      owner: this.owners.sarah,
      domain: 'marketing',
      tags: ['certified', 'golden'],
      description: 'Modelled customer lifetime value, refreshed nightly. Joined from transactions and customers.',
      lastUpdated: '2026-05-01 06:30',
      upstream: ['a-001', 'a-002'],
      downstream: ['a-013'],
    },
    {
      id: 'a-007',
      name: 'daily_revenue',
      qualifiedName: 'analytics-warehouse.fact.daily_revenue',
      type: 'view',
      source: 'analytics-warehouse',
      schema: [
        { name: 'date', type: 'date' },
        { name: 'gross_usd', type: 'decimal(14,2)' },
        { name: 'refunds_usd', type: 'decimal(14,2)' },
        { name: 'net_usd', type: 'decimal(14,2)' },
        { name: 'currency', type: 'varchar(3)' },
      ],
      rowCount: 1_460,
      sizeMb: 0.5,
      owner: this.owners.david,
      domain: 'finance',
      tags: ['certified', 'golden'],
      description: 'Net daily revenue, used by exec reporting.',
      lastUpdated: '2026-05-01 06:32',
      upstream: ['a-001', 'a-004'],
      downstream: ['a-013'],
    },
    {
      id: 'a-008',
      name: 'marketing_attribution',
      qualifiedName: 'analytics-warehouse.fact.marketing_attribution',
      type: 'view',
      source: 'analytics-warehouse',
      schema: [
        { name: 'date', type: 'date' },
        { name: 'channel', type: 'varchar' },
        { name: 'campaign_id', type: 'varchar' },
        { name: 'first_touch_attribution_usd', type: 'decimal' },
        { name: 'last_touch_attribution_usd', type: 'decimal' },
      ],
      rowCount: 96_000,
      sizeMb: 31,
      owner: this.owners.priya,
      domain: 'marketing',
      tags: ['certified'],
      description: 'Attribution model joining web events with conversions.',
      lastUpdated: '2026-05-01 06:35',
      upstream: ['a-003', 'a-005'],
      downstream: [],
    },
    {
      id: 'a-009',
      name: 'gdpr_export_jobs',
      qualifiedName: 'orders-db.compliance.gdpr_export_jobs',
      type: 'table',
      source: 'orders-db',
      schema: [
        { name: 'job_id', type: 'uuid' },
        { name: 'customer_id', type: 'uuid' },
        { name: 'requested_at', type: 'timestamp' },
        { name: 'status', type: 'varchar' },
        { name: 'output_url', type: 'varchar' },
      ],
      rowCount: 1_840,
      sizeMb: 0.6,
      owner: this.owners.john,
      domain: 'compliance',
      tags: ['gdpr', 'sensitive', 'pii'],
      description: 'Tracks subject-access and right-to-be-forgotten requests.',
      lastUpdated: '2026-05-01 11:08',
      upstream: ['a-002'],
      downstream: [],
    },
    {
      id: 'a-010',
      name: 'raw_events_2026_05',
      qualifiedName: 'object-store.s3://nexus-raw/2026-05/',
      type: 'file',
      source: 'object-store',
      schema: [
        { name: 'partition', type: 'string (path)' },
        { name: 'event_type', type: 'string' },
        { name: 'payload', type: 'json' },
      ],
      rowCount: 1_120_000_000,
      sizeMb: 980_000,
      owner: this.owners.sarah,
      domain: 'ops',
      tags: [],
      description: 'Cold storage of raw event JSON. Partitioned by day. Used for replay and audit.',
      lastUpdated: '2026-05-01 14:00',
      upstream: ['a-001', 'a-005'],
      downstream: [],
    },
    {
      id: 'a-011',
      name: 'app_clicks',
      qualifiedName: 'metrics-stream.events.app_clicks',
      type: 'topic',
      source: 'metrics-stream',
      schema: [
        { name: 'session_id', type: 'string' },
        { name: 'user_id', type: 'string', pii: true },
        { name: 'element', type: 'string' },
        { name: 'timestamp', type: 'timestamp' },
      ],
      rowCount: 162_400_000,
      sizeMb: 24_800,
      owner: this.owners.priya,
      domain: 'product',
      tags: ['pii'],
      description: 'Click events from native mobile apps.',
      lastUpdated: '2026-05-01 14:32',
      upstream: [],
      downstream: [],
    },
    {
      id: 'a-012',
      name: 'partner_inventory',
      qualifiedName: 'partner-api.inventory',
      type: 'api',
      source: 'partner-api',
      schema: [
        { name: 'sku', type: 'string' },
        { name: 'available_qty', type: 'integer' },
        { name: 'updated_at', type: 'timestamp' },
      ],
      rowCount: 0,
      sizeMb: 0,
      owner: this.owners.mike,
      domain: 'ops',
      tags: ['deprecated'],
      description: 'Live inventory feed from supply partner. Being replaced by the Kafka stream in Q3.',
      lastUpdated: '2026-04-28 09:11',
      upstream: [],
      downstream: [],
    },
    {
      id: 'a-013',
      name: 'monthly_kpis',
      qualifiedName: 'analytics-warehouse.fact.monthly_kpis',
      type: 'view',
      source: 'analytics-warehouse',
      schema: [
        { name: 'month', type: 'date' },
        { name: 'mrr_usd', type: 'decimal(14,2)' },
        { name: 'churn_pct', type: 'decimal(5,2)' },
        { name: 'new_customers', type: 'integer' },
        { name: 'avg_clv_usd', type: 'decimal(12,2)' },
      ],
      rowCount: 60,
      sizeMb: 0.1,
      owner: this.owners.david,
      domain: 'finance',
      tags: ['certified', 'golden'],
      description: 'Board-level monthly metrics.',
      lastUpdated: '2026-05-01 06:40',
      upstream: ['a-006', 'a-007'],
      downstream: [],
    },
    {
      id: 'a-014',
      name: 'audit_log',
      qualifiedName: 'orders-db.security.audit_log',
      type: 'table',
      source: 'orders-db',
      schema: [
        { name: 'event_id', type: 'uuid' },
        { name: 'actor', type: 'varchar', pii: true },
        { name: 'action', type: 'varchar' },
        { name: 'resource', type: 'varchar' },
        { name: 'timestamp', type: 'timestamp' },
      ],
      rowCount: 24_900_000,
      sizeMb: 5_200,
      owner: this.owners.john,
      domain: 'compliance',
      tags: ['sensitive', 'certified'],
      description: 'Immutable audit log for all admin actions.',
      lastUpdated: '2026-05-01 14:32',
      upstream: [],
      downstream: [],
    },
  ];

  // ---- Computed views ----------------------------------------------------

  get filteredAssets(): DataAsset[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.assets;
    return this.assets.filter(a => {
      const haystack = [
        a.name, a.qualifiedName, a.description, a.owner.name, a.owner.email,
        a.type, a.source, a.domain, a.tags.join(' '),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  get assetTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredAssets.length / this.assetPageSize));
  }

  get assetPageNumbers(): number[] {
    return Array.from({ length: this.assetTotalPages }, (_, i) => i + 1);
  }

  get paginatedAssets(): DataAsset[] {
    if (this.assetCurrentPage > this.assetTotalPages) {
      this.assetCurrentPage = this.assetTotalPages;
    }
    const start = (this.assetCurrentPage - 1) * this.assetPageSize;
    return this.filteredAssets.slice(start, start + this.assetPageSize);
  }

  get assetPageStart(): number {
    if (this.filteredAssets.length === 0) return 0;
    return (this.assetCurrentPage - 1) * this.assetPageSize + 1;
  }

  get assetPageEnd(): number {
    return Math.min(this.assetCurrentPage * this.assetPageSize, this.filteredAssets.length);
  }

  setAssetPage(page: number): void {
    if (page < 1 || page > this.assetTotalPages) return;
    this.assetCurrentPage = page;
  }
  prevAssetPage(): void { this.setAssetPage(this.assetCurrentPage - 1); }
  nextAssetPage(): void { this.setAssetPage(this.assetCurrentPage + 1); }
  onAssetSearchChange(): void { this.assetCurrentPage = 1; }
  onAssetPageSizeChange(): void { this.assetCurrentPage = 1; }

  get selectedAsset(): DataAsset | null {
    if (!this.selectedAssetId) return null;
    return this.assets.find(a => a.id === this.selectedAssetId) ?? null;
  }

  get assetsByDomain(): { domain: Domain; label: string; assets: DataAsset[]; uniqueOwners: AssetOwner[] }[] {
    const result: { domain: Domain; label: string; assets: DataAsset[]; uniqueOwners: AssetOwner[] }[] = [];
    for (const opt of this.domainOptions) {
      if (opt.value === 'all') continue;
      const assets = this.assets.filter(a => a.domain === opt.value);
      const owners = Array.from(new Map(assets.map(a => [a.owner.email, a.owner])).values());
      result.push({ domain: opt.value as Domain, label: opt.label, assets, uniqueOwners: owners });
    }
    return result;
  }

  // ---- Actions -----------------------------------------------------------

  setView(v: 'catalog' | 'domains' | 'lineage'): void {
    this.activeView = v;
    if (v !== 'catalog') this.selectedAssetId = null;
  }

  selectAsset(asset: DataAsset): void {
    this.selectedAssetId = this.selectedAssetId === asset.id ? null : asset.id;
  }

  clearSelection(): void {
    this.selectedAssetId = null;
  }

  // From the Domains view: drop into the Catalog with the search box pre-filled
  // for the selected domain. Search hits the asset's `domain` field, so this
  // effectively narrows to that domain even though the dedicated dropdown is
  // gone.
  jumpToDomain(d: Domain): void {
    this.activeView = 'catalog';
    this.search = d;
    this.assetCurrentPage = 1;
    this.selectedAssetId = null;
  }

  // ---- Helpers -----------------------------------------------------------

  typeIcon(t: AssetType): string {
    switch (t) {
      case 'table': return 'grid-outline';
      case 'view':  return 'eye-outline';
      case 'topic': return 'radio-outline';
      case 'file':  return 'archive-outline';
      case 'api':   return 'cloud-upload-outline';
    }
  }

  formatRows(n: number): string {
    if (!n) return '—';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  formatSize(mb: number): string {
    if (!mb) return '—';
    if (mb >= 1024 * 1024) return (mb / (1024 * 1024)).toFixed(2) + ' TB';
    if (mb >= 1024)        return (mb / 1024).toFixed(2) + ' GB';
    return mb.toFixed(1) + ' MB';
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');
  }

  avatarHue(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 360;
  }

  domainLabel(d: Domain): string {
    return this.domainOptions.find(o => o.value === d)?.label ?? d;
  }

  assetById(id: string): DataAsset | undefined {
    return this.assets.find(a => a.id === id);
  }
}
