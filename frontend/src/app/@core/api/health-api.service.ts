import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ApiComponentStatus = 'success' | 'warning' | 'danger';

export interface ApiHealthComponent {
  name: string;
  status: ApiComponentStatus;
  label: string;
  latencyMs?: number;
  message?: string;
}

export interface ApiHealthCheck {
  overall: ApiComponentStatus;
  components: ApiHealthComponent[];
  timestamp: string;
}

export interface ApiHealthMetrics {
  app: { cpuPercent: number; memoryRssBytes: number };
  system: { cpuPercent: number; memoryUsedBytes: number; memoryTotalBytes: number };
  cores: number;
  loadAvg1m: number;
  databaseSizeBytes: number;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class HealthApiService {
  private readonly base = `${environment.apiBase}/health`;

  constructor(private http: HttpClient) {}

  check(): Observable<ApiHealthCheck> {
    return this.http.get<ApiHealthCheck>(`${this.base}/check`);
  }

  metrics(): Observable<ApiHealthMetrics> {
    return this.http.get<ApiHealthMetrics>(`${this.base}/metrics`);
  }
}
