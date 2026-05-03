import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiRole, ApiState, ApiUser, UsersApiService } from '../../@core/api/users-api.service';
import {
  ApiAccount,
  ApiSystemRole,
  ApiUserGroup,
  GroupsApiService,
} from '../../@core/api/groups-api.service';
import {
  ApiAuditAction,
  ApiAuditCategory,
  ApiAuditEntry,
  AuditApiService,
} from '../../@core/api/audit-api.service';
import { ApiSystemConfig } from '../../@core/api/config-api.service';
import { ApiSecuritySettings, SecurityApiService } from '../../@core/api/security-api.service';
import { ApiLicense, LicenseApiService } from '../../@core/api/license-api.service';
import {
  ApiSource,
  ApiSourceStatus,
  ApiSourceType,
  ApiSyncSourceResult,
  ApiTestSourceResult,
  SourcesApiService,
} from '../../@core/api/sources-api.service';
import {
  ApiHealthComponent,
  ApiHealthMetrics,
  HealthApiService,
} from '../../@core/api/health-api.service';
import { EventsClient, SettingsService, SystemConfigStore, formatInZone } from '../../@core/utils';

type HealthStatus = 'success' | 'warning' | 'danger' | 'info';

interface ServiceStatus {
  name: string;
  status: HealthStatus;
  label: string;
}

type UserRole = 'Administrator' | 'Manager' | 'User' | 'Auditor';
type UserState = 'active' | 'inactive' | 'suspended' | 'invited';

interface AccountUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  state: UserState;
  lastLogin: string;
}

type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'access' | 'export';
type AuditOutcome = 'success' | 'failed' | 'warning';
type AuditCategory = 'auth' | 'user' | 'config' | 'data' | 'security';

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorEmail: string;
  action: AuditAction;
  category: AuditCategory;
  resource: string;
  resourceType: string;
  source: string;
  outcome: AuditOutcome;
}

type SystemRole = 'system-admin' | 'account-viewer' | 'license-override' | 'user-viewer';

interface AccountOption {
  id: string;
  name: string;
}

interface AccountAssignment {
  accountId: string;
  role: SystemRole | '';
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
  systemRoles: SystemRole[];
  accountAssignments: AccountAssignment[];
  created: string;
  lastUpdated: string;
}

type GroupSortKey = 'name' | 'description' | 'accountSummary' | 'created' | 'lastUpdated';

type MfaMode = 'off' | 'optional' | 'required';
type TlsVersion = '1.2' | '1.3';
type LoginMethod = 'password' | 'sso-saml' | 'oauth' | 'ldap';

type ThemeChoice = 'default' | 'dark';
type FirstDayOfWeek = 'sunday' | 'monday';
type LicenseTier = 'starter' | 'professional' | 'enterprise';
type DataSourceType = 'postgres' | 'mysql' | 'mongodb' | 's3' | 'rest-api' | 'kafka' | 'snowflake' | 'redis';
type DataSourceStatus = 'connected' | 'degraded' | 'disconnected';

interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  status: DataSourceStatus;
  lastSync: string;
  hasCredentials: boolean;
}

interface NotificationEvent {
  id: string;
  label: string;
  enabled: boolean;
}

interface SystemConfig {
  // General
  appNameOverride: string;
  defaultTheme: ThemeChoice;
  defaultLocale: string;
  defaultTimezone: string;
  dateFormat: string;
  firstDayOfWeek: FirstDayOfWeek;

  // Data sources (defaults; connections are listed separately)
  defaultRefreshSeconds: number;
  defaultRetryAttempts: number;
  retryBackoffMultiplier: number;
  maxConcurrentConnectors: number;

  // Notifications & Email
  smtpHost: string;
  smtpPort: number;
  smtpRequireAuth: boolean;
  smtpUsername: string;
  smtpFromAddress: string;
  notificationEvents: NotificationEvent[];
  slackWebhookUrl: string;
  teamsWebhookUrl: string;

  // Performance & Limits
  cacheTtlSeconds: number;
  queryTimeoutSeconds: number;
  maxUploadMb: number;
  maxConcurrentJobs: number;
  workerPoolSize: number;

  // License is its own resource — see `license` field on SystemComponent.
}

interface SecuritySettings {
  // Authentication
  loginMethods: LoginMethod[];
  mfaMode: MfaMode;
  ssoIssuer: string;
  sessionTimeoutMinutes: number;
  rememberMeEnabled: boolean;

  // Password policy
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  passwordExpiryDays: number;
  passwordHistoryCount: number;

  // Account lockout
  failedAttemptThreshold: number;
  lockoutDurationMinutes: number;

  // Network
  ipAllowlist: string;
  rateLimitPerMinute: number;

  // Compliance
  tlsMinimumVersion: TlsVersion;
  encryptionAtRest: boolean;
  auditRetentionDays: number;
}

@Component({
  selector: 'ngx-system',
  templateUrl: './system.component.html',
  styleUrls: ['./system.component.scss'],
})
export class SystemComponent implements OnInit, OnDestroy {

  private readonly destroy$ = new Subject<void>();

  readonly defaultSystemConfig: SystemConfig = {
    appNameOverride: 'Nexus',
    defaultTheme: 'default',
    defaultLocale: 'en-US',
    defaultTimezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    firstDayOfWeek: 'sunday',
    defaultRefreshSeconds: 300,
    defaultRetryAttempts: 3,
    retryBackoffMultiplier: 2,
    maxConcurrentConnectors: 8,
    smtpHost: 'smtp.nexus.com',
    smtpPort: 587,
    smtpRequireAuth: true,
    smtpUsername: 'no-reply@nexus.com',
    smtpFromAddress: 'no-reply@nexus.com',
    notificationEvents: [
      { id: 'auth-failure',     label: 'Repeated authentication failures', enabled: true },
      { id: 'data-source-down', label: 'Data source disconnected',         enabled: true },
      { id: 'license-expiring', label: 'License expires within 30 days',   enabled: true },
      { id: 'audit-anomaly',    label: 'Audit anomaly detected',           enabled: false },
      { id: 'backup-failed',    label: 'Backup failed',                    enabled: true },
    ],
    slackWebhookUrl: '',
    teamsWebhookUrl: '',
    cacheTtlSeconds: 600,
    queryTimeoutSeconds: 30,
    maxUploadMb: 100,
    maxConcurrentJobs: 16,
    workerPoolSize: 8,
  };

  systemConfig: SystemConfig = JSON.parse(JSON.stringify(this.defaultSystemConfig));
  systemConfigBaseline: SystemConfig = JSON.parse(JSON.stringify(this.defaultSystemConfig));
  systemConfigSaved = false;
  systemConfigSavedTimer?: number;
  systemConfigLoading = false;
  systemConfigSaving = false;
  systemConfigError: string | null = null;

  // Live source list from /api/sources. Empty until the first load lands —
  // the Data Sources card on Configuration handles the empty render.
  dataSources: DataSource[] = [];
  dataSourcesLoading = false;
  dataSourcesError: string | null = null;

  // Per-source action state for the Test/Sync buttons. Keyed by source id;
  // a source not in the map has never been acted on. `busy` flips while a
  // request is in flight; `message` carries the last result (success
  // summary or error). Cleared when a new action starts.
  dataSourceActions: Record<string, { busy: boolean; ok?: boolean; message?: string }> = {};

