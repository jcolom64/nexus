import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SourcesService } from './sources.service';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';

function ipFrom(req: Request): string {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return fwd || req.ip || req.socket?.remoteAddress || 'unknown';
}

@Controller('sources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SourcesController {
  constructor(
    private readonly sources: SourcesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.sources.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sources.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMINISTRATOR, UserRole.MANAGER)
  async create(
    @Body() dto: CreateSourceDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const created = await this.sources.create(dto);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'CREATE',
      category: 'DATA',
      resource: created.name,
      resourceType: 'Source',
      source: ipFrom(req),
      outcome: 'SUCCESS',
      metadata: { type: created.type },
    });
    return created;
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSourceDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const updated = await this.sources.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UPDATE',
      category: 'DATA',
      resource: updated.name,
      resourceType: 'Source',
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
    const target = await this.sources.findOne(id);
    await this.sources.remove(id);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'DELETE',
      category: 'DATA',
      resource: target.name,
      resourceType: 'Source',
      source: ipFrom(req),
      outcome: 'SUCCESS',
      metadata: { assetCount: target.assetCount },
    });
  }
}
