import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { Subscription } from 'rxjs';
import { EventsService, EventMessage } from './events.service';

// Per-socket auth state attached on connection. We don't extend the
// WebSocket type globally — keep the assertion narrow to this file.
interface SocketState {
  authed: boolean;
  authTimer: NodeJS.Timeout | null;
  user?: { id: string; email: string; role: string };
}

const AUTH_TIMEOUT_MS = 5000;

// `path: '/events'` — the URL the frontend connects to. CORS isn't a
// concept on the WS protocol, but the upgrade *handshake* is HTTP and
// passes through the express CORS middleware configured in main.ts.
@WebSocketGateway({ path: '/events' })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('EventsGateway');
  private readonly state = new WeakMap<WebSocket, SocketState>();
  private readonly authedClients = new Set<WebSocket>();
  private busSub: Subscription | null = null;

  constructor(
    private readonly events: EventsService,
    private readonly jwt: JwtService,
  ) {}

  // Subscribe to the in-process bus once at gateway init. Every emission
  // becomes a broadcast to authed clients. The fan-out lives here, not in
  // EventsService, so the service doesn't have to know about transport.
  afterInit(_server: Server): void {
    this.busSub = this.events.events$.subscribe((msg) => this.broadcast(msg));
    this.logger.log('Events gateway ready on /events');
  }

  handleConnection(client: WebSocket, req: IncomingMessage): void {
    // Drop the connection if the client doesn't authenticate within
    // AUTH_TIMEOUT_MS. Without this, an unauthenticated socket could sit
    // half-open forever consuming a slot.
    const timer = setTimeout(() => {
      const s = this.state.get(client);
      if (s && !s.authed) {
        this.logger.warn(`Auth timeout from ${req.socket.remoteAddress}; closing`);
        client.close(4001, 'auth timeout');
      }
    }, AUTH_TIMEOUT_MS);

    this.state.set(client, { authed: false, authTimer: timer });

    client.on('message', (raw: Buffer) => this.onMessage(client, raw));
  }

  handleDisconnect(client: WebSocket): void {
    const s = this.state.get(client);
    if (s?.authTimer) clearTimeout(s.authTimer);
    this.authedClients.delete(client);
    this.state.delete(client);
  }

  // Single message handler — the only client→server message we currently
  // accept is the auth handshake. Anything else is silently ignored.
  // (Future: extend with per-client subscription filters if the firehose
  // gets too noisy.)
  private onMessage(client: WebSocket, raw: Buffer): void {
    const s = this.state.get(client);
    if (!s) return;

    let parsed: { type?: string; token?: string };
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      // Malformed JSON before auth: close. After auth: ignore (forward-
      // compat with future client-sent message types).
      if (!s.authed) client.close(4002, 'invalid message');
      return;
    }

    if (parsed.type === 'auth' && !s.authed) {
      try {
        const payload: any = this.jwt.verify(parsed.token ?? '');
        s.authed = true;
        s.user = { id: payload.sub, email: payload.email, role: payload.role };
        if (s.authTimer) {
          clearTimeout(s.authTimer);
          s.authTimer = null;
        }
        this.authedClients.add(client);
        this.logger.log(`Auth ok: ${s.user.email} (${s.user.role})`);
        client.send(JSON.stringify({
          type: 'auth.ok',
          payload: { email: s.user.email },
          timestamp: new Date().toISOString(),
        }));
      } catch (err) {
        this.logger.warn('Auth failed: invalid JWT');
        client.close(4002, 'invalid auth');
      }
    }
  }

  private broadcast(msg: EventMessage): void {
    if (this.authedClients.size === 0) return;
    const data = JSON.stringify(msg);
    for (const client of this.authedClients) {
      // ws.OPEN === 1, but readyState comparison via the constant kept
      // for clarity. Skip half-closed sockets.
      if (client.readyState === client.OPEN) {
        try {
          client.send(data);
        } catch (err) {
          this.logger.warn(`Send failed; dropping client: ${(err as Error).message}`);
          this.authedClients.delete(client);
        }
      }
    }
  }
}
