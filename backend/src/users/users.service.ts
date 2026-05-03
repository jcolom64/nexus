import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserState } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  state: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  groups: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

// Lockout-protection error message — surfaced verbatim to the UI.
const LAST_ADMIN_ERROR =
  'The system must always have at least one active administrator. ' +
  'Promote another user to Administrator (and ensure their state is Active) before applying this change.';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Counts active administrators using whichever Prisma client is passed in
  // (so we can call it from inside an interactive transaction and see the
  // post-mutation state).
  private async countActiveAdmins(
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    return tx.user.count({
      where: { role: UserRole.ADMINISTRATOR, state: UserState.ACTIVE },
    });
  }

  async findAll(): Promise<UserDto[]> {
    return this.prisma.user.findMany({
      select: PUBLIC_USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
          role: dto.role,
          state: dto.state,
          groups: dto.groupIds && dto.groupIds.length > 0
            ? { connect: dto.groupIds.map((id) => ({ id })) }
            : undefined,
        },
        select: PUBLIC_USER_SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') throw new ConflictException('A user with this email already exists');
        if (e.code === 'P2025') throw new ConflictException('One or more referenced groups do not exist');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const data: Prisma.UserUpdateInput = {
      email: dto.email,
      name: dto.name,
      role: dto.role,
      state: dto.state,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    // groupIds === undefined → leave membership untouched.
    // groupIds === [] → remove from all groups.
    if (dto.groupIds !== undefined) {
      data.groups = { set: dto.groupIds.map((gid) => ({ id: gid })) };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id },
          data,
          select: PUBLIC_USER_SELECT,
        });

        // Only re-check when the change could plausibly demote the admin pool.
        const couldShrinkAdmins =
          (dto.role !== undefined && dto.role !== UserRole.ADMINISTRATOR) ||
          (dto.state !== undefined && dto.state !== UserState.ACTIVE);

        if (couldShrinkAdmins) {
          const remaining = await this.countActiveAdmins(tx);
          if (remaining < 1) {
            throw new BadRequestException(LAST_ADMIN_ERROR);
          }
        }

        return updated;
      });
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2025') throw new NotFoundException(`User ${id} not found`);
        if (e.code === 'P2002') throw new ConflictException('A user with this email already exists');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({
          where: { id },
          select: { role: true, state: true },
        });
        if (!target) throw new NotFoundException(`User ${id} not found`);

        await tx.user.delete({ where: { id } });

        const wasActiveAdmin =
          target.role === UserRole.ADMINISTRATOR && target.state === UserState.ACTIVE;
        if (wasActiveAdmin) {
          const remaining = await this.countActiveAdmins(tx);
          if (remaining < 1) {
            throw new BadRequestException(LAST_ADMIN_ERROR);
          }
        }
      });
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof NotFoundException) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`User ${id} not found`);
      }
      throw e;
    }
  }
}
