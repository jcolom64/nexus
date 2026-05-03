import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

// Wire shape of every message we push to subscribed WebSocket clients.
// `type` is a dotted-path string (e.g. 'source.status', 'audit'); payload
// is type-specific. `timestamp` lets the client treat events as a stream
// and reason about ordering even if delivery reorders them.
export interface EventMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
}

// In-process pub/sub mediator. Application services (sources, audit, …)
// call `emit()` whenever something interesting happens; the EventsGateway
// subscribes once at startup and broadcasts every emitted message to
// every authenticated WebSocket client.
//
// Why a mediator instead of injecting the gateway directly into every
// service: keeps the cross-cutting "broadcast on this state change"
// concern out of business modules, and keeps modules from having to
// import @nestjs/websockets just to fire an event.
@Injectable()
export class EventsService {
  private readonly subject = new Subject<EventMessage>();
  readonly events$ = this.subject.asObservable();

  emit<T>(type: string, payload: T): void {
    this.subject.next({ type, payload, timestamp: new Date().toISOString() });
  }
}
