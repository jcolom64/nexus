import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SecurityService } from './security.service';
import { UpdateSecuritySettingsDto } from './dto/update-security.dto';

function ipFrom(req: Request): string {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return fwd || req.ip || req.socket?.remoteAddress || 'unknown';
}

@Controller('security')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecurityController {
  constructor(
    private readonly security: SecurityService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  get() {
    return this.security.get();
  }

  @Put()
  @Roles(UserRole.ADMINISTRATOR)
  async update(
    @Body() dto: UpdateSecuritySettingsDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const updated = await this.security.update(dto);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UPDATE',
      category: 'SECURITY',
      resource: 'security-settings',
      resourceType: 'SecuritySettings',
      source: ipFrom(req),
      outcome: 'SUCCESS',
      metadata: { changedFields: Object.keys(dto) },
    });
    return updated;
  }
}
