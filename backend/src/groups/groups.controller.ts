import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

function ipFrom(req: Request): string {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return fwd || req.ip || req.socket?.remoteAddress || 'unknown';
}

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.groups.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groups.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMINISTRATOR)
  async create(@Body() dto: CreateGroupDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    const created = await this.groups.create(dto);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'CREATE',
      category: 'USER',
      resource: created.name,
      resourceType: 'Group',
      source: ipFrom(req),
      outcome: 'SUCCESS',
      metadata: { memberCount: created.memberEmails.length },
    });
    return created;
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRATOR)
  async update(@Param('id') id: string, @Body() dto: UpdateGroupDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    const updated = await this.groups.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UPDATE',
      category: 'USER',
      resource: updated.name,
      resourceType: 'Group',
      source: ipFrom(req),
      outcome: 'SUCCESS',
      metadata: { changedFields: Object.keys(dto) },
    });
    return updated;
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    const target = await this.groups.findOne(id);
    await this.groups.remove(id);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'DELETE',
      category: 'USER',
      resource: target.name,
      resourceType: 'Group',
      source: ipFrom(req),
      outcome: 'SUCCESS',
    });
  }
}
