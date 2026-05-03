import {
  AssetDomain,
  AssetTag,
  AssetType,
  PrismaClient,
  SourceStatus,
  SourceType,
  SystemRole,
  UserRole,
  UserState,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { encryptSecret } from '../src/sources/connectors/credentials';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'nexus123';

const seedUsers = [
  { email: 'john.doe@nexus.com',     name: 'John Doe',     role: UserRole.ADMINISTRATOR, state: UserState.ACTIVE,    lastLoginAt: new Date('2026-04-30T14:30:00Z') },
  { email: 'jane.smith@nexus.com',   name: 'Jane Smith',   role: UserRole.MANAGER,       state: UserState.ACTIVE,    lastLoginAt: new Date('2026-04-30T09:15:00Z') },
  { email: 'mike.johnson@nexus.com', name: 'Mike Johnson', role: UserRole.USER,          state: UserState.INACTIVE,  lastLoginAt: new Date('2026-04-28T16:45:00Z') },
  { email: 'sarah.wilson@nexus.com', name: 'Sarah Wilson', role: UserRole.USER,          state: UserState.ACTIVE,    lastLoginAt: new Date('2026-04-30T11:20:00Z') },
  { email: 'david.brown@nexus.com',  name: 'David Brown',  role: UserRole.MANAGER,       state: UserState.SUSPENDED, lastLoginAt: new Date('2026-04-25T13:10:00Z') },
  { email: 'priya.patel@nexus.com',  name: 'Priya Patel',  role: UserRole.AUDITOR,       state: UserState.INVITED,   lastLoginAt: null },
];

const seedAccounts = [
  { id: 'acc-prod',    name: 'Production' },
  { id: 'acc-staging', name: 'Staging' },
  { id: 'acc-dev',     name: 'Development' },
  { id: 'acc-sandbox', name: 'Sandbox' },
];

interface SeedGroup {
  name: string;
  description: string;
  systemRoles: SystemRole[];
  accountAssignments: { accountId: string; role: SystemRole }[];
  memberEmails: string[];
}

const seedGroups: SeedGroup[] = [
  {
    name: 'Platform Admins',
    description: 'Full administrative access across all accounts.',
    systemRoles: [SystemRole.SYSTEM_ADMIN],
    accountAssignments: [
      { accountId: 'acc-prod',    role: SystemRole.SYSTEM_ADMIN },
      { accountId: 'acc-staging', role: SystemRole.SYSTEM_ADMIN },
    ],
    memberEmails: ['john.doe@nexus.com'],
  },
  {
    name: 'Compliance Auditors',
    description: 'Read-only access for auditing and reporting.',
    systemRoles: [SystemRole.ACCOUNT_VIEWER, SystemRole.USER_VIEWER],
    accountAssignments: [
      { accountId: 'acc-prod',    role: SystemRole.ACCOUNT_VIEWER },
      { accountId: 'acc-staging', role: SystemRole.ACCOUNT_VIEWER },
      { accountId: 'acc-dev',     role: SystemRole.USER_VIEWER },
    ],
    memberEmails: ['priya.patel@nexus.com'],
  },
  {
    name: 'License Managers',
    description: 'Override licensing limits during incident response.',
    systemRoles: [SystemRole.LICENSE_OVERRIDE],
    accountAssignments: [
      { accountId: 'acc-prod', role: SystemRole.LICENSE_OVERRIDE },
    ],
    memberEmails: ['jane.smith@nexus.com', 'david.brown@nexus.com'],
  },
  {
    name: 'Sandbox Developers',
    description: 'Engineering team access scoped to non-production accounts.',
    systemRoles: [SystemRole.USER_VIEWER],
    accountAssignments: [
      { accountId: 'acc-dev',     role: SystemRole.USER_VIEWER },
      { accountId: 'acc-sandbox', role: SystemRole.USER_VIEWER },
    ],
    memberEmails: ['sarah.wilson@nexus.com', 'david.brown@nexus.com'],
  },
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const u of seedUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, state: u.state, lastLoginAt: u.lastLoginAt },
      create: { ...u, passwordHash },
    });
  }
  console.log(`Seeded ${seedUsers.length} users (password: '${SEED_PASSWORD}')`);

  for (const a of seedAccounts) {
    await prisma.account.upsert({
      where: { id: a.id },
      update: { name: a.name },
      create: a,
    });
  }
  console.log(`Seeded ${seedAccounts.length} accounts`);

  // ---- Sources & Assets (Phase 5a) ---------------------------------------

  // Most of these are aspirational — connection params are nulled out
  // because the systems don't actually exist. The exception is `orders-db`,
  // which we point at the local Nexus Postgres (same DB the API itself
  // uses) so Phase 5b's test/sync flow has something live to dogfood
  // against. Re-running the seed re-encrypts the password (a fresh IV
  // each time) but the plaintext stays the same.
  const seedSources: Array<{
    name: string;
    type: SourceType;
    status: SourceStatus;
    description: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
  }> = [
    {
      name: 'orders-db',
      type: SourceType.POSTGRES,
      status: SourceStatus.DISCONNECTED, // flips to CONNECTED on first /test
      description: 'Local Nexus Postgres — used to dogfood the connector pipeline.',
      host: 'localhost', port: 5432, database: 'nexus',
      username: 'nexus', password: 'nexus',
    },
    { name: 'analytics-warehouse', type: SourceType.SNOWFLAKE, status: SourceStatus.CONNECTED,    description: 'Modeled fact and dim views for analytics + reporting.' },
    { name: 'metrics-stream',      type: SourceType.KAFKA,     status: SourceStatus.DEGRADED,     description: 'Event stream for product analytics. 30-day retention.' },
    { name: 'object-store',        type: SourceType.S3,        status: SourceStatus.CONNECTED,    description: 'Cold storage for raw event JSON.' },
    { name: 'partner-api',         type: SourceType.REST_API,  status: SourceStatus.DISCONNECTED, description: 'Live inventory feed from supply partner.' },
    { name: 'session-cache',       type: SourceType.REDIS,     status: SourceStatus.CONNECTED,    description: 'In-memory session cache.' },
  ];

  for (const s of seedSources) {
    const data = {
      type: s.type,
      status: s.status,
      description: s.description,
      host: s.host ?? null,
      port: s.port ?? null,
      database: s.database ?? null,
      username: s.username ?? null,
      passwordEncrypted: s.password ? encryptSecret(s.password) : null,
    };
    await prisma.source.upsert({
      where: { name: s.name },
      update: data,
      create: { name: s.name, ...data },
    });
  }
  console.log(`Seeded ${seedSources.length} sources`);

  // Build a name → id map for the asset upserts.
  const sourceRows = await prisma.source.findMany({ select: { id: true, name: true } });
  const sourceIdByName = new Map(sourceRows.map((s) => [s.name, s.id]));

  interface SeedAsset {
    name: string;
    qualifiedName: string;
    type: AssetType;
    sourceName: string;
    schema: { name: string; type: string; pii?: boolean }[];
    rowCount: number;
    sizeMb: number;
    ownerEmail: string | null;
    ownerName: string | null;
    domain: AssetDomain;
    tags: AssetTag[];
    description: string;
    upstream: string[];
    downstream: string[];
  }

  const owners = {
    jane:  { email: 'jane.smith@nexus.com',   name: 'Jane Smith' },
    john:  { email: 'john.doe@nexus.com',     name: 'John Doe' },
    sarah: { email: 'sarah.wilson@nexus.com', name: 'Sarah Wilson' },
    mike:  { email: 'mike.johnson@nexus.com', name: 'Mike Johnson' },
    priya: { email: 'priya.patel@nexus.com',  name: 'Priya Patel' },
    david: { email: 'david.brown@nexus.com',  name: 'David Brown' },
  };

  const seedAssets: SeedAsset[] = [
    {
      name: 'transactions',
      qualifiedName: 'orders-db.public.transactions',
      type: AssetType.TABLE, sourceName: 'orders-db',
      schema: [
        { name: 'transaction_id', type: 'uuid' },
        { name: 'customer_id', type: 'uuid' },
        { name: 'amount_cents', type: 'bigint' },
        { name: 'currency', type: 'varchar(3)' },
        { name: 'created_at', type: 'timestamp' },
        { name: 'card_last4', type: 'varchar(4)', pii: true },
      ],
      rowCount: 14_280_000, sizeMb: 8_420,
      ownerEmail: owners.jane.email, ownerName: owners.jane.name,
      domain: AssetDomain.SALES, tags: [AssetTag.CERTIFIED, AssetTag.GOLDEN],
      description: 'Authoritative ledger of every customer transaction. Streaming CDC into the warehouse every minute.',
      upstream: [],
      downstream: ['analytics-warehouse.dim.customer_lifetime_value', 'analytics-warehouse.fact.daily_revenue', 'object-store.s3://nexus-raw/2026-05/'],
    },
    {
      name: 'customers',
      qualifiedName: 'orders-db.public.customers',
      type: AssetType.TABLE, sourceName: 'orders-db',
      schema: [
        { name: 'customer_id', type: 'uuid' },
        { name: 'email', type: 'varchar', pii: true },
        { name: 'full_name', type: 'varchar', pii: true },
        { name: 'country', type: 'char(2)' },
        { name: 'signed_up_at', type: 'timestamp' },
      ],
      rowCount: 3_120_000, sizeMb: 1_180,
      ownerEmail: owners.jane.email, ownerName: owners.jane.name,
      domain: AssetDomain.SALES, tags: [AssetTag.CERTIFIED, AssetTag.PII, AssetTag.GDPR],
      description: 'Master customer record. Source of truth for billing and CRM sync.',
      upstream: [],
      downstream: ['analytics-warehouse.dim.customer_lifetime_value', 'orders-db.compliance.gdpr_export_jobs'],
    },
    {
      name: 'products',
      qualifiedName: 'orders-db.public.products',
      type: AssetType.TABLE, sourceName: 'orders-db',
      schema: [
        { name: 'product_id', type: 'uuid' },
        { name: 'sku', type: 'varchar' },
        { name: 'name', type: 'varchar' },
        { name: 'price_cents', type: 'integer' },
        { name: 'is_active', type: 'boolean' },
      ],
      rowCount: 12_400, sizeMb: 8,
      ownerEmail: owners.mike.email, ownerName: owners.mike.name,
      domain: AssetDomain.PRODUCT, tags: [AssetTag.CERTIFIED],
      description: 'Active and historical product catalog.',
      upstream: [],
      downstream: ['analytics-warehouse.fact.marketing_attribution'],
    },
    {
      name: 'refunds',
      qualifiedName: 'orders-db.public.refunds',
      type: AssetType.TABLE, sourceName: 'orders-db',
      schema: [
        { name: 'refund_id', type: 'uuid' },
        { name: 'transaction_id', type: 'uuid' },
        { name: 'amount_cents', type: 'bigint' },
        { name: 'reason', type: 'varchar' },
        { name: 'created_at', type: 'timestamp' },
      ],
      rowCount: 184_000, sizeMb: 92,
      ownerEmail: owners.jane.email, ownerName: owners.jane.name,
      domain: AssetDomain.FINANCE, tags: [AssetTag.CERTIFIED],
      description: 'Refund events linked back to transactions.',
      upstream: ['orders-db.public.transactions'],
      downstream: ['analytics-warehouse.fact.daily_revenue'],
    },
    {
      name: 'page_views',
      qualifiedName: 'metrics-stream.events.page_views',
      type: AssetType.TOPIC, sourceName: 'metrics-stream',
      schema: [
        { name: 'session_id', type: 'string' },
        { name: 'user_id', type: 'string', pii: true },
        { name: 'url', type: 'string' },
        { name: 'referrer', type: 'string' },
        { name: 'timestamp', type: 'timestamp' },
      ],
      rowCount: 482_000_000, sizeMb: 142_300,
      ownerEmail: owners.priya.email, ownerName: owners.priya.name,
      domain: AssetDomain.MARKETING, tags: [AssetTag.PII],
      description: 'Every page-view event from the web and mobile apps. Retention 30 days.',
      upstream: [],
      downstream: ['analytics-warehouse.fact.marketing_attribution', 'metrics-stream.events.app_clicks'],
    },
    {
      name: 'customer_lifetime_value',
      qualifiedName: 'analytics-warehouse.dim.customer_lifetime_value',
      type: AssetType.VIEW, sourceName: 'analytics-warehouse',
      schema: [
        { name: 'customer_id', type: 'string' },
        { name: 'tenure_days', type: 'integer' },
        { name: 'total_spend_usd', type: 'decimal(12,2)' },
        { name: 'predicted_ltv_usd', type: 'decimal(12,2)' },
        { name: 'segment', type: 'varchar' },
      ],
      rowCount: 3_120_000, sizeMb: 480,
      ownerEmail: owners.sarah.email, ownerName: owners.sarah.name,
      domain: AssetDomain.MARKETING, tags: [AssetTag.CERTIFIED, AssetTag.GOLDEN],
      description: 'Modelled customer lifetime value, refreshed nightly. Joined from transactions and customers.',
      upstream: ['orders-db.public.transactions', 'orders-db.public.customers'],
      downstream: ['analytics-warehouse.fact.monthly_kpis'],
    },
    {
      name: 'daily_revenue',
      qualifiedName: 'analytics-warehouse.fact.daily_revenue',
      type: AssetType.VIEW, sourceName: 'analytics-warehouse',
      schema: [
        { name: 'date', type: 'date' },
        { name: 'gross_usd', type: 'decimal(14,2)' },
        { name: 'refunds_usd', type: 'decimal(14,2)' },
        { name: 'net_usd', type: 'decimal(14,2)' },
        { name: 'currency', type: 'varchar(3)' },
      ],
      rowCount: 1_460, sizeMb: 1,
      ownerEmail: owners.david.email, ownerName: owners.david.name,
      domain: AssetDomain.FINANCE, tags: [AssetTag.CERTIFIED, AssetTag.GOLDEN],
      description: 'Net daily revenue, used by exec reporting.',
      upstream: ['orders-db.public.transactions', 'orders-db.public.refunds'],
      downstream: ['analytics-warehouse.fact.monthly_kpis'],
    },
    {
      name: 'marketing_attribution',
      qualifiedName: 'analytics-warehouse.fact.marketing_attribution',
      type: AssetType.VIEW, sourceName: 'analytics-warehouse',
      schema: [
        { name: 'date', type: 'date' },
        { name: 'channel', type: 'varchar' },
        { name: 'campaign_id', type: 'varchar' },
        { name: 'first_touch_attribution_usd', type: 'decimal' },
        { name: 'last_touch_attribution_usd', type: 'decimal' },
      ],
      rowCount: 96_000, sizeMb: 31,
      ownerEmail: owners.priya.email, ownerName: owners.priya.name,
      domain: AssetDomain.MARKETING, tags: [AssetTag.CERTIFIED],
      description: 'Attribution model joining web events with conversions.',
      upstream: ['orders-db.public.products', 'metrics-stream.events.page_views'],
      downstream: [],
    },
    {
      name: 'gdpr_export_jobs',
      qualifiedName: 'orders-db.compliance.gdpr_export_jobs',
      type: AssetType.TABLE, sourceName: 'orders-db',
      schema: [
        { name: 'job_id', type: 'uuid' },
        { name: 'customer_id', type: 'uuid' },
        { name: 'requested_at', type: 'timestamp' },
        { name: 'status', type: 'varchar' },
        { name: 'output_url', type: 'varchar' },
      ],
      rowCount: 1_840, sizeMb: 1,
      ownerEmail: owners.john.email, ownerName: owners.john.name,
      domain: AssetDomain.COMPLIANCE, tags: [AssetTag.GDPR, AssetTag.SENSITIVE, AssetTag.PII],
      description: 'Tracks subject-access and right-to-be-forgotten requests.',
      upstream: ['orders-db.public.customers'],
      downstream: [],
    },
    {
      name: 'raw_events_2026_05',
      qualifiedName: 'object-store.s3://nexus-raw/2026-05/',
      type: AssetType.FILE, sourceName: 'object-store',
      schema: [
        { name: 'partition', type: 'string (path)' },
        { name: 'event_type', type: 'string' },
        { name: 'payload', type: 'json' },
      ],
      rowCount: 1_120_000_000, sizeMb: 980_000,
      ownerEmail: owners.sarah.email, ownerName: owners.sarah.name,
      domain: AssetDomain.OPS, tags: [],
      description: 'Cold storage of raw event JSON. Partitioned by day. Used for replay and audit.',
      upstream: ['orders-db.public.transactions', 'metrics-stream.events.page_views'],
      downstream: [],
    },
    {
      name: 'app_clicks',
      qualifiedName: 'metrics-stream.events.app_clicks',
      type: AssetType.TOPIC, sourceName: 'metrics-stream',
      schema: [
        { name: 'session_id', type: 'string' },
        { name: 'user_id', type: 'string', pii: true },
        { name: 'element', type: 'string' },
        { name: 'timestamp', type: 'timestamp' },
      ],
      rowCount: 162_400_000, sizeMb: 24_800,
      ownerEmail: owners.priya.email, ownerName: owners.priya.name,
      domain: AssetDomain.PRODUCT, tags: [AssetTag.PII],
      description: 'Click events from native mobile apps.',
      upstream: [],
      downstream: [],
    },
    {
      name: 'partner_inventory',
      qualifiedName: 'partner-api.inventory',
      type: AssetType.API, sourceName: 'partner-api',
      schema: [
        { name: 'sku', type: 'string' },
        { name: 'available_qty', type: 'integer' },
        { name: 'updated_at', type: 'timestamp' },
      ],
      rowCount: 0, sizeMb: 0,
      ownerEmail: owners.mike.email, ownerName: owners.mike.name,
      domain: AssetDomain.OPS, tags: [AssetTag.DEPRECATED],
      description: 'Live inventory feed from supply partner. Being replaced by the Kafka stream in Q3.',
      upstream: [],
      downstream: [],
    },
    {
      name: 'monthly_kpis',
      qualifiedName: 'analytics-warehouse.fact.monthly_kpis',
      type: AssetType.VIEW, sourceName: 'analytics-warehouse',
      schema: [
        { name: 'month', type: 'date' },
        { name: 'mrr_usd', type: 'decimal(14,2)' },
        { name: 'churn_pct', type: 'decimal(5,2)' },
        { name: 'new_customers', type: 'integer' },
        { name: 'avg_clv_usd', type: 'decimal(12,2)' },
      ],
      rowCount: 60, sizeMb: 1,
      ownerEmail: owners.david.email, ownerName: owners.david.name,
      domain: AssetDomain.FINANCE, tags: [AssetTag.CERTIFIED, AssetTag.GOLDEN],
      description: 'Board-level monthly metrics.',
      upstream: ['analytics-warehouse.dim.customer_lifetime_value', 'analytics-warehouse.fact.daily_revenue'],
      downstream: [],
    },
    {
      name: 'audit_log',
      qualifiedName: 'orders-db.security.audit_log',
      type: AssetType.TABLE, sourceName: 'orders-db',
      schema: [
        { name: 'event_id', type: 'uuid' },
        { name: 'actor', type: 'varchar', pii: true },
        { name: 'action', type: 'varchar' },
        { name: 'resource', type: 'varchar' },
        { name: 'timestamp', type: 'timestamp' },
      ],
      rowCount: 24_900_000, sizeMb: 5_200,
      ownerEmail: owners.john.email, ownerName: owners.john.name,
      domain: AssetDomain.COMPLIANCE, tags: [AssetTag.SENSITIVE, AssetTag.CERTIFIED],
      description: 'Immutable audit log for all admin actions.',
      upstream: [],
      downstream: [],
    },
  ];

  // First pass: upsert assets (without lineage edges).
  for (const a of seedAssets) {
    const sourceId = sourceIdByName.get(a.sourceName);
    if (!sourceId) continue;
    await prisma.asset.upsert({
      where: { qualifiedName: a.qualifiedName },
      update: {
        name: a.name,
        type: a.type,
        sourceId,
        schema: a.schema as unknown as object,
        rowCount: a.rowCount,
        sizeMb: a.sizeMb,
        ownerEmail: a.ownerEmail,
        ownerName: a.ownerName,
        domain: a.domain,
        tags: { set: a.tags },
        description: a.description,
      },
      create: {
        name: a.name,
        qualifiedName: a.qualifiedName,
        type: a.type,
        sourceId,
        schema: a.schema as unknown as object,
        rowCount: a.rowCount,
        sizeMb: a.sizeMb,
        ownerEmail: a.ownerEmail,
        ownerName: a.ownerName,
        domain: a.domain,
        tags: a.tags,
        description: a.description,
      },
    });
  }

  // Second pass: rebuild lineage edges from qualifiedName references. Wipe
  // existing edges first to keep reseed deterministic.
  const allAssets = await prisma.asset.findMany({ select: { id: true, qualifiedName: true } });
  const idByQName = new Map(allAssets.map((a) => [a.qualifiedName, a.id]));

  await prisma.assetLineage.deleteMany({});

  for (const a of seedAssets) {
    const downstreamId = idByQName.get(a.qualifiedName);
    if (!downstreamId) continue;
    for (const upstreamQN of a.upstream) {
      const upstreamId = idByQName.get(upstreamQN);
      if (!upstreamId || upstreamId === downstreamId) continue;
      await prisma.assetLineage.create({
        data: { upstreamId, downstreamId },
      });
    }
  }
  console.log(`Seeded ${seedAssets.length} assets with lineage`);

  for (const g of seedGroups) {
    // Resolve member user IDs by email.
    const members = await prisma.user.findMany({
      where: { email: { in: g.memberEmails } },
      select: { id: true },
    });

    // Wipe existing assignments + memberships then recreate so reseeding is
    // deterministic.
    const existing = await prisma.userGroup.findUnique({ where: { name: g.name } });
    if (existing) {
      await prisma.groupAccountAssignment.deleteMany({ where: { groupId: existing.id } });
    }

    await prisma.userGroup.upsert({
      where: { name: g.name },
      create: {
        name: g.name,
        description: g.description,
        systemRoles: g.systemRoles,
        accountAssignments: { create: g.accountAssignments },
        members: { connect: members.map(m => ({ id: m.id })) },
      },
      update: {
        description: g.description,
        systemRoles: { set: g.systemRoles },
        accountAssignments: { create: g.accountAssignments },
        members: { set: members.map(m => ({ id: m.id })) },
      },
    });
  }
  console.log(`Seeded ${seedGroups.length} user groups`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
