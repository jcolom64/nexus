import { PrismaClient, SystemRole, UserRole, UserState } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'nexus123';

const seedUsers = [
  { email: 'john.doe@nexus.com',     name: 'John Doe',     role: UserRole.ADMINISTRATOR, state: UserState.ACTIVE,    lastLoginAt: new Date('2026-04-30T14:30:00Z') },
  { email: 'jane.smith@nexus.com',   name: 'Jane Smith',   role: UserRole.MANAGER,       state: UserState.ACTIVE,    lastLoginAt: new Date('2026-04-30T09:15:00Z') },
  { email: 'mike.johnson@nexus.com', name: 'Mike Johnson', role: UserRole.USER,          state: UserState.INACTIVE,  lastLoginAt: new Date('2026-04-28T16:45:00Z') },
  { email: 'sarah.wilson@nexus.com', name: 'Sarah Wilson', role: UserRole.USER,          state: UserState.ACTIVE,    lastLoginAt: new Date('2026-04-30T11:20:00Z') },
  { email: 'david.brown@nexus.com',  name: 'David Brown',  role: UserRole.MANAGER,       state: UserState.SUSPENDED, lastLoginAt: new Date('2026-04-25T13:10:00Z') },
  { email: 'priya.patel@nexus.com',  name: 'Priya Patel',  role: UserRole.AUDITOR,       state: UserState.INVITED,   lastLoginAt: null },
];

const seedAccounts = [
  { id: 'acc-prod',    name: 'Production' },
  { id: 'acc-staging', name: 'Staging' },
  { id: 'acc-dev',     name: 'Development' },
  { id: 'acc-sandbox', name: 'Sandbox' },
];

interface SeedGroup {
  name: string;
  description: string;
  systemRoles: SystemRole[];
  accountAssignments: { accountId: string; role: SystemRole }[];
  memberEmails: string[];
}

const seedGroups: SeedGroup[] = [
  {
    name: 'Platform Admins',
    description: 'Full administrative access across all accounts.',
    systemRoles: [SystemRole.SYSTEM_ADMIN],
    accountAssignments: [
      { accountId: 'acc-prod',    role: SystemRole.SYSTEM_ADMIN },
      { accountId: 'acc-staging', role: SystemRole.SYSTEM_ADMIN },
    ],
    memberEmails: ['john.doe@nexus.com'],
  },
  {
    name: 'Compliance Auditors',
    description: 'Read-only access for auditing and reporting.',
    systemRoles: [SystemRole.ACCOUNT_VIEWER, SystemRole.USER_VIEWER],
    accountAssignments: [
      { accountId: 'acc-prod',    role: SystemRole.ACCOUNT_VIEWER },
      { accountId: 'acc-staging', role: SystemRole.ACCOUNT_VIEWER },
      { accountId: 'acc-dev',     role: SystemRole.USER_VIEWER },
    ],
    memberEmails: ['priya.patel@nexus.com'],
  },
  {
    name: 'License Managers',
    description: 'Override licensing limits during incident response.',
    systemRoles: [SystemRole.LICENSE_OVERRIDE],
    accountAssignments: [
      { accountId: 'acc-prod', role: SystemRole.LICENSE_OVERRIDE },
    ],
    memberEmails: ['jane.smith@nexus.com', 'david.brown@nexus.com'],
  },
  {
    name: 'Sandbox Developers',
    description: 'Engineering team access scoped to non-production accounts.',
    systemRoles: [SystemRole.USER_VIEWER],
    accountAssignments: [
      { accountId: 'acc-dev',     role: SystemRole.USER_VIEWER },
      { accountId: 'acc-sandbox', role: SystemRole.USER_VIEWER },
    ],
    memberEmails: ['sarah.wilson@nexus.com', 'david.brown@nexus.com'],
  },
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const u of seedUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, state: u.state, lastLoginAt: u.lastLoginAt },
      create: { ...u, passwordHash },
    });
  }
  console.log(`Seeded ${seedUsers.length} users (password: '${SEED_PASSWORD}')`);

  for (const a of seedAccounts) {
    await prisma.account.upsert({
      where: { id: a.id },
      update: { name: a.name },
      create: a,
    });
  }
  console.log(`Seeded ${seedAccounts.length} accounts`);

  for (const g of seedGroups) {
    // Resolve member user IDs by email.
    const members = await prisma.user.findMany({
      where: { email: { in: g.memberEmails } },
      select: { id: true },
    });

    // Wipe existing assignments + memberships then recreate so reseeding is
    // deterministic.
    const existing = await prisma.userGroup.findUnique({ where: { name: g.name } });
    if (existing) {
      await prisma.groupAccountAssignment.deleteMany({ where: { groupId: existing.id } });
    }

    await prisma.userGroup.upsert({
      where: { name: g.name },
      create: {
        name: g.name,
        description: g.description,
        systemRoles: g.systemRoles,
        accountAssignments: { create: g.accountAssignments },
        members: { connect: members.map(m => ({ id: m.id })) },
      },
      update: {
        description: g.description,
        systemRoles: { set: g.systemRoles },
        accountAssignments: { create: g.accountAssignments },
        members: { set: members.map(m => ({ id: m.id })) },
      },
    });
  }
  console.log(`Seeded ${seedGroups.length} user groups`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
