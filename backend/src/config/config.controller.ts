import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from './config.service';
import { UpdateSystemConfigDto } from './dto/update-config.dto';

function ipFrom(req: Request): string {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return fwd || req.ip || req.socket?.remoteAddress || 'unknown';
}

@Controller('config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigController {
  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  get() {
    return this.config.get();
  }

  @Put()
  @Roles(UserRole.ADMINISTRATOR)
  async update(
    @Body() dto: UpdateSystemConfigDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const updated = await this.config.update(dto);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UPDATE',
      category: 'CONFIG',
      resource: 'system-config',
      resourceType: 'SystemConfig',
      source: ipFrom(req),
      outcome: 'SUCCESS',
      metadata: { changedFields: Object.keys(dto) },
    });
    return updated;
  }
}
