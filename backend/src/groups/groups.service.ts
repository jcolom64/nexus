import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

// Wire response shape — flat enough that the frontend can render directly.
export interface GroupResponse {
  id: string;
  name: string;
  description: string;
  systemRoles: SystemRole[];
  accountAssignments: { accountId: string; accountName: string; role: SystemRole }[];
  memberEmails: string[];
  createdAt: Date;
  updatedAt: Date;
}

const GROUP_INCLUDE = {
  accountAssignments: { include: { account: { select: { id: true, name: true } } } },
  members: { select: { email: true } },
} satisfies Prisma.UserGroupInclude;

type GroupWithRelations = Prisma.UserGroupGetPayload<{ include: typeof GROUP_INCLUDE }>;

function toResponse(g: GroupWithRelations): GroupResponse {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    systemRoles: g.systemRoles,
    accountAssignments: g.accountAssignments.map((a) => ({
      accountId: a.accountId,
      accountName: a.account.name,
      role: a.role,
    })),
    memberEmails: g.members.map((m) => m.email),
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<GroupResponse[]> {
    const groups = await this.prisma.userGroup.findMany({
      include: GROUP_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return groups.map(toResponse);
  }

  async findOne(id: string): Promise<GroupResponse> {
    const g = await this.prisma.userGroup.findUnique({
      where: { id },
      include: GROUP_INCLUDE,
    });
    if (!g) throw new NotFoundException(`Group ${id} not found`);
    return toResponse(g);
  }

  async create(dto: CreateGroupDto): Promise<GroupResponse> {
    const memberIds = await this.resolveMemberIds(dto.memberEmails);
    try {
      const created = await this.prisma.userGroup.create({
        data: {
          name: dto.name,
          description: dto.description ?? '',
          systemRoles: dto.systemRoles ?? [],
          accountAssignments: dto.accountAssignments
            ? { create: dto.accountAssignments }
            : undefined,
          members: { connect: memberIds.map((id) => ({ id })) },
        },
        include: GROUP_INCLUDE,
      });
      return toResponse(created);
    } catch (e) {
      this.translatePrismaError(e);
      throw e;
    }
  }

  async update(id: string, dto: UpdateGroupDto): Promise<GroupResponse> {
    const memberIds =
      dto.memberEmails !== undefined ? await this.resolveMemberIds(dto.memberEmails) : null;

    try {
      // Replace assignments wholesale when present in the payload — simpler to
      // reason about than computing diffs on the API side.
      return await this.prisma.$transaction(async (tx) => {
        if (dto.accountAssignments !== undefined) {
          await tx.groupAccountAssignment.deleteMany({ where: { groupId: id } });
        }

        const updated = await tx.userGroup.update({
          where: { id },
          data: {
            name: dto.name,
            description: dto.description,
            systemRoles: dto.systemRoles !== undefined ? { set: dto.systemRoles } : undefined,
            accountAssignments: dto.accountAssignments
              ? { create: dto.accountAssignments }
              : undefined,
            members: memberIds ? { set: memberIds.map((id) => ({ id })) } : undefined,
          },
          include: GROUP_INCLUDE,
        });
        return toResponse(updated);
      });
    } catch (e) {
      this.translatePrismaError(e);
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.userGroup.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Group ${id} not found`);
      }
      throw e;
    }
  }

  private async resolveMemberIds(emails: string[] | undefined): Promise<string[]> {
    if (!emails || emails.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private translatePrismaError(e: unknown): never | void {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        throw new ConflictException('A group with this name already exists');
      }
      if (e.code === 'P2025') {
        throw new NotFoundException('Group not found');
      }
      if (e.code === 'P2003') {
        throw new ConflictException('One or more referenced accounts do not exist');
      }
    }
  }
}