  // ---- Source create/edit modal (Phase 5b follow-up) ----
  // The list of source types supported by the API + their default ports.
  // Used to populate the Type select and to suggest a port when the user
  // changes the type during creation.
  readonly sourceTypeOptions: { value: ApiSourceType; label: string; defaultPort: number | null }[] = [
    { value: 'POSTGRES',  label: 'PostgreSQL',         defaultPort: 5432 },
    { value: 'MYSQL',     label: 'MySQL',              defaultPort: 3306 },
    { value: 'MONGODB',   label: 'MongoDB',            defaultPort: 27017 },
    { value: 'REDIS',     label: 'Redis',              defaultPort: 6379 },
    { value: 'KAFKA',     label: 'Kafka',              defaultPort: 9092 },
    { value: 'SNOWFLAKE', label: 'Snowflake',          defaultPort: 443 },
    { value: 'S3',        label: 'S3 (object store)',  defaultPort: null },
    { value: 'REST_API',  label: 'REST API',           defaultPort: null },
  ];

  sourceModalOpen = false;
  editingSource: ApiSource | null = null;
  sourceForm = {
    name: '',
    type: 'POSTGRES' as ApiSourceType,
    description: '',
    host: '',
    port: null as number | null,
    database: '',
    username: '',
    password: '',
  };
  sourceFormError: string | null = null;
  sourceFormSaving = false;
  // Set true when the user wants to wipe a stored credential. Purely
  // a frontend toggle — the patch payload sends `password: ''` to signal
  // "clear" to the server-side service.
  sourceFormClearPassword = false;
  readonly sourceNameMax = 128;

  themeOptions: { value: ThemeChoice; label: string }[] = [
    { value: 'default', label: 'Default (light)' },
    { value: 'dark',    label: 'Dark' },
  ];

