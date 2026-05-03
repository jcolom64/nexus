import { Injectable } from '@nestjs/common';
import { Prisma, SecuritySettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSecuritySettingsDto } from './dto/update-security.dto';

const SINGLETON_ID = 'singleton';

// Mirrors the frontend's `defaultSecuritySettings.loginMethods`. Column-level
// defaults can't seed an array with values, so we set it on first upsert.
const DEFAULT_LOGIN_METHODS = ['password', 'sso-saml'];

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SecuritySettings> {
    return this.prisma.securitySettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: {
        id: SINGLETON_ID,
        loginMethods: DEFAULT_LOGIN_METHODS,
      },
    });
  }

  async update(dto: UpdateSecuritySettingsDto): Promise<SecuritySettings> {
    const data: Prisma.SecuritySettingsUpdateInput = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      if (k === 'loginMethods') {
        data.loginMethods = { set: v as string[] };
      } else {
        (data as Record<string, unknown>)[k] = v;
      }
    }

    return this.prisma.securitySettings.upsert({
      where: { id: SINGLETON_ID },
      update: data,
      create: {
        id: SINGLETON_ID,
        loginMethods: dto.loginMethods ?? DEFAULT_LOGIN_METHODS,
        ...(Object.fromEntries(
          Object.entries(dto).filter(([k, v]) => k !== 'loginMethods' && v !== undefined),
        ) as Omit<Prisma.SecuritySettingsCreateInput, 'loginMethods'>),
      },
    });
  }
}
