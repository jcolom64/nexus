import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

// Wire shape of the singleton security-settings row. Mirrors
// `SecuritySettings` on the component side — kept as a flat object.
export interface ApiSecuritySettings {
  id: string;

  loginMethods: string[];
  mfaMode: string;
  ssoIssuer: string;
  sessionTimeoutMinutes: number;
  rememberMeEnabled: boolean;

  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  passwordExpiryDays: number;
  passwordHistoryCount: number;

  failedAttemptThreshold: number;
  lockoutDurationMinutes: number;

  ipAllowlist: string;
  rateLimitPerMinute: number;

  tlsMinimumVersion: string;
  encryptionAtRest: boolean;
  auditRetentionDays: number;

  updatedAt: string;
}

export type UpdateSecuritySettingsPayload = Partial<Omit<ApiSecuritySettings, 'id' | 'updatedAt'>>;

@Injectable({ providedIn: 'root' })
export class SecurityApiService {
  private readonly base = `${environment.apiBase}/security`;

  constructor(private http: HttpClient) {}

  get(): Observable<ApiSecuritySettings> {
    return this.http.get<ApiSecuritySettings>(this.base);
  }

  update(payload: UpdateSecuritySettingsPayload): Observable<ApiSecuritySettings> {
    return this.http.put<ApiSecuritySettings>(this.base, payload);
  }
}
