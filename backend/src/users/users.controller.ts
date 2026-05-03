import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

function ipFrom(req: Request): string {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return fwd || req.ip || req.socket?.remoteAddress || 'unknown';
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.users.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMINISTRATOR)
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    const created = await this.users.create(dto);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'CREATE',
      category: 'USER',
      resource: created.email,
      resourceType: 'User',
      source: ipFrom(req),
      outcome: 'SUCCESS',
      metadata: { role: created.role, state: created.state },
    });
    return created;
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRATOR)
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    const updated = await this.users.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UPDATE',
      category: 'USER',
      resource: updated.email,
      resourceType: 'User',
      source: ipFrom(req),
      outcome: 'SUCCESS',
      metadata: {
        // Surface what changed without leaking the password.
        changedFields: Object.keys(dto).filter((k) => k !== 'password'),
        passwordChanged: Boolean(dto.password),
      },
    });
    return updated;
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    // Capture identity BEFORE delete so the audit row keeps a usable resource string.
    const target = await this.users.findOne(id);
    await this.users.remove(id);
    await this.audit.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'DELETE',
      category: 'USER',
      resource: target.email,
      resourceType: 'User',
      source: ipFrom(req),
      outcome: 'SUCCESS',
    });
  }
}
