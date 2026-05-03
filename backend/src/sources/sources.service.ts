import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetDomain, Prisma, Source, SourceStatus, SourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { decryptSecret, encryptSecret } from './connectors/credentials';
import { DiscoveredAsset, PostgresConnector } from './connectors/postgres-connector';

// Wire shape — strips the encrypted password and adds an `assetCount`
// derived from the relation. The on-disk row is fine to spread otherwise;
// `username` stays in the response so the UI can show whether creds are
// configured without round-tripping the password.
export interface SourceResponse extends Omit<Source, 'passwordEncrypted'> {
  assetCount: number;
  hasCredentials: boolean;
}

export interface TestSourceResult {
  ok: boolean;
  latencyMs: number;
  status: SourceStatus;
  error?: string;
}

export interface SyncSourceResult {
  ok: boolean;
  status: SourceStatus;
  discoveredCount: number;
  upsertedCount: number;
  durationMs: number;
  error?: string;
}

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<SourceResponse[]> {
    const rows = await this.prisma.source.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { assets: true } } },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async findOne(id: string): Promise<SourceResponse> {
    const row = await this.prisma.source.findUnique({
      where: { id },
      include: { _count: { select: { assets: true } } },
    });
    if (!row) throw new NotFoundException(`Source ${id} not found`);
    return this.toResponse(row);
  }

  async create(dto: CreateSourceDto): Promise<SourceResponse> {
    try {
      const created = await this.prisma.source.create({
        data: {
          name: dto.name,
          type: dto.type,
          status: dto.status,
          description: dto.description ?? '',
          host: dto.host ?? null,
          port: dto.port ?? null,
          database: dto.database ?? null,
          username: dto.username ?? null,
          passwordEncrypted: dto.password ? encryptSecret(dto.password) : null,
        },
        include: { _count: { select: { assets: true } } },
      });
      return this.toResponse(created);
    } catch (e) {
      this.translatePrismaError(e);
      throw e;
    }
  }

  async update(id: string, dto: UpdateSourceDto): Promise<SourceResponse> {
    try {
      const updated = await this.prisma.source.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          status: dto.status,
          description: dto.description,
          host: dto.host,
          port: dto.port,
          database: dto.database,
          username: dto.username,
          // `password === ''` is the explicit "clear it" signal; `undefined`
          // means "leave whatever's stored alone".
          passwordEncrypted: dto.password === undefined
            ? undefined
            : dto.password === ''
              ? null
              : encryptSecret(dto.password),
        },
        include: { _count: { select: { assets: true } } },
      });
      return this.toResponse(updated);
    } catch (e) {
      this.translatePrismaError(e);
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      // Cascade is on at the schema level — assets and their lineage edges
      // get cleaned up automatically.
      await this.prisma.source.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Source ${id} not found`);
      }
      throw e;
    }
  }

  // Probe the source via the appropriate connector. Flips `status` to
  // CONNECTED on success, DISCONNECTED on failure; doesn't update
  // lastSyncAt because no data was pulled. Test failures still return 200
  // — the operator wants to see *why* it failed, not parse 5xx bodies.
  async test(id: string): Promise<TestSourceResult> {
    const source = await this.prisma.source.findUnique({ where: { id } });
    if (!source) throw new NotFoundException(`Source ${id} not found`);
    const connector = await this.connectorFor(source);

    const result = await connector.testConnection();
    const status: SourceStatus = result.ok ? SourceStatus.CONNECTED : SourceStatus.DISCONNECTED;
    await this.prisma.source.update({ where: { id }, data: { status } });

    return {
      ok: result.ok,
      latencyMs: result.latencyMs,
      status,
      error: result.error,
    };
  }

  // Discover tables/views and upsert them as Assets. Schema is JSON — same
  // shape the seed uses. Domain defaults to OPS for now (categorisation
  // is human work). Existing assets are matched by qualifiedName so a
  // re-sync refreshes schema + rowCount in place.
  async sync(id: string): Promise<SyncSourceResult> {
    const source = await this.prisma.source.findUnique({ where: { id } });
    if (!source) throw new NotFoundException(`Source ${id} not found`);
    const connector = await this.connectorFor(source);

    const start = Date.now();
    let discovered: DiscoveredAsset[];
    try {
      discovered = await connector.introspect(source.name);
    } catch (e) {
      const err = (e as Error).message;
      await this.prisma.source.update({
        where: { id },
        data: { status: SourceStatus.DISCONNECTED },
      });
      return {
        ok: false,
        status: SourceStatus.DISCONNECTED,
        discoveredCount: 0,
        upsertedCount: 0,
        durationMs: Date.now() - start,
        error: err,
      };
    }

    let upsertedCount = 0;
    for (const d of discovered) {
      await this.prisma.asset.upsert({
        where: { qualifiedName: d.qualifiedName },
        update: {
          name: d.name,
          type: d.type,
          sourceId: source.id,
          schema: d.columns as unknown as Prisma.InputJsonValue,
          rowCount: d.rowCount,
          lastUpdatedAt: new Date(),
        },
        create: {
          name: d.name,
          qualifiedName: d.qualifiedName,
          type: d.type,
          sourceId: source.id,
          schema: d.columns as unknown as Prisma.InputJsonValue,
          rowCount: d.rowCount,
          // Auto-discovered assets get OPS as a placeholder domain — a human
          // categorises them properly later.
          domain: AssetDomain.OPS,
          tags: [],
          description: '',
        },
      });
      upsertedCount++;
    }

    await this.prisma.source.update({
      where: { id },
      data: {
        status: SourceStatus.CONNECTED,
        lastSyncAt: new Date(),
      },
    });

    return {
      ok: true,
      status: SourceStatus.CONNECTED,
      discoveredCount: discovered.length,
      upsertedCount,
      durationMs: Date.now() - start,
    };
  }

  private async connectorFor(source: Source): Promise<PostgresConnector> {
    if (source.type !== SourceType.POSTGRES) {
      throw new BadRequestException(
        `Connector for type ${source.type} is not implemented yet — only POSTGRES is supported in Phase 5b.`,
      );
    }
    if (!source.host || !source.port || !source.database || !source.username || !source.passwordEncrypted) {
      throw new BadRequestException(
        'Source is missing connection details (host, port, database, username, password).',
      );
    }
    return new PostgresConnector({
      host: source.host,
      port: source.port,
      database: source.database,
      username: source.username,
      password: decryptSecret(source.passwordEncrypted),
    });
  }

  private toResponse(row: Source & { _count: { assets: number } }): SourceResponse {
    const { _count, passwordEncrypted, ...rest } = row;
    return {
      ...rest,
      assetCount: _count.assets,
      hasCredentials: Boolean(passwordEncrypted),
    };
  }

  private translatePrismaError(e: unknown): never | void {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        throw new ConflictException('A source with this name already exists');
      }
      if (e.code === 'P2025') {
        throw new NotFoundException('Source not found');
      }
    }
  }
}
