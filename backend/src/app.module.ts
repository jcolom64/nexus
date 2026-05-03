import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AccountsModule } from './accounts/accounts.module';
import { GroupsModule } from './groups/groups.module';
import { AuditModule } from './audit/audit.module';
import { ConfigModule } from './config/config.module';
import { SecurityModule } from './security/security.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    NestConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AuditModule,
    UsersModule,
    AccountsModule,
    GroupsModule,
    ConfigModule,
    SecurityModule,
    HealthModule,
  ],
})
export class AppModule {}
