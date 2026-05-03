import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ApiNotificationEvent {
  id: string;
  label: string;
  enabled: boolean;
}

// Wire shape of the singleton system-config row. Mirrors `SystemConfig` on
// the frontend component — kept as a flat object so existing form bindings
// don't need to change.
export interface ApiSystemConfig {
  id: string;

  appNameOverride: string;
  defaultTheme: string;
  defaultLocale: string;
  defaultTimezone: string;
  dateFormat: string;
  firstDayOfWeek: string;

  defaultRefreshSeconds: number;
  defaultRetryAttempts: number;
  retryBackoffMultiplier: number;
  maxConcurrentConnectors: number;

  smtpHost: string;
  smtpPort: number;
  smtpRequireAuth: boolean;
  smtpUsername: string;
  smtpFromAddress: string;
  notificationEvents: ApiNotificationEvent[];
  slackWebhookUrl: string;
  teamsWebhookUrl: string;

  cacheTtlSeconds: number;
  queryTimeoutSeconds: number;
  maxUploadMb: number;
  maxConcurrentJobs: number;
  workerPoolSize: number;

  licenseKey: string;
  plan: string;
  seatsUsed: number;
  seatsTotal: number;
  licenseExpires: string;

  updatedAt: string;
}

export type UpdateSystemConfigPayload = Partial<Omit<ApiSystemConfig, 'id' | 'updatedAt'>>;

@Injectable({ providedIn: 'root' })
export class ConfigApiService {
  private readonly base = `${environment.apiBase}/config`;

  constructor(private http: HttpClient) {}

  get(): Observable<ApiSystemConfig> {
    return this.http.get<ApiSystemConfig>(this.base);
  }

  update(payload: UpdateSystemConfigPayload): Observable<ApiSystemConfig> {
    return this.http.put<ApiSystemConfig>(this.base, payload);
  }
}