  localeOptions = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'pt-BR', 'zh-CN'];

  timezoneOptions = ['UTC', 'America/Los_Angeles', 'America/New_York', 'America/Chicago', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore'];

  dateFormatOptions = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'D MMM YYYY', 'MMM D, YYYY'];

  readonly defaultSecuritySettings: SecuritySettings = {
    loginMethods: ['password', 'sso-saml'],
    mfaMode: 'optional',
    ssoIssuer: 'https://idp.nexus.com/saml/metadata',
    sessionTimeoutMinutes: 30,
    rememberMeEnabled: true,
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumber: true,
    passwordRequireSymbol: false,
    passwordExpiryDays: 90,
    passwordHistoryCount: 5,
    failedAttemptThreshold: 5,
    lockoutDurationMinutes: 15,
    ipAllowlist: '',
    rateLimitPerMinute: 600,
    tlsMinimumVersion: '1.2',
    encryptionAtRest: true,
    auditRetentionDays: 365,
  };

  securitySettings: SecuritySettings = { ...this.defaultSecuritySettings };
  securitySettingsBaseline: SecuritySettings = { ...this.defaultSecuritySettings };
  securitySaved = false;
  securitySavedTimer?: number;
  securitySettingsLoading = false;
  securitySettingsSaving = false;
  securitySettingsError: string | null = null;

  loginMethodOptions: { value: LoginMethod; label: string }[] = [
    { value: 'password', label: 'Email & password' },
    { value: 'sso-saml', label: 'SSO (SAML)' },
    { value: 'oauth',    label: 'OAuth 2.0' },
    { value: 'ldap',     label: 'LDAP / Active Directory' },
  ];

  title = 'System Administration';
  activeTab = 'health';

  // Snapshot of System → Configuration values, surfaced here so the Health
  // tab reflects the live tenant configuration without duplicating it in DB
  // columns. License lives in its own card on this same tab; locale /
  // timezone / format come from `systemConfig`; database size from
  // `/health/metrics`.
  get systemInfo(): { label: string; value: string }[] {
    const dbSize = this.healthMetrics
      ? this.formatBytes(this.healthMetrics.databaseSizeBytes)
      : '—';
    return [
      { label: 'Application',   value: this.systemConfig.appNameOverride || 'Nexus' },
      { label: 'Locale',        value: this.systemConfig.defaultLocale },
      { label: 'Timezone',      value: this.systemConfig.defaultTimezone },
      { label: 'Date format',   value: this.systemConfig.dateFormat },
      { label: 'Database size', value: dbSize },
    ];
  }

  // Platform Services row — fed by /api/health/check on every Health-tab
  // open. Phase 5c retired the four DEMO pills (Message Queue / Cache
  // Layer / Auth Service / Object Storage) that used to live here; data
  // sources have their own row below now (`dataSourceStatuses`).
  serviceStatuses: ServiceStatus[] = [
    { name: 'API Gateway', status: 'info', label: 'Checking…' },
    { name: 'Database',    status: 'info', label: 'Checking…' },
  ];
  healthError: string | null = null;
  healthLastCheckedAt: string | null = null;

  // Live metrics from /api/health/metrics. Null until the first probe lands.
  // App % is always accurate; system % may overstate available memory inside
  // a container — surfaced in a footnote on the page.
  healthMetrics: ApiHealthMetrics | null = null;

  // Install-time license, fetched once from /api/license. Null until the
  // request lands. Read-only here — the only writer is the backend's
  // `license:apply` CLI.
  license: ApiLicense | null = null;
  licenseError: string | null = null;

  users: AccountUser[] = [
    { id: '001', name: 'John Doe',     email: 'john.doe@nexus.com',     role: 'Administrator', state: 'active',    lastLogin: '2026-04-30 14:30' },
    { id: '002', name: 'Jane Smith',   email: 'jane.smith@nexus.com',   role: 'Manager',       state: 'active',    lastLogin: '2026-04-30 09:15' },
    { id: '003', name: 'Mike Johnson', email: 'mike.johnson@nexus.com', role: 'User',          state: 'inactive',  lastLogin: '2026-04-28 16:45' },
    { id: '004', name: 'Sarah Wilson', email: 'sarah.wilson@nexus.com', role: 'User',          state: 'active',    lastLogin: '2026-04-30 11:20' },
    { id: '005', name: 'David Brown',  email: 'david.brown@nexus.com',  role: 'Manager',       state: 'suspended', lastLogin: '2026-04-25 13:10' },
    { id: '006', name: 'Priya Patel',  email: 'priya.patel@nexus.com',  role: 'Auditor',       state: 'invited',   lastLogin: 'Never' },
  ];

  userSearch = '';

  get filteredUsers(): AccountUser[] {
    const q = this.userSearch.trim().toLowerCase();
    if (!q) return this.users;
    return this.users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q),
    );
  }

  // Audit entries are server-paginated. The full set lives only on the server;
  // we keep just the current page in memory.
  auditPage: ApiAuditEntry[] = [];
  auditTotal = 0;
  auditLoading = false;
  auditError: string | null = null;
  private auditDebounce?: number;

  // Filter / pagination state. `'all'` is a frontend sentinel meaning "no
  // category filter sent to the API".
  auditSearch = '';
  auditCategory: ApiAuditCategory | 'all' = 'all';
  auditPageSize = 25;
  auditCurrentPage = 1;
  readonly auditPageSizeOptions: number[] = [10, 25, 50, 100];

  // Adapters for the existing template that was built against lowercase
  // strings. The API returns uppercase enums; we lowercase at the boundary.
  // The template still uses `entry.category`, `entry.action`, etc.
  get paginatedAudit(): AuditEntry[] {
    const tz = this.systemConfig.defaultTimezone || 'UTC';
    const fmt = this.systemConfig.dateFormat || 'YYYY-MM-DD';
    return this.auditPage.map((e) => ({
      id: e.id,
      timestamp: formatInZone(new Date(e.timestamp), tz, fmt, { seconds: true }),
      actor: e.actorName ?? e.actorEmail,
      actorEmail: e.actorEmail,
      action: e.action.toLowerCase() as AuditAction,
      category: e.category.toLowerCase() as AuditCategory,
      resource: e.resource,
      resourceType: e.resourceType,
      source: e.source ?? '—',
      outcome: e.outcome.toLowerCase() as AuditOutcome,
    }));
  }

  get auditTotalPages(): number {
    return Math.max(1, Math.ceil(this.auditTotal / this.auditPageSize));
  }

  get auditPageNumbers(): number[] {
    return Array.from({ length: this.auditTotalPages }, (_, i) => i + 1);
  }

  get auditPageStart(): number {
    if (this.auditTotal === 0) return 0;
    return (this.auditCurrentPage - 1) * this.auditPageSize + 1;
  }

  get auditPageEnd(): number {
    return Math.min(this.auditCurrentPage * this.auditPageSize, this.auditTotal);
  }

  loadAudit(): void {
    this.auditLoading = true;
    this.auditError = null;
    this.auditApi
      .query({
        category: this.auditCategory === 'all' ? undefined : this.auditCategory,
        search: this.auditSearch.trim() || undefined,
        page: this.auditCurrentPage,
        pageSize: this.auditPageSize,
      })
      .subscribe({
        next: (page) => {
          this.auditPage = page.entries;
          this.auditTotal = page.total;
          this.auditLoading = false;
        },
        error: (err) => {
          this.auditError = err?.error?.message || err?.message || 'Failed to load audit log';
          this.auditLoading = false;
        },
      });
  }

  setAuditPage(page: number): void {
    if (page < 1 || page > this.auditTotalPages) return;
    this.auditCurrentPage = page;
    this.loadAudit();
  }

  prevAuditPage(): void { this.setAuditPage(this.auditCurrentPage - 1); }
  nextAuditPage(): void { this.setAuditPage(this.auditCurrentPage + 1); }

  onAuditSearchChange(): void {
    this.auditCurrentPage = 1;
    // Debounce so we don't fire a request on every keystroke.
    if (this.auditDebounce !== undefined) clearTimeout(this.auditDebounce);
    this.auditDebounce = window.setTimeout(() => this.loadAudit(), 250);
  }

  onAuditPageSizeChange(): void {
    this.auditCurrentPage = 1;
    this.loadAudit();
  }

  onAuditCategoryChange(): void {
    this.auditCurrentPage = 1;
    this.loadAudit();
  }

  systemRoleOptions: SystemRole[] = ['system-admin', 'account-viewer', 'license-override', 'user-viewer'];

  systemRoleDescriptions: Record<SystemRole, string> = {
    'system-admin': 'Full system administration access',
    'account-viewer': 'Read-only access to account data',
    'license-override': 'Ability to override licensing restrictions',
    'user-viewer': 'Read-only access to user data',
  };

  // Hydrated from /api/accounts in ngOnInit.
  availableAccounts: AccountOption[] = [];

  // Hydrated from /api/groups in ngOnInit; was previously a hardcoded array.
  apiGroups: ApiUserGroup[] = [];
  apiGroupsLoading = false;
  apiGroupsError: string | null = null;

  // Display-format adapters that wrap the raw API records so the existing
  // template (table + modal) can keep using the lowercase-with-dashes values
  // it was built against. **Memoize on `apiGroups` reference identity + the
  // formatting config** — returning a fresh array on every read causes
  // *ngFor to destroy/rebuild every row each change-detection cycle, which
  // silently breaks click handlers (the button under the cursor disappears
  // before mouseup fires). Config changes invalidate the cache so date
  // columns reflow after a System → Configuration save.
  private _userGroupsCache: {
    src: ApiUserGroup[];
    tz: string;
    fmt: string;
    result: UserGroup[];
  } | null = null;

  get userGroups(): UserGroup[] {
    const tz = this.systemConfig.defaultTimezone || 'UTC';
    const fmt = this.systemConfig.dateFormat || 'YYYY-MM-DD';
    if (
      this._userGroupsCache
      && this._userGroupsCache.src === this.apiGroups
      && this._userGroupsCache.tz === tz
      && this._userGroupsCache.fmt === fmt
    ) {
      return this._userGroupsCache.result;
    }
    const result = this.apiGroups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      systemRoles: g.systemRoles.map(this.systemRoleApiToWire),
      accountAssignments: g.accountAssignments.map((a) => ({
        accountId: a.accountId,
        role: this.systemRoleApiToWire(a.role),
      })),
      created: formatInZone(new Date(g.createdAt), tz, fmt, { dateOnly: true }),
      lastUpdated: formatInZone(new Date(g.updatedAt), tz, fmt, { dateOnly: true }),
    }));
    this._userGroupsCache = { src: this.apiGroups, tz, fmt, result };
    return result;
  }

  private systemRoleApiToWire(r: ApiSystemRole): SystemRole {
    return r.toLowerCase().replace(/_/g, '-') as SystemRole;
  }

  private systemRoleWireToApi(r: SystemRole): ApiSystemRole {
    return r.toUpperCase().replace(/-/g, '_') as ApiSystemRole;
  }

  groupSortKey: GroupSortKey = 'name';
  groupSortDir: 'asc' | 'desc' = 'asc';
  groupSearch = '';
  groupPageSize = 10;
  groupCurrentPage = 1;
  readonly groupPageSizeOptions: number[] = [10, 25, 50, 100];

  groupModalOpen = false;
  editingGroup: UserGroup | null = null;
  groupForm = {
    name: '',
    description: '',
    systemRoles: [] as SystemRole[],
    accountAssignments: [] as AccountAssignment[],
    memberEmails: [] as string[],
  };
  groupFormDirty = false;

  readonly groupNameMax = 128;
  readonly groupDescriptionMax = 5000;

  // ---- Account / API users (Phase 1 backend wiring) -------------------------

  apiUsers: ApiUser[] = [];
  apiUsersLoading = false;
  apiUsersError: string | null = null;

  userModalOpen = false;
  editingUser: ApiUser | null = null;
  userForm = {
    name: '',
    email: '',
    password: '',
    role: 'USER' as ApiRole,
    state: 'ACTIVE' as ApiState,
    groupIds: [] as string[],
  };
  userFormError: string | null = null;
  userFormSaving = false;

  readonly apiRoleOptions: ApiRole[] = ['ADMINISTRATOR', 'MANAGER', 'USER', 'AUDITOR'];
  readonly apiStateOptions: ApiState[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'INVITED'];

  constructor(
    private usersApi: UsersApiService,
    private groupsApi: GroupsApiService,
    private auditApi: AuditApiService,
    private configStore: SystemConfigStore,
    private securityApi: SecurityApiService,
    private settingsService: SettingsService,
    private healthApi: HealthApiService,
    private licenseApi: LicenseApiService,
    private sourcesApi: SourcesApiService,
    private eventsClient: EventsClient,
  ) {}

  ngOnInit(): void {
    this.loadApiGroupsAndAccounts();
    this.loadSecuritySettings();
    this.loadSystemConfig();
    this.loadApiUsers();
    this.loadHealthCheck();
    this.loadLicense();
    this.loadDataSources();

    // Phase 6b — patch the data-sources list in place when the server pushes
    // a status change (test/sync). Drives both the Configuration → Data
    // Sources card *and* the Health tab's per-source pills, since both
    // render off `dataSources`.
    this.eventsClient.on<ApiSource>('source.status').pipe(takeUntil(this.destroy$))
      .subscribe((msg) => this.applySourceStatus(msg.payload));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Replace the matching data-source row with a freshly-mapped DataSource.
  // We reassign the array (not mutate) so any *ngFor with trackBy on
  // identity reflows correctly.
  private applySourceStatus(updated: ApiSource): void {
    const idx = this.dataSources.findIndex((s) => s.id === updated.id);
    const next = this.toDataSource(updated);
    if (idx >= 0) {
      this.dataSources = [
        ...this.dataSources.slice(0, idx),
        next,
        ...this.dataSources.slice(idx + 1),
      ];
    } else {
      this.dataSources = [...this.dataSources, next];
    }
  }

  loadDataSources(): void {
    this.dataSourcesLoading = true;
    this.dataSourcesError = null;
    this.sourcesApi.list().subscribe({
      next: (rows) => {
        this.dataSources = rows.map((r) => this.toDataSource(r));
        this.dataSourcesLoading = false;
      },
      error: (err) => {
        this.dataSourcesError = err?.error?.message || err?.message || 'Failed to load data sources';
        this.dataSourcesLoading = false;
      },
    });
  }

  // Adapter: API uppercase enums → lowercase wire shape the template was
  // built against. STALE collapses into 'disconnected' for display until we
  // add a dedicated stale pill state.
  private toDataSource(r: ApiSource): DataSource {
    const tz = this.systemConfig.defaultTimezone || 'UTC';
    const fmt = this.systemConfig.dateFormat || 'YYYY-MM-DD';
    return {
      id: r.id,
      name: r.name,
      type: this.sourceTypeApiToWire(r.type),
      status: this.sourceStatusApiToWire(r.status),
      lastSync: r.lastSyncAt
        ? formatInZone(new Date(r.lastSyncAt), tz, fmt)
        : 'Never',
      hasCredentials: r.hasCredentials,
    };
  }

  // Phase 5b: Test + Sync are only meaningful for source types we have a
  // connector for, and only when credentials are present. Other types
  // hide the buttons entirely so the UI doesn't promise something we
  // can't do.
  canProbeSource(ds: DataSource): boolean {
    return ds.type === 'postgres' && ds.hasCredentials;
  }

  testSource(ds: DataSource): void {
    this.dataSourceActions[ds.id] = { busy: true };
    this.sourcesApi.test(ds.id).subscribe({
      next: (r: ApiTestSourceResult) => {
        this.dataSourceActions[ds.id] = {
          busy: false,
          ok: r.ok,
          message: r.ok
            ? `Connected · ${r.latencyMs}ms`
            : `Failed: ${r.error || 'unknown error'}`,
        };
        // Refresh the list so the row's status pill picks up the server-
        // side change in the same paint.
        this.loadDataSources();
      },
      error: (err) => {
        this.dataSourceActions[ds.id] = {
          busy: false,
          ok: false,
          message: err?.error?.message || err?.message || 'Test failed',
        };
      },
    });
  }

  // ---- Source modal API ----

  openAddSource(): void {
    this.editingSource = null;
    this.sourceForm = {
      name: '',
      type: 'POSTGRES',
      description: '',
      host: '',
      port: 5432,
      database: '',
      username: '',
      password: '',
    };
    this.sourceFormClearPassword = false;
    this.sourceFormError = null;
    this.sourceModalOpen = true;
  }

  openEditSource(id: string): void {
    this.sourcesApi.get(id).subscribe({
      next: (s) => {
        this.editingSource = s;
        this.sourceForm = {
          name: s.name,
          type: s.type,
          description: s.description,
          host: s.host ?? '',
          port: s.port,
          database: s.database ?? '',
          username: s.username ?? '',
          // Never echoed by the API — leave the input empty and use
          // `hasCredentials` to communicate "a password is stored".
          password: '',
        };
        this.sourceFormClearPassword = false;
        this.sourceFormError = null;
        this.sourceModalOpen = true;
      },
      error: (err) => {
        this.dataSourcesError = err?.error?.message || err?.message || 'Failed to load source';
      },
    });
  }

  closeSourceModal(): void {
    this.sourceModalOpen = false;
    this.editingSource = null;
  }

  // Quality-of-life: when the user changes Type during creation, snap
  // the port to the canonical default for that type (skip if they've
  // already typed something custom or we're editing).
  onSourceTypeChange(): void {
    if (this.editingSource) return;
    const opt = this.sourceTypeOptions.find((o) => o.value === this.sourceForm.type);
    if (opt) this.sourceForm.port = opt.defaultPort;
  }

  canSaveSource(): boolean {
    return this.sourceForm.name.trim().length > 0 && !this.sourceFormSaving;
  }

  saveSource(): void {
    if (!this.canSaveSource()) return;
    this.sourceFormSaving = true;
    this.sourceFormError = null;

    // Build the patch carefully: empty strings for optional text fields
    // become `undefined` (= "don't change") rather than empty values, with
    // the explicit exception of `password === ''` which signals "clear
    // the stored credential" when `sourceFormClearPassword` is set.
    const f = this.sourceForm;
    const payload = {
      name: f.name.trim(),
      type: f.type,
      description: f.description,
      host: f.host || undefined,
      port: f.port ?? undefined,
      database: f.database || undefined,
      username: f.username || undefined,
      password: this.sourceFormClearPassword
        ? ''
        : (f.password ? f.password : undefined),
    };

    const obs = this.editingSource
      ? this.sourcesApi.update(this.editingSource.id, payload)
      : this.sourcesApi.create(payload as { name: string; type: ApiSourceType });

    obs.subscribe({
      next: () => {
        this.sourceFormSaving = false;
        this.sourceModalOpen = false;
        this.editingSource = null;
        this.loadDataSources();
      },
      error: (err) => {
        this.sourceFormError = err?.error?.message || err?.message || 'Failed to save source';
        this.sourceFormSaving = false;
      },
    });
  }

  deleteSource(): void {
    if (!this.editingSource) return;
    const target = this.editingSource;
    const ok = window.confirm(
      `Delete source "${target.name}"? This will remove ${target.assetCount} asset${target.assetCount === 1 ? '' : 's'} and any lineage edges connected to them. This cannot be undone.`,
    );
    if (!ok) return;
    this.sourceFormSaving = true;
    this.sourceFormError = null;
    this.sourcesApi.remove(target.id).subscribe({
      next: () => {
        this.sourceFormSaving = false;
        this.sourceModalOpen = false;
        this.editingSource = null;
        this.loadDataSources();
      },
      error: (err) => {
        this.sourceFormError = err?.error?.message || err?.message || 'Failed to delete source';
        this.sourceFormSaving = false;
      },
    });
  }

  syncSource(ds: DataSource): void {
    this.dataSourceActions[ds.id] = { busy: true };
    this.sourcesApi.sync(ds.id).subscribe({
      next: (r: ApiSyncSourceResult) => {
        this.dataSourceActions[ds.id] = {
          busy: false,
          ok: r.ok,
          message: r.ok
            ? `Synced ${r.upsertedCount} asset${r.upsertedCount === 1 ? '' : 's'} · ${r.durationMs}ms`
            : `Failed: ${r.error || 'unknown error'}`,
        };
        this.loadDataSources();
      },
      error: (err) => {
        this.dataSourceActions[ds.id] = {
          busy: false,
          ok: false,
          message: err?.error?.message || err?.message || 'Sync failed',
        };
      },
    });
  }

  private sourceTypeApiToWire(t: ApiSourceType): DataSourceType {
    return t.toLowerCase().replace(/_/g, '-') as DataSourceType;
  }

  private sourceStatusApiToWire(s: ApiSourceStatus): DataSourceStatus {
    if (s === 'STALE') return 'disconnected';
    return s.toLowerCase() as DataSourceStatus;
  }

  loadLicense(): void {
    this.licenseError = null;
    this.licenseApi.get().subscribe({
      next: (l) => (this.license = l),
      error: (err) => {
        this.licenseError = err?.error?.message || err?.message || 'Failed to load license';
        this.license = null;
      },
    });
  }

  loadApiGroupsAndAccounts(): void {
    this.apiGroupsLoading = true;
    this.apiGroupsError = null;
    forkJoin({
      groups: this.groupsApi.list(),
      accounts: this.groupsApi.listAccounts(),
    }).subscribe({
      next: ({ groups, accounts }) => {
        this.apiGroups = groups;
        this.availableAccounts = accounts.map((a: ApiAccount) => ({ id: a.id, name: a.name }));
        this.apiGroupsLoading = false;
      },
      error: (err) => {
        this.apiGroupsError = err?.error?.message || err?.message || 'Failed to load groups';
        this.apiGroupsLoading = false;
      },
    });
  }

  loadApiUsers(): void {
    this.apiUsersLoading = true;
    this.apiUsersError = null;
    this.usersApi.list().subscribe({
      next: (users) => {
        this.apiUsers = users;
        this.apiUsersLoading = false;
      },
      error: (err) => {
        this.apiUsersError = err?.error?.message || err?.message || 'Failed to load users';
        this.apiUsersLoading = false;
      },
    });
  }

  // ---- Last-administrator lockout protection (mirrors the API guard) ----

  get activeAdminCount(): number {
    return this.apiUsers.filter(u => u.role === 'ADMINISTRATOR' && u.state === 'ACTIVE').length;
  }

  isLastActiveAdmin(user: ApiUser): boolean {
    return user.role === 'ADMINISTRATOR'
      && user.state === 'ACTIVE'
      && this.activeAdminCount <= 1;
  }

  // Returns true when the in-progress edit would leave zero active admins.
  // Only relevant when editing an existing user that's currently an active admin.
  get editWouldRemoveLastAdmin(): boolean {
    if (!this.editingUser) return false;
    const wasActiveAdmin =
      this.editingUser.role === 'ADMINISTRATOR' && this.editingUser.state === 'ACTIVE';
    if (!wasActiveAdmin) return false;
    if (this.activeAdminCount > 1) return false;
    const stillActiveAdmin =
      this.userForm.role === 'ADMINISTRATOR' && this.userForm.state === 'ACTIVE';
    return !stillActiveAdmin;
  }

  userPageSize = 10;
  userCurrentPage = 1;
  readonly userPageSizeOptions: number[] = [10, 25, 50, 100];

  // Search across every visible column.
  get filteredApiUsers(): ApiUser[] {
    const q = this.userSearch.trim().toLowerCase();
    if (!q) return this.apiUsers;
    return this.apiUsers.filter((u) => {
      const haystack = [
        u.name,
        u.email,
        this.apiRoleLabel(u.role),
        this.groupsForUser(u).join(' '),
        this.apiStateLabel(u.state),
        this.apiLastLoginLabel(u.lastLoginAt),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  get userTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredApiUsers.length / this.userPageSize));
  }

  get userPageNumbers(): number[] {
    return Array.from({ length: this.userTotalPages }, (_, i) => i + 1);
  }

  get paginatedApiUsers(): ApiUser[] {
    // Clamp current page in case the filter shrunk the result set.
    if (this.userCurrentPage > this.userTotalPages) {
      this.userCurrentPage = this.userTotalPages;
    }
    const start = (this.userCurrentPage - 1) * this.userPageSize;
    return this.filteredApiUsers.slice(start, start + this.userPageSize);
  }

  get userPageStart(): number {
    if (this.filteredApiUsers.length === 0) return 0;
    return (this.userCurrentPage - 1) * this.userPageSize + 1;
  }

  get userPageEnd(): number {
    return Math.min(this.userCurrentPage * this.userPageSize, this.filteredApiUsers.length);
  }

  setUserPage(page: number): void {
    if (page < 1 || page > this.userTotalPages) return;
    this.userCurrentPage = page;
  }

  prevUserPage(): void {
    this.setUserPage(this.userCurrentPage - 1);
  }

  nextUserPage(): void {
    this.setUserPage(this.userCurrentPage + 1);
  }

  onUserSearchChange(): void {
    this.userCurrentPage = 1;
  }

  onUserPageSizeChange(): void {
    this.userCurrentPage = 1;
  }

  apiRoleLabel(role: ApiRole): string {
    return role.charAt(0) + role.slice(1).toLowerCase();
  }

  apiStateForPill(state: ApiState): string {
    return state.toLowerCase();
  }

  apiStateLabel(state: ApiState): string {
    return state.charAt(0) + state.slice(1).toLowerCase();
  }

  apiLastLoginLabel(iso: string | null): string {
    if (!iso) return 'Never';
    const tz = this.systemConfig.defaultTimezone || 'UTC';
    const fmt = this.systemConfig.dateFormat || 'YYYY-MM-DD';
    return formatInZone(new Date(iso), tz, fmt);
  }

  groupsForUser(user: ApiUser): string[] {
    return (user.groups ?? []).map((g) => g.name);
  }

  openAddUser(): void {
    this.editingUser = null;
    this.userForm = { name: '', email: '', password: '', role: 'USER', state: 'ACTIVE', groupIds: [] };
    this.userFormError = null;
    this.userModalOpen = true;
  }

  openEditUser(user: ApiUser): void {
    this.editingUser = user;
    this.userForm = {
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      state: user.state,
      groupIds: (user.groups ?? []).map((g) => g.id),
    };
    this.userFormError = null;
    this.userModalOpen = true;
  }

  closeUserModal(): void {
    this.userModalOpen = false;
    this.editingUser = null;
    this.userFormError = null;
  }

  canSaveUser(): boolean {
    const nameOk = this.userForm.name.trim().length > 0;
    const emailOk = /\S+@\S+\.\S+/.test(this.userForm.email);
    const passwordOk = !!this.editingUser || this.userForm.password.length >= 8;
    return nameOk && emailOk && passwordOk && !this.editWouldRemoveLastAdmin;
  }

  saveUser(): void {
    if (!this.canSaveUser() || this.userFormSaving) return;
    this.userFormSaving = true;
    this.userFormError = null;

    const payload = {
      name: this.userForm.name.trim(),
      email: this.userForm.email.trim(),
      role: this.userForm.role,
      state: this.userForm.state,
      groupIds: [...this.userForm.groupIds],
      ...(this.userForm.password ? { password: this.userForm.password } : {}),
    };

    const obs$ = this.editingUser
      ? this.usersApi.update(this.editingUser.id, payload)
      : this.usersApi.create(payload as any);

    obs$.subscribe({
      next: (saved) => {
        if (this.editingUser) {
          this.apiUsers = this.apiUsers.map((u) => (u.id === saved.id ? saved : u));
        } else {
          this.apiUsers = [...this.apiUsers, saved];
        }
        // The user's group membership lives on both sides of the relation —
        // refresh the groups list so the Groups tab's memberEmails stays in sync.
        this.loadApiGroupsAndAccounts();
        this.userFormSaving = false;
        this.closeUserModal();
      },
      error: (err) => {
        this.userFormError = err?.error?.message || err?.message || 'Save failed';
        this.userFormSaving = false;
      },
    });
  }

  deleteApiUser(user: ApiUser): void {
    if (this.isLastActiveAdmin(user)) {
      window.alert(
        'Cannot delete the last active administrator. ' +
        'Promote another user to Administrator first.',
      );
      return;
    }
    const ok = window.confirm(`Delete user "${user.name}" (${user.email})?`);
    if (!ok) return;
    this.usersApi.remove(user.id).subscribe({
      next: () => {
        this.apiUsers = this.apiUsers.filter((u) => u.id !== user.id);
      },
      error: (err) => {
        window.alert(err?.error?.message || err?.message || 'Delete failed');
      },
    });
  }

  selectTab(tab: string): void {
    this.activeTab = tab;
    // Lazy-load audit when the user first opens that tab — and refresh on
    // every revisit so newly-recorded events show up.
    if (tab === 'audit') {
      this.loadAudit();
    }
    // Refresh the health probe on every Health-tab visit so the API+DB
    // pills reflect current state, not whatever was true at app load.
    if (tab === 'health') {
      this.loadHealthCheck();
    }
  }

  loadHealthCheck(): void {
    this.healthError = null;
    this.healthApi.check().subscribe({
      next: (result) => {
        // Splice the live components in by name. Two pills currently —
        // API Gateway and Database — but we keep the loop generic in
        // case the backend grows more "platform" components later.
        for (const real of result.components) {
          const idx = this.serviceStatuses.findIndex((s) => s.name === real.name);
          if (idx >= 0) {
            this.serviceStatuses[idx] = this.toServiceStatus(real);
          }
        }
        this.healthLastCheckedAt = result.timestamp;
      },
      error: (err) => {
        this.healthError = err?.error?.message || err?.message || 'Health probe failed';
        // Fail visibly: mark all platform pills as down so it's clear the
        // page doesn't have authoritative data.
        for (const s of this.serviceStatuses) {
          s.status = 'danger';
          s.label = 'Unreachable';
        }
      },
    });

    this.healthApi.metrics().subscribe({
      next: (m) => (this.healthMetrics = m),
      error: () => (this.healthMetrics = null),
    });
  }

  // Phase 5c: each registered Source becomes a pill on the Health tab.
  // `dataSources` is already loaded on init + refreshed on every Test/Sync,
  // so this getter just maps display states without a new fetch.
  get dataSourceStatuses(): ServiceStatus[] {
    return this.dataSources.map((ds) => ({
      name: ds.name,
      status: this.dataSourceHealthStatus(ds.status),
      label: this.dataSourceHealthLabel(ds),
    }));
  }

  private dataSourceHealthStatus(s: DataSourceStatus): HealthStatus {
    if (s === 'connected') return 'success';
    if (s === 'degraded') return 'warning';
    return 'danger';
  }

  private dataSourceHealthLabel(ds: DataSource): string {
    switch (ds.status) {
      case 'connected':    return 'Connected';
      case 'degraded':     return 'Degraded';
      case 'disconnected': return 'Disconnected';
    }
  }

  // Memory % of system total — used by the Memory card's "App" bar so it's
  // expressed against the same denominator as the System bar (apples-to-apples).
  // Memory ratio for the App row of the Health Memory card. The denominator
  // is host total RAM — meaningful absolute scale ("Nexus is using 1.2 GB of
  // a 36 GB host"). The "System used" half-row was dropped: `os.freemem()`
  // on macOS / Linux excludes file-cache RAM, which makes the bar pinned
  // near 100% even when the host is healthy. See lesson #12 in root
  // CLAUDE.md.
  appMemoryPercent(): number {
    if (!this.healthMetrics) return 0;
    const total = this.healthMetrics.system.memoryTotalBytes || 1;
    return (this.healthMetrics.app.memoryRssBytes / total) * 100;
  }


  // Map a 0–100 percentage to the same status colours used elsewhere.
  percentStatus(percent: number): HealthStatus {
    if (percent >= 90) return 'danger';
    if (percent >= 75) return 'warning';
    return 'success';
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
  }

  private toServiceStatus(c: ApiHealthComponent): ServiceStatus {
    const latencySuffix =
      c.latencyMs !== undefined && c.status === 'success' ? ` · ${c.latencyMs}ms` : '';
    return {
      name: c.name,
      // ApiComponentStatus is a strict subset of HealthStatus.
      status: c.status as HealthStatus,
      label: `${c.label}${latencySuffix}`,
    };
  }

  // Groups now persist via /api/groups (Phase 2). Old localStorage payloads
  // (key `nexus-user-groups`) are ignored; the API is the source of truth.

  // mfaMode/tlsMinimumVersion arrive as plain strings from the wire; narrow
  // back to their literal unions when projecting onto SecuritySettings.
  private fromApiSecurity(s: ApiSecuritySettings): SecuritySettings {
    return {
      loginMethods: s.loginMethods as LoginMethod[],
      mfaMode: s.mfaMode as MfaMode,
      ssoIssuer: s.ssoIssuer,
      sessionTimeoutMinutes: s.sessionTimeoutMinutes,
      rememberMeEnabled: s.rememberMeEnabled,
      passwordMinLength: s.passwordMinLength,
      passwordRequireUppercase: s.passwordRequireUppercase,
      passwordRequireLowercase: s.passwordRequireLowercase,
      passwordRequireNumber: s.passwordRequireNumber,
      passwordRequireSymbol: s.passwordRequireSymbol,
      passwordExpiryDays: s.passwordExpiryDays,
      passwordHistoryCount: s.passwordHistoryCount,
      failedAttemptThreshold: s.failedAttemptThreshold,
      lockoutDurationMinutes: s.lockoutDurationMinutes,
      ipAllowlist: s.ipAllowlist,
      rateLimitPerMinute: s.rateLimitPerMinute,
      tlsMinimumVersion: s.tlsMinimumVersion as TlsVersion,
      encryptionAtRest: s.encryptionAtRest,
      auditRetentionDays: s.auditRetentionDays,
    };
  }

  private loadSecuritySettings(): void {
    this.securitySettingsLoading = true;
    this.securitySettingsError = null;
    this.securityApi.get().subscribe({
      next: (s) => {
        this.securitySettings = this.fromApiSecurity(s);
        this.securitySettingsBaseline = { ...this.securitySettings };
        this.securitySettingsLoading = false;
      },
      error: (err) => {
        this.securitySettingsError = err?.error?.message || err?.message || 'Failed to load security settings';
        this.securitySettingsLoading = false;
      },
    });
  }

  saveSecuritySettings(): void {
    this.securitySettingsSaving = true;
    this.securitySettingsError = null;
    this.securityApi.update({ ...this.securitySettings }).subscribe({
      next: (s) => {
        this.securitySettings = this.fromApiSecurity(s);
        this.securitySettingsBaseline = { ...this.securitySettings };
        this.securitySettingsSaving = false;
        this.securitySaved = true;
        if (this.securitySavedTimer !== undefined) {
          clearTimeout(this.securitySavedTimer);
        }
        this.securitySavedTimer = window.setTimeout(() => (this.securitySaved = false), 2500);
      },
      error: (err) => {
        this.securitySettingsError = err?.error?.message || err?.message || 'Failed to save security settings';
        this.securitySettingsSaving = false;
      },
    });
  }

  resetSecuritySettings(): void {
    this.securitySettings = { ...this.securitySettingsBaseline };
  }

  restoreSecurityDefaults(): void {
    const ok = window.confirm('Reset all security settings to defaults? Unsaved changes will be lost.');
    if (!ok) return;
    this.securitySettings = { ...this.defaultSecuritySettings };
  }

  get securityDirty(): boolean {
    return JSON.stringify(this.securitySettings) !== JSON.stringify(this.securitySettingsBaseline);
  }

  toggleLoginMethod(method: LoginMethod, enabled: boolean): void {
    if (enabled) {
      if (!this.securitySettings.loginMethods.includes(method)) {
        this.securitySettings.loginMethods = [...this.securitySettings.loginMethods, method];
      }
    } else {
      this.securitySettings.loginMethods = this.securitySettings.loginMethods.filter(m => m !== method);
    }
  }

  isLoginMethodEnabled(method: LoginMethod): boolean {
    return this.securitySettings.loginMethods.includes(method);
  }

  // defaultTheme / firstDayOfWeek / plan arrive as plain strings; narrow back
  // to their literal unions. notificationEvents is deep-cloned so the
  // baseline copy doesn't share references with the live form.
  private fromApiConfig(c: ApiSystemConfig): SystemConfig {
    return {
      appNameOverride: c.appNameOverride,
      defaultTheme: c.defaultTheme as ThemeChoice,
      defaultLocale: c.defaultLocale,
      defaultTimezone: c.defaultTimezone,
      dateFormat: c.dateFormat,
      firstDayOfWeek: c.firstDayOfWeek as FirstDayOfWeek,
      defaultRefreshSeconds: c.defaultRefreshSeconds,
      defaultRetryAttempts: c.defaultRetryAttempts,
      retryBackoffMultiplier: c.retryBackoffMultiplier,
      maxConcurrentConnectors: c.maxConcurrentConnectors,
      smtpHost: c.smtpHost,
      smtpPort: c.smtpPort,
      smtpRequireAuth: c.smtpRequireAuth,
      smtpUsername: c.smtpUsername,
      smtpFromAddress: c.smtpFromAddress,
      notificationEvents: c.notificationEvents.map(e => ({ ...e })),
      slackWebhookUrl: c.slackWebhookUrl,
      teamsWebhookUrl: c.teamsWebhookUrl,
      cacheTtlSeconds: c.cacheTtlSeconds,
      queryTimeoutSeconds: c.queryTimeoutSeconds,
      maxUploadMb: c.maxUploadMb,
      maxConcurrentJobs: c.maxConcurrentJobs,
      workerPoolSize: c.workerPoolSize,
    };
  }

  private loadSystemConfig(): void {
    this.systemConfigLoading = true;
    this.systemConfigError = null;
    this.configStore.refresh().subscribe({
      next: (c) => {
        this.systemConfig = this.fromApiConfig(c);
        this.systemConfigBaseline = JSON.parse(JSON.stringify(this.systemConfig));
        this.systemConfigLoading = false;
      },
      error: (err) => {
        this.systemConfigError = err?.error?.message || err?.message || 'Failed to load system configuration';
        this.systemConfigLoading = false;
      },
    });
  }

  saveSystemConfig(): void {
    this.systemConfigSaving = true;
    this.systemConfigError = null;
    this.configStore.update({ ...this.systemConfig }).subscribe({
      next: (c) => {
        this.systemConfig = this.fromApiConfig(c);
        this.systemConfigBaseline = JSON.parse(JSON.stringify(this.systemConfig));
        // The "Default theme" is documented as the global default. Apply it to
        // the current session on save so the admin sees their change take
        // effect; the personal sun/moon toggle still overrides afterwards.
        this.settingsService.setTheme(this.systemConfig.defaultTheme);
        this.systemConfigSaving = false;
        this.systemConfigSaved = true;
        if (this.systemConfigSavedTimer !== undefined) {
          clearTimeout(this.systemConfigSavedTimer);
        }
        this.systemConfigSavedTimer = window.setTimeout(() => (this.systemConfigSaved = false), 2500);
      },
      error: (err) => {
        this.systemConfigError = err?.error?.message || err?.message || 'Failed to save system configuration';
        this.systemConfigSaving = false;
      },
    });
  }

  resetSystemConfig(): void {
    this.systemConfig = JSON.parse(JSON.stringify(this.systemConfigBaseline));
  }

  restoreSystemConfigDefaults(): void {
    const ok = window.confirm('Reset all system configuration to defaults? Unsaved changes will be lost.');
    if (!ok) return;
    this.systemConfig = JSON.parse(JSON.stringify(this.defaultSystemConfig));
  }

  get systemConfigDirty(): boolean {
    return JSON.stringify(this.systemConfig) !== JSON.stringify(this.systemConfigBaseline);
  }

  maskedLicenseKey(): string {
    const key = this.license?.licenseKey ?? '';
    if (!key) return '';
    const segments = key.split('-');
    if (segments.length < 3) return key;
    return segments
      .map((seg, i) => (i < segments.length - 2 ? '••••' : seg))
      .join('-');
  }

  // Empty `licenseExpires` means "perpetual" — surfaced as a friendlier label
  // than blank. Stored values are ISO `YYYY-MM-DD`, formatted in the saved
  // timezone + date pattern.
  licenseExpiresDisplay(): string {
    const v = this.license?.licenseExpires ?? '';
    if (!v) return 'Never expires';
    const tz = this.systemConfig.defaultTimezone || 'UTC';
    const fmt = this.systemConfig.dateFormat || 'YYYY-MM-DD';
    return formatInZone(new Date(`${v}T00:00:00Z`), tz, fmt, { dateOnly: true });
  }

  planLabel(plan: string): string {
    if (!plan) return '';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }

  // Seats-in-use comes from the live user count; total comes from the
  // license. License is install-time, users come and go independently.
  get seatsPercent(): number {
    const total = this.license?.seatsTotal || 1;
    return Math.min(100, Math.round((this.apiUsers.length / total) * 100));
  }

  get seatsStatus(): 'success' | 'info' | 'warning' | 'danger' {
    const pct = this.seatsPercent;
    if (pct >= 95) return 'danger';
    if (pct >= 80) return 'warning';
    if (pct >= 50) return 'info';
    return 'success';
  }

  dataSourceStatusLabel(s: DataSourceStatus): string {
    switch (s) {
      case 'connected':    return 'Connected';
      case 'degraded':     return 'Degraded';
      case 'disconnected': return 'Disconnected';
    }
  }

  dataSourceStatusPillState(s: DataSourceStatus): 'active' | 'invited' | 'suspended' {
    switch (s) {
      case 'connected':    return 'active';
      case 'degraded':     return 'invited';
      case 'disconnected': return 'suspended';
    }
  }

  passwordStrengthHint(): string {
    const reqs = [
      this.securitySettings.passwordRequireLowercase,
      this.securitySettings.passwordRequireUppercase,
      this.securitySettings.passwordRequireNumber,
      this.securitySettings.passwordRequireSymbol,
    ].filter(Boolean).length;
    if (this.securitySettings.passwordMinLength >= 14 && reqs >= 4) return 'Strong';
    if (this.securitySettings.passwordMinLength >= 10 && reqs >= 2) return 'Moderate';
    return 'Weak';
  }

  accountName(accountId: string): string {
    return this.availableAccounts.find(a => a.id === accountId)?.name ?? accountId;
  }

  accountSummary(group: UserGroup): { account: string; role: string }[] {
    return group.accountAssignments.map(a => ({
      account: this.accountName(a.accountId),
      role: a.role || '—',
    }));
  }

  get sortedGroups(): UserGroup[] {
    const dir = this.groupSortDir === 'asc' ? 1 : -1;
    const key = this.groupSortKey;
    const q = this.groupSearch.trim().toLowerCase();
    const filtered = !q
      ? [...this.userGroups]
      : this.userGroups.filter(g => {
          const accountsText = g.accountAssignments
            .map(x => `${this.accountName(x.accountId)} ${x.role}`).join(' ');
          const haystack = [
            g.name, g.description, g.systemRoles.join(' '),
            accountsText, g.created, g.lastUpdated,
          ].join(' ').toLowerCase();
          return haystack.includes(q);
        });
    return filtered.sort((a, b) => {
      const av = key === 'accountSummary'
        ? a.accountAssignments.map(x => this.accountName(x.accountId)).join(',')
        : (a[key] as string);
      const bv = key === 'accountSummary'
        ? b.accountAssignments.map(x => this.accountName(x.accountId)).join(',')
        : (b[key] as string);
      return av.localeCompare(bv) * dir;
    });
  }

  get groupTotalPages(): number {
    return Math.max(1, Math.ceil(this.sortedGroups.length / this.groupPageSize));
  }

  get groupPageNumbers(): number[] {
    return Array.from({ length: this.groupTotalPages }, (_, i) => i + 1);
  }

  get paginatedGroups(): UserGroup[] {
    if (this.groupCurrentPage > this.groupTotalPages) {
      this.groupCurrentPage = this.groupTotalPages;
    }
    const start = (this.groupCurrentPage - 1) * this.groupPageSize;
    return this.sortedGroups.slice(start, start + this.groupPageSize);
  }

  get groupPageStart(): number {
    if (this.sortedGroups.length === 0) return 0;
    return (this.groupCurrentPage - 1) * this.groupPageSize + 1;
  }

  get groupPageEnd(): number {
    return Math.min(this.groupCurrentPage * this.groupPageSize, this.sortedGroups.length);
  }

  setGroupPage(page: number): void {
    if (page < 1 || page > this.groupTotalPages) return;
    this.groupCurrentPage = page;
  }
  prevGroupPage(): void { this.setGroupPage(this.groupCurrentPage - 1); }
  nextGroupPage(): void { this.setGroupPage(this.groupCurrentPage + 1); }
  onGroupSearchChange(): void { this.groupCurrentPage = 1; }
  onGroupPageSizeChange(): void { this.groupCurrentPage = 1; }

  sortBy(key: GroupSortKey): void {
    if (this.groupSortKey === key) {
      this.groupSortDir = this.groupSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.groupSortKey = key;
      this.groupSortDir = 'asc';
    }
  }

  openAddGroup(): void {
    this.editingGroup = null;
    this.groupForm = {
      name: '',
      description: '',
      systemRoles: [],
      accountAssignments: [],
      memberEmails: [],
    };
    this.groupFormDirty = false;
    this.groupModalOpen = true;
  }

  openEditGroup(group: UserGroup): void {
    const apiGroup = this.apiGroups.find((g) => g.id === group.id);
    this.editingGroup = group;
    this.groupForm = {
      name: group.name,
      description: group.description,
      systemRoles: [...(group.systemRoles ?? [])],
      accountAssignments: (group.accountAssignments ?? []).map((a) => ({ ...a })),
      memberEmails: apiGroup ? [...apiGroup.memberEmails] : [],
    };
    this.groupFormDirty = false;
    this.groupModalOpen = true;
  }

  closeGroupModal(force = false): void {
    if (!force && this.groupFormDirty) {
      const ok = window.confirm('Discard changes?');
      if (!ok) return;
    }
    this.groupModalOpen = false;
    this.editingGroup = null;
  }

  markGroupFormDirty(): void {
    this.groupFormDirty = true;
  }

  toggleAccountInGroup(accountId: string, checked: boolean): void {
    if (checked) {
      if (!this.groupForm.accountAssignments.some(a => a.accountId === accountId)) {
        this.groupForm.accountAssignments.push({ accountId, role: '' });
      }
    } else {
      this.groupForm.accountAssignments = this.groupForm.accountAssignments.filter(a => a.accountId !== accountId);
    }
    this.markGroupFormDirty();
  }

  isAccountInGroup(accountId: string): boolean {
    return this.groupForm.accountAssignments.some(a => a.accountId === accountId);
  }

  setAccountRole(accountId: string, role: SystemRole | ''): void {
    const a = this.groupForm.accountAssignments.find(x => x.accountId === accountId);
    if (a) a.role = role;
    this.markGroupFormDirty();
  }

  getAccountRole(accountId: string): SystemRole | '' {
    return this.groupForm.accountAssignments.find(a => a.accountId === accountId)?.role ?? '';
  }

  canSaveGroup(): boolean {
    return this.groupForm.name.trim().length > 0
      && this.groupForm.name.length <= this.groupNameMax
      && this.groupForm.description.length <= this.groupDescriptionMax;
  }

  saveGroup(): void {
    if (!this.canSaveGroup()) return;

    const payload = {
      name: this.groupForm.name.trim(),
      description: this.groupForm.description.trim(),
      systemRoles: this.groupForm.systemRoles.map((r) => this.systemRoleWireToApi(r)),
      accountAssignments: this.groupForm.accountAssignments
        .filter((a) => a.role)
        .map((a) => ({
          accountId: a.accountId,
          role: this.systemRoleWireToApi(a.role as SystemRole),
        })),
      memberEmails: [...this.groupForm.memberEmails],
    };

    const obs$ = this.editingGroup
      ? this.groupsApi.update(this.editingGroup.id, payload)
      : this.groupsApi.create(payload);

    obs$.subscribe({
      next: (saved) => {
        if (this.editingGroup) {
          this.apiGroups = this.apiGroups.map((g) => (g.id === saved.id ? saved : g));
        } else {
          this.apiGroups = [...this.apiGroups, saved];
        }
        // Group membership is mirrored on the user side — refresh so the
        // Account tab's chips reflect the new memberships.
        this.loadApiUsers();
        this.closeGroupModal(true);
      },
      error: (err) => {
        window.alert(err?.error?.message || err?.message || 'Save failed');
      },
    });
  }

  deleteGroup(group: UserGroup): void {
    const ok = window.confirm(`Delete user group "${group.name}"?`);
    if (!ok) return;
    this.groupsApi.remove(group.id).subscribe({
      next: () => {
        this.apiGroups = this.apiGroups.filter((g) => g.id !== group.id);
        // Group membership is part of the user response; keep the Account
        // tab's chips in sync when groups change.
        this.loadApiUsers();
      },
      error: (err) => {
        window.alert(err?.error?.message || err?.message || 'Delete failed');
      },
    });
  }

  statusIcon(status: HealthStatus): string {
    switch (status) {
      case 'success': return 'checkmark-circle-2-outline';
      case 'warning': return 'alert-triangle-outline';
      case 'danger': return 'close-circle-outline';
      default: return 'info-outline';
    }
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

  stateLabel(state: UserState): string {
    return state.charAt(0).toUpperCase() + state.slice(1);
  }

  actionIcon(action: AuditAction): string {
    switch (action) {
      case 'create': return 'plus-circle-outline';
      case 'update': return 'edit-2-outline';
      case 'delete': return 'trash-2-outline';
      case 'login':  return 'log-in-outline';
      case 'logout': return 'log-out-outline';
      case 'access': return 'eye-outline';
      case 'export': return 'download-outline';
      default:       return 'activity-outline';
    }
  }
}