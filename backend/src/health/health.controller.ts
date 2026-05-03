import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HealthService } from './health.service';

// `/check` is intentionally **public** — no JwtAuthGuard. External uptime
// monitors and load-balancer probes need to reach it without a credential.
// `/metrics` requires auth: it leaks process-level details (memory size,
// CPU, DB size) that shouldn't be world-readable.
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('check')
  check() {
    return this.health.check();
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard)
  metrics() {
    return this.health.metrics();
  }
}
