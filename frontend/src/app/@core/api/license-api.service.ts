import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

// Wire shape of the singleton license row. License is install-time data
// written by the backend's `license:apply` CLI; the API exposes only a
// read endpoint, so this service has no `update()`.
export interface ApiLicense {
  id: string;
  licenseKey: string;
  plan: string;
  seatsTotal: number;
  licenseExpires: string; // YYYY-MM-DD or '' for perpetual
  appliedAt: string;
  appliedBy: string | null;
  notes: string | null;
}

@Injectable({ providedIn: 'root' })
export class LicenseApiService {
  private readonly base = `${environment.apiBase}/license`;

  constructor(private http: HttpClient) {}

  get(): Observable<ApiLicense> {
    return this.http.get<ApiLicense>(this.base);
  }
}
