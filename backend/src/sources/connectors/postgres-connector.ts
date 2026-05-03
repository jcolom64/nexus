import { Client } from 'pg';
import { AssetType } from '@prisma/client';

// Tunables. Five seconds is a reasonable upper bound for a healthy intra-VPC
// Postgres; in dev against localhost it normally finishes in <50ms.
const CONNECT_TIMEOUT_MS = 5_000;
const QUERY_TIMEOUT_MS = 10_000;

export interface PostgresConnectorParams {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface DiscoveredAsset {
  qualifiedName: string;        // <sourceName>.<schema>.<table>
  name: string;                  // <table>
  type: AssetType;               // TABLE or VIEW
  schemaName: string;            // postgres schema, e.g. 'public'
  columns: { name: string; type: string }[];
  rowCount: number;              // estimated via pg_class.reltuples
}

export class PostgresConnector {
  constructor(private readonly params: PostgresConnectorParams) {}

  async testConnection(): Promise<TestResult> {
    const start = Date.now();
    const client = this.makeClient();
    try {
      await this.connect(client);
      await client.query('SELECT 1');
      return { ok: true, latencyMs: Date.now() - start };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - start, error: (e as Error).message };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  // Discover tables + views in every non-system schema. System schemas
  // (`pg_catalog`, `information_schema`) are filtered out — they're always
  // present and shouldn't pollute the catalog.
  async introspect(sourceName: string): Promise<DiscoveredAsset[]> {
    const client = this.makeClient();
    try {
      await this.connect(client);

      const tables = await client.query<{
        table_schema: string;
        table_name: string;
        table_type: string;
        reltuples: number | null;
      }>(`
        SELECT t.table_schema, t.table_name, t.table_type,
               c.reltuples::bigint::int8 AS reltuples
          FROM information_schema.tables t
          JOIN pg_class c
            ON c.relname = t.table_name
          JOIN pg_namespace n
            ON n.oid = c.relnamespace
           AND n.nspname = t.table_schema
         WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
           AND t.table_type IN ('BASE TABLE', 'VIEW')
         ORDER BY t.table_schema, t.table_name
      `);

      if (tables.rows.length === 0) return [];

      const columns = await client.query<{
        table_schema: string;
        table_name: string;
        column_name: string;
        data_type: string;
      }>(`
        SELECT table_schema, table_name, column_name, data_type
          FROM information_schema.columns
         WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
         ORDER BY table_schema, table_name, ordinal_position
      `);

      const colsByTable = new Map<string, { name: string; type: string }[]>();
      for (const c of columns.rows) {
        const key = `${c.table_schema}.${c.table_name}`;
        const list = colsByTable.get(key) ?? [];
        list.push({ name: c.column_name, type: c.data_type });
        colsByTable.set(key, list);
      }

      return tables.rows.map((t) => {
        const key = `${t.table_schema}.${t.table_name}`;
        return {
          qualifiedName: `${sourceName}.${t.table_schema}.${t.table_name}`,
          name: t.table_name,
          type: t.table_type === 'VIEW' ? AssetType.VIEW : AssetType.TABLE,
          schemaName: t.table_schema,
          columns: colsByTable.get(key) ?? [],
          // `reltuples` is the planner's estimate, not exact. Fine for a
          // cataloging metric — exact counts would require a sequential
          // scan, which we won't run synchronously inside an HTTP request.
          rowCount: Math.max(0, Number(t.reltuples ?? 0)),
        };
      });
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private makeClient(): Client {
    return new Client({
      host: this.params.host,
      port: this.params.port,
      database: this.params.database,
      user: this.params.username,
      password: this.params.password,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      statement_timeout: QUERY_TIMEOUT_MS,
    });
  }

  // Wrap `client.connect()` with our own timeout — `connectionTimeoutMillis`
  // covers the TCP handshake but not always the auth round-trip. The pg
  // driver can hang on an unreachable host without one.
  private connect(client: Client): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Connection to ${this.params.host}:${this.params.port} timed out after ${CONNECT_TIMEOUT_MS}ms`)),
        CONNECT_TIMEOUT_MS,
      );
      client.connect((err) => {
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
