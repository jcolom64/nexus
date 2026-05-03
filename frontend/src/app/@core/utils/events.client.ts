import { Injectable, OnDestroy } from '@angular/core';
import { NbAuthJWTToken, NbAuthService } from '@nebular/auth';
import { Subject, Subscription } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Wire shape of every message we receive from the gateway. Mirrors the
// backend EventMessage<T> in `events.service.ts` — keep them in sync.
export interface EventMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
}

// Backoff schedule for reconnect attempts. Multiplies on every consecutive
// failure, caps at MAX. Reset to MIN on a successful auth.
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// Live event stream from the backend WebSocket gateway. Subscribers get
// every message the server broadcasts after authentication; component
// code filters by `msg.type` to react only to its slice.
//
// Auth flow:
//   1. NbAuthService.onTokenChange() yields a valid JWT.
//   2. We open the WebSocket and send `{ type: 'auth', token }` as the
//      first message. The server validates and replies with
//      `{ type: 'auth.ok' }` or closes the socket.
//   3. From then on, any server-side `events.emit(...)` arrives here
//      and is multiplexed onto the `events$` subject.
//
// The class manages its own reconnect with exponential backoff so
// components don't have to.
@Injectable({ providedIn: 'root' })
export class EventsClient implements OnDestroy {
  private socket: WebSocket | null = null;
  private currentToken: string | null = null;
  private backoff = RECONNECT_MIN_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  private readonly subject = new Subject<EventMessage>();
  /** Stream of all events from the server (after auth). Hot. */
  readonly events$ = this.subject.asObservable();

  /** Convenience: pre-filtered stream by message type. */
  on<T = unknown>(type: string) {
    return this.events$.pipe(filter((m): m is EventMessage<T> => m.type === type));
  }

  // We watch the auth token for changes (login, logout, expiry-driven
  // refresh) and re-key the socket so every connection holds a current
  // JWT.
  private readonly authSub: Subscription;

  constructor(private readonly auth: NbAuthService) {
    this.authSub = this.auth.onTokenChange().subscribe((token: NbAuthJWTToken) => {
      const value = token && token.isValid() ? token.getValue() : null;
      if (value === this.currentToken) return;
      this.currentToken = value;
      // On any token change, tear down and rebuild — even on logout, so
      // the server-side socket goes away.
      this.disconnect();
      if (value) this.connect();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.authSub.unsubscribe();
    this.disconnect();
  }

  private connect(): void {
    if (!this.currentToken) return;
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) return;

    const ws = new WebSocket(environment.wsBase);
    this.socket = ws;

    ws.addEventListener('open', () => {
      // Send auth first thing. The server is waiting; if we don't auth
      // within ~5s it will close us with code 4001.
      ws.send(JSON.stringify({ type: 'auth', token: this.currentToken }));
    });

    ws.addEventListener('message', (ev) => {
      let parsed: EventMessage;
      try {
        parsed = JSON.parse(ev.data) as EventMessage;
      } catch {
        return;
      }
      // Reset backoff once the server has accepted the auth — that's the
      // first message we'll see, and it confirms the connection is fully
      // established.
      if (parsed.type === 'auth.ok') {
        this.backoff = RECONNECT_MIN_MS;
      }
      this.subject.next(parsed);
    });

    ws.addEventListener('close', () => {
      this.socket = null;
      if (this.destroyed) return;
      if (!this.currentToken) return; // logged out — don't reconnect
      this.scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // The 'close' handler will run after this and trigger the reconnect.
      // No-op here besides letting the browser surface the error to the
      // console.
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, RECONNECT_MAX_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try { this.socket.close(1000, 'client disconnect'); } catch { /* ignore */ }
      this.socket = null;
    }
    this.backoff = RECONNECT_MIN_MS;
  }
}

// Re-exported for convenient component-side use.
export { takeUntil };
