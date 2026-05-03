import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Source } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';

export interface SourceResponse extends Source {
  assetCount: number;
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

  private toResponse(row: Source & { _count: { assets: number } }): SourceResponse {
    const { _count, ...rest } = row;
    return { ...rest, assetCount: _count.assets };
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
