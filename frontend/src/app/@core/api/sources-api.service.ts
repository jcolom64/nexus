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
}

export type UpdateSourcePayload = Partial<CreateSourcePayload>;

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
}
