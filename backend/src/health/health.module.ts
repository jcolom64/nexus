import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  // AuthModule provides the JwtAuthGuard's strategy; needed for the gated
  // `/metrics` endpoint. `/check` remains public.
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
