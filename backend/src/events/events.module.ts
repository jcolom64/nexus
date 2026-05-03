import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsService } from './events.service';
import { EventsGateway } from './events.gateway';

// @Global so we can inject EventsService into any module without each
// of them having to declare an import. The events bus is a process-wide
// singleton — that's exactly the case @Global is for.
@Global()
@Module({
  imports: [AuthModule], // for JwtService used by the gateway
  providers: [EventsService, EventsGateway],
  exports: [EventsService],
})
export class EventsModule {}
