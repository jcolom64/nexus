import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    state: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, source?: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    const recordFailure = (reason: string) =>
      this.audit.record({
        actorId: user?.id ?? null,
        actorEmail: dto.email,
        actorName: user?.name ?? null,
        action: 'LOGIN',
        category: 'AUTH',
        resource: 'web-console',
        resourceType: 'Session',
        source,
        outcome: 'FAILED',
        metadata: { reason },
      });

    if (!user) {
      await recordFailure('unknown_email');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.state === 'SUSPENDED' || user.state === 'INACTIVE') {
      await recordFailure(`account_${user.state.toLowerCase()}`);
      throw new UnauthorizedException('Account is not active');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      await recordFailure('bad_password');
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    await this.audit.record({
      actorId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      action: 'LOGIN',
      category: 'AUTH',
      resource: 'web-console',
      resourceType: 'Session',
      source,
      outcome: 'SUCCESS',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        state: user.state,
      },
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true, state: true,
        lastLoginAt: true, createdAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
