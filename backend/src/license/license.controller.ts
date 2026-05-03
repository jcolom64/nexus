import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LicenseService } from './license.service';

// Auth-gated read-only — license details (key, plan, seat cap, expiry) are
// not world-readable. Writes happen out-of-band via the `license:apply`
// CLI; there is no PUT/PATCH endpoint by design.
@Controller('license')
@UseGuards(JwtAuthGuard)
export class LicenseController {
  constructor(private readonly license: LicenseService) {}

  @Get()
  get() {
    return this.license.get();
  }
}
