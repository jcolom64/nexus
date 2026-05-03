import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

function ipFrom(req: Request): string {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return fwd || req.ip || req.socket?.remoteAddress || 'unknown';
}

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.assets.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assets.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMINISTRATOR, UserRole.MANAGER)
  async create(
    @Body() dto: CreateAssetDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const created = await this.assets.create(dto);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'CREATE',
      category: 'DATA',
      resource: created.qualifiedName,
      resourceType: 'Asset',
      source: ipFrom(req),
      outcome: 'SUCCESS',
      metadata: { type: created.type, domain: created.domain },
    });
    return created;
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const updated = await this.assets.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UPDATE',
      category: 'DATA',
      resource: updated.qualifiedName,
      resourceType: 'Asset',
      source: ipFrom(req),
      outcome: 'SUCCESS',
      metadata: { changedFields: Object.keys(dto) },
    });
    return updated;
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const target = await this.assets.findOne(id);
    await this.assets.remove(id);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'DELETE',
      category: 'DATA',
      resource: target.qualifiedName,
      resourceType: 'Asset',
      source: ipFrom(req),
      outcome: 'SUCCESS',
    });
  }
}
