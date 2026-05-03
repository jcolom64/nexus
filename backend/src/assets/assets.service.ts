import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Asset, AssetDomain, AssetTag, AssetType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

// Wire shape — flat enough to render directly. Lineage is expressed by
// qualifiedName so the frontend doesn't have to chase ids on every hop.
export interface AssetResponse {
  id: string;
  name: string;
  qualifiedName: string;
  type: AssetType;
  sourceId: string;
  sourceName: string;
  schema: { name: string; type: string; pii?: boolean }[];
  rowCount: number;
  sizeMb: number;
  ownerEmail: string | null;
  ownerName: string | null;
  domain: AssetDomain;
  tags: AssetTag[];
  description: string;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  upstream: string[];   // qualifiedNames
  downstream: string[]; // qualifiedNames
}

const ASSET_INCLUDE = {
  source: { select: { id: true, name: true } },
  upstreamEdges:   { include: { upstream:   { select: { qualifiedName: true } } } },
  downstreamEdges: { include: { downstream: { select: { qualifiedName: true } } } },
} satisfies Prisma.AssetInclude;

type AssetWithRelations = Prisma.AssetGetPayload<{ include: typeof ASSET_INCLUDE }>;

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AssetResponse[]> {
    const rows = await this.prisma.asset.findMany({
      include: ASSET_INCLUDE,
      orderBy: { qualifiedName: 'asc' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async findOne(id: string): Promise<AssetResponse> {
    const row = await this.prisma.asset.findUnique({
      where: { id },
      include: ASSET_INCLUDE,
    });
    if (!row) throw new NotFoundException(`Asset ${id} not found`);
    return this.toResponse(row);
  }

  async create(dto: CreateAssetDto): Promise<AssetResponse> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const asset = await tx.asset.create({
          data: {
            name: dto.name,
            qualifiedName: dto.qualifiedName,
            type: dto.type,
            domain: dto.domain,
            source: { connect: { id: dto.sourceId } },
            schema: dto.schema as unknown as Prisma.InputJsonValue,
            rowCount: dto.rowCount ?? 0,
            sizeMb: dto.sizeMb ?? 0,
            ownerEmail: dto.ownerEmail ?? null,
            ownerName: dto.ownerName ?? null,
            tags: dto.tags ?? [],
            description: dto.description ?? '',
          },
        });
        await this.replaceLineage(tx, asset.id, dto.upstream, dto.downstream);
        return tx.asset.findUniqueOrThrow({
          where: { id: asset.id },
          include: ASSET_INCLUDE,
        });
      });
      return this.toResponse(created);
    } catch (e) {
      this.translatePrismaError(e);
      throw e;
    }
  }

  async update(id: string, dto: UpdateAssetDto): Promise<AssetResponse> {
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id },
          data: {
            name: dto.name,
            qualifiedName: dto.qualifiedName,
            type: dto.type,
            domain: dto.domain,
            source: dto.sourceId ? { connect: { id: dto.sourceId } } : undefined,
            schema: dto.schema !== undefined
              ? (dto.schema as unknown as Prisma.InputJsonValue)
              : undefined,
            rowCount: dto.rowCount,
            sizeMb: dto.sizeMb,
            ownerEmail: dto.ownerEmail,
            ownerName: dto.ownerName,
            tags: dto.tags !== undefined ? { set: dto.tags } : undefined,
            description: dto.description,
          },
        });

        // Lineage: if a side is present in the payload it replaces wholesale;
        // omit the field to leave existing edges alone.
        if (dto.upstream !== undefined || dto.downstream !== undefined) {
          await this.replaceLineage(tx, id, dto.upstream, dto.downstream);
        }

        return tx.asset.findUniqueOrThrow({
          where: { id },
          include: ASSET_INCLUDE,
        });
      });
      return this.toResponse(updated);
    } catch (e) {
      this.translatePrismaError(e);
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.asset.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Asset ${id} not found`);
      }
      throw e;
    }
  }

  // Replace the upstream/downstream edge sets for a given asset. Edges are
  // identified by the *other* asset's qualifiedName; unknown names are
  // silently dropped to keep migrations resilient.
  private async replaceLineage(
    tx: Prisma.TransactionClient,
    assetId: string,
    upstream?: string[],
    downstream?: string[],
  ): Promise<void> {
    const allOther = new Set<string>();
    (upstream ?? []).forEach((q) => allOther.add(q));
    (downstream ?? []).forEach((q) => allOther.add(q));

    const others = allOther.size === 0
      ? []
      : await tx.asset.findMany({
          where: { qualifiedName: { in: [...allOther] } },
          select: { id: true, qualifiedName: true },
        });
    const idByQName = new Map(others.map((o) => [o.qualifiedName, o.id]));

    if (upstream !== undefined) {
      await tx.assetLineage.deleteMany({ where: { downstreamId: assetId } });
      for (const qn of upstream) {
        const upId = idByQName.get(qn);
        if (!upId || upId === assetId) continue;
        await tx.assetLineage.create({
          data: { upstreamId: upId, downstreamId: assetId },
        });
      }
    }

    if (downstream !== undefined) {
      await tx.assetLineage.deleteMany({ where: { upstreamId: assetId } });
      for (const qn of downstream) {
        const downId = idByQName.get(qn);
        if (!downId || downId === assetId) continue;
        await tx.assetLineage.create({
          data: { upstreamId: assetId, downstreamId: downId },
        });
      }
    }
  }

  private toResponse(row: AssetWithRelations): AssetResponse {
    return {
      id: row.id,
      name: row.name,
      qualifiedName: row.qualifiedName,
      type: row.type,
      sourceId: row.sourceId,
      sourceName: row.source.name,
      schema: row.schema as unknown as { name: string; type: string; pii?: boolean }[],
      rowCount: row.rowCount,
      sizeMb: row.sizeMb,
      ownerEmail: row.ownerEmail,
      ownerName: row.ownerName,
      domain: row.domain,
      tags: row.tags,
      description: row.description,
      lastUpdatedAt: row.lastUpdatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      upstream:   row.upstreamEdges.map((e) => e.upstream.qualifiedName),
      downstream: row.downstreamEdges.map((e) => e.downstream.qualifiedName),
    };
  }

  private translatePrismaError(e: unknown): never | void {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        throw new ConflictException('An asset with this qualifiedName already exists');
      }
      if (e.code === 'P2025') {
        throw new NotFoundException('Asset (or its source) not found');
      }
      if (e.code === 'P2003') {
        throw new ConflictException('Referenced source does not exist');
      }
    }
  }
}
