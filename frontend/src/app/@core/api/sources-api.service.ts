import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ApiSourceType =
  | 'POSTGRES' | 'MYSQL' | 'MONGODB' | 'S3'
  | 'REST_API' | 'KAFKA' | 'SNOWFLAKE' | 'REDIS';

export type ApiSourceStatus = 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'STALE';

export interface ApiSource {
  id: string;
  name: string;
  type: ApiSourceType;
  status: ApiSourceStatus;
  description: string;
  host: string | null;
  port: number | null;
  database: string | null;
  username: string | null;
  // The wire shape never carries the encrypted password — it's strictly
  // write-only. `hasCredentials` lets the UI show "creds configured"
  // without round-tripping the secret.
  hasCredentials: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
}

export interface CreateSourcePayload {
  name: string;
  type: ApiSourceType;
  status?: ApiSourceStatus;
  description?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

// Update accepts the same fields plus a special case: `password === ''`
// clears the stored credential. `password === undefined` leaves it alone.
export type UpdateSourcePayload = Partial<CreateSourcePayload>;

export interface ApiTestSourceResult {
  ok: boolean;
  latencyMs: number;
  status: ApiSourceStatus;
  error?: string;
}

export interface ApiSyncSourceResult {
  ok: boolean;
  status: ApiSourceStatus;
  discoveredCount: number;
  upsertedCount: number;
  durationMs: number;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class SourcesApiService {
  private readonly base = `${environment.apiBase}/sources`;

  constructor(private http: HttpClient) {}

  list(): Observable<ApiSource[]> {
    return this.http.get<ApiSource[]>(this.base);
  }

  get(id: string): Observable<ApiSource> {
    return this.http.get<ApiSource>(`${this.base}/${id}`);
  }

  create(payload: CreateSourcePayload): Observable<ApiSource> {
    return this.http.post<ApiSource>(this.base, payload);
  }

  update(id: string, payload: UpdateSourcePayload): Observable<ApiSource> {
    return this.http.patch<ApiSource>(`${this.base}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  // Phase 5b: probe the source. Backend always returns 200 — failures land
  // in `result.error`. The source's `status` is updated server-side as a
  // side effect.
  test(id: string): Observable<ApiTestSourceResult> {
    return this.http.post<ApiTestSourceResult>(`${this.base}/${id}/test`, {});
  }

  // Phase 5b: introspect tables/views and upsert as Assets. Returns counts
  // + duration; on failure status flips to DISCONNECTED and `error` is set.
  sync(id: string): Observable<ApiSyncSourceResult> {
    return this.http.post<ApiSyncSourceResult>(`${this.base}/${id}/sync`, {});
  }
}
