import { Injectable, NotFoundException } from '@nestjs/common';
import { License } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON_ID = 'singleton';

@Injectable()
export class LicenseService {
  constructor(private readonly prisma: PrismaService) {}

  // Read-only at the API layer — license is install-time data, written by
  // the `license:apply` CLI. If no row exists, the install is incomplete.
  async get(): Promise<License> {
    const row = await this.prisma.license.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) {
      throw new NotFoundException(
        'No license has been applied. Run `npm --prefix backend run license:apply` to provision one.',
      );
    }
    return row;
  }

  // Used by the CLI script. Not exposed on the HTTP surface.
  async apply(input: ApplyLicenseInput): Promise<License> {
    return this.prisma.license.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        licenseKey: input.licenseKey,
        plan: input.plan,
        seatsTotal: input.seatsTotal,
        licenseExpires: input.licenseExpires ?? '',
        appliedBy: input.appliedBy ?? 'cli',
        notes: input.notes ?? null,
      },
      update: {
        licenseKey: input.licenseKey,
        plan: input.plan,
        seatsTotal: input.seatsTotal,
        licenseExpires: input.licenseExpires ?? '',
        appliedAt: new Date(),
        appliedBy: input.appliedBy ?? 'cli',
        notes: input.notes ?? null,
      },
    });
  }
}

export interface ApplyLicenseInput {
  licenseKey: string;
  plan: string;
  seatsTotal: number;
  licenseExpires?: string;
  appliedBy?: string;
  notes?: string;
}
