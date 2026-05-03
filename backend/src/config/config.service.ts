import { Injectable } from '@nestjs/common';
import { Prisma, SystemConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSystemConfigDto } from './dto/update-config.dto';

const SINGLETON_ID = 'singleton';

// Mirrors the frontend's `defaultSystemConfig`. Used to seed the row on first
// read, and to populate fields the column default can't express (Json).
const DEFAULT_NOTIFICATION_EVENTS = [
  { id: 'auth-failure',     label: 'Repeated authentication failures', enabled: true },
  { id: 'data-source-down', label: 'Data source disconnected',         enabled: true },
  { id: 'license-expiring', label: 'License expires within 30 days',   enabled: true },
  { id: 'audit-anomaly',    label: 'Audit anomaly detected',           enabled: false },
  { id: 'backup-failed',    label: 'Backup failed',                    enabled: true },
];

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // Read-or-seed. The first GET on a fresh DB creates the row with defaults.
  async get(): Promise<SystemConfig> {
    return this.prisma.systemConfig.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: {
        id: SINGLETON_ID,
        notificationEvents: DEFAULT_NOTIFICATION_EVENTS as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(dto: UpdateSystemConfigDto): Promise<SystemConfig> {
    // Build the data payload, dropping undefined keys so a partial PUT only
    // touches the fields the client sent.
    const data: Prisma.SystemConfigUpdateInput = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      if (k === 'notificationEvents') {
        data.notificationEvents = v as unknown as Prisma.InputJsonValue;
      } else {
        (data as Record<string, unknown>)[k] = v;
      }
    }

    return this.prisma.systemConfig.upsert({
      where: { id: SINGLETON_ID },
      update: data,
      create: {
        id: SINGLETON_ID,
        notificationEvents: (dto.notificationEvents ?? DEFAULT_NOTIFICATION_EVENTS) as unknown as Prisma.InputJsonValue,
        ...(Object.fromEntries(
          Object.entries(dto).filter(([k, v]) => k !== 'notificationEvents' && v !== undefined),
        ) as Omit<Prisma.SystemConfigCreateInput, 'notificationEvents'>),
      },
    });
  }
}
