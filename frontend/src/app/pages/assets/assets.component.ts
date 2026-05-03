import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  ApiAsset,
  ApiAssetDomain,
  ApiAssetTag,
  ApiAssetType,
  AssetsApiService,
} from '../../@core/api/assets-api.service';
import { SystemConfigStore, formatInZone } from '../../@core/utils';

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

// Display shape used by the template. Mirrors `ApiAsset` but with the
// lowercase enum form the SCSS / template were built around. Lineage
// edges are qualifiedNames; the `assetByQName()` helper resolves them
// into chips.
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
export class AssetsComponent implements OnInit, OnDestroy {

  private readonly destroy$ = new Subject<void>();

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

  assets: DataAsset[] = [];
  assetsLoading = false;
  assetsError: string | null = null;

  // Cache the tz/fmt at the time of the last conversion so re-rendering
  // after a System → Configuration save can reflow `lastUpdated` without
  // refetching from the server.
  private lastTz = 'UTC';
  private lastFmt = 'YYYY-MM-DD';

  // Inline domain editor state — see the detail panel "Domain" field.
  // Sync auto-discovers assets with `domain=OPS` as a placeholder; this
  // lets a steward re-categorise without leaving the catalog.
  editingDomain = false;
  pendingDomain: Domain | null = null;
  domainSaving = false;
  domainError: string | null = null;
  readonly editableDomains: Domain[] = ['sales', 'finance', 'marketing', 'product', 'compliance', 'ops'];

  constructor(
    private readonly assetsApi: AssetsApiService,
    private readonly configStore: SystemConfigStore,
  ) {}

  ngOnInit(): void {
    this.loadAssets();
    // Re-format `lastUpdated` strings if the user changes their tz / format
    // in System → Configuration. The underlying ISO timestamps live in the
    // API response which we no longer hold; cheapest is to refetch.
    this.configStore.config$.pipe(takeUntil(this.destroy$)).subscribe((c) => {
      const tz = c?.defaultTimezone || 'UTC';
      const fmt = c?.dateFormat || 'YYYY-MM-DD';
      if (tz === this.lastTz && fmt === this.lastFmt) return;
      this.lastTz = tz;
      this.lastFmt = fmt;
      if (this.assets.length > 0) this.loadAssets();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAssets(): void {
    this.assetsLoading = true;
    this.assetsError = null;
    this.assetsApi.list().subscribe({
      next: (rows) => {
        this.assets = rows.map((r) => this.toDataAsset(r));
        this.assetsLoading = false;
      },
      error: (err) => {
        this.assetsError = err?.error?.message || err?.message || 'Failed to load assets';
        this.assetsLoading = false;
      },
    });
  }

  private toDataAsset(a: ApiAsset): DataAsset {
    const tz = this.configStore.value?.defaultTimezone || 'UTC';
    const fmt = this.configStore.value?.dateFormat || 'YYYY-MM-DD';
    this.lastTz = tz;
    this.lastFmt = fmt;
    return {
      id: a.id,
      name: a.name,
      qualifiedName: a.qualifiedName,
      type: this.assetTypeApiToWire(a.type),
      source: a.sourceName,
      schema: a.schema.map((f) => ({ ...f })),
      rowCount: a.rowCount,
      sizeMb: a.sizeMb,
      owner: {
        name: a.ownerName ?? a.ownerEmail ?? '—',
        email: a.ownerEmail ?? '',
      },
      domain: this.assetDomainApiToWire(a.domain),
      tags: a.tags.map((t) => this.assetTagApiToWire(t)),
      description: a.description,
      lastUpdated: formatInZone(new Date(a.lastUpdatedAt), tz, fmt),
      upstream: [...a.upstream],
      downstream: [...a.downstream],
    };
  }

  private assetTypeApiToWire(t: ApiAssetType): AssetType {
    return t.toLowerCase() as AssetType;
  }

  private assetDomainApiToWire(d: ApiAssetDomain): Domain {
    return d.toLowerCase() as Domain;
  }

  private assetTagApiToWire(t: ApiAssetTag): AssetTag {
    return t.toLowerCase() as AssetTag;
  }

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

  selectAsset(asset: DataAsset | undefined): void {
    if (!asset) return;
    this.selectedAssetId = this.selectedAssetId === asset.id ? null : asset.id;
    this.resetDomainEditor();
  }

  clearSelection(): void {
    this.selectedAssetId = null;
    this.resetDomainEditor();
  }

  // ---- Domain inline editor ---------------------------------------------

  startDomainEdit(): void {
    if (!this.selectedAsset) return;
    this.editingDomain = true;
    this.pendingDomain = this.selectedAsset.domain;
    this.domainError = null;
  }

  cancelDomainEdit(): void {
    this.resetDomainEditor();
  }

  saveDomain(): void {
    const target = this.selectedAsset;
    const next = this.pendingDomain;
    if (!target || !next || this.domainSaving) return;
    if (next === target.domain) {
      this.resetDomainEditor();
      return;
    }
    this.domainSaving = true;
    this.domainError = null;
    this.assetsApi.update(target.id, { domain: this.assetDomainWireToApi(next) }).subscribe({
      next: (updated) => {
        const fresh = this.toDataAsset(updated);
        const idx = this.assets.findIndex((a) => a.id === fresh.id);
        if (idx >= 0) this.assets[idx] = fresh;
        this.domainSaving = false;
        this.resetDomainEditor();
      },
      error: (err) => {
        this.domainError = err?.error?.message || err?.message || 'Failed to save domain';
        this.domainSaving = false;
      },
    });
  }

  private resetDomainEditor(): void {
    this.editingDomain = false;
    this.pendingDomain = null;
    this.domainError = null;
    this.domainSaving = false;
  }

  private assetDomainWireToApi(d: Domain): ApiAssetDomain {
    return d.toUpperCase() as ApiAssetDomain;
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

  // Lineage edges are stored as qualifiedNames; this helper resolves a
  // qName back to its asset for the chip render. Returns undefined if the
  // referenced asset isn't currently loaded (e.g. cross-source lineage to
  // an asset that hasn't been registered yet).
  assetByQName(qn: string): DataAsset | undefined {
    return this.assets.find(a => a.qualifiedName === qn);
  }
}
