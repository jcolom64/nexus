import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, AuditCategory, AuditEntry, AuditOutcome, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';

export interface RecordAuditInput {
  actorId?: string | null;
  actorEmail: string;
  actorName?: string | null;
  action: AuditAction;
  category: AuditCategory;
  resource: string;
  resourceType: string;
  source?: string | null;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a single audit event. Never throws — audit failures should not
   * cascade and break the action being audited.
   */
  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.prisma.auditEntry.create({
        data: {
          actorId: input.actorId ?? null,
          actorEmail: input.actorEmail,
          actorName: input.actorName ?? null,
          action: input.action,
          category: input.category,
          resource: input.resource,
          resourceType: input.resourceType,
          source: input.source ?? null,
          outcome: input.outcome,
          metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      // Don't break the caller — log and move on.
      this.logger.warn(`Failed to record audit event: ${(e as Error).message}`);
    }
  }

  async query(q: AuditQueryDto): Promise<AuditPage> {
    const where: Prisma.AuditEntryWhereInput = {};
    if (q.category) where.category = q.category;
    if (q.action) where.action = q.action;
    if (q.outcome) where.outcome = q.outcome;
    if (q.search) {
      const s = q.search;
      where.OR = [
        { actorEmail:   { contains: s, mode: 'insensitive' } },
        { actorName:    { contains: s, mode: 'insensitive' } },
        { resource:     { contains: s, mode: 'insensitive' } },
        { resourceType: { contains: s, mode: 'insensitive' } },
        { source:       { contains: s, mode: 'insensitive' } },
      ];
    }

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;

    const [entries, total] = await this.prisma.$transaction([
      this.prisma.auditEntry.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditEntry.count({ where }),
    ]);

    return { entries, total, page, pageSize };
  }
}
