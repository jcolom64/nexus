import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ApiAuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'EXPORT';
export type ApiAuditCategory = 'AUTH' | 'USER' | 'CONFIG' | 'DATA' | 'SECURITY';
export type ApiAuditOutcome = 'SUCCESS' | 'FAILED' | 'WARNING';

export interface ApiAuditEntry {
  id: string;
  timestamp: string;
  actorId: string | null;
  actorEmail: string;
  actorName: string | null;
  action: ApiAuditAction;
  category: ApiAuditCategory;
  resource: string;
  resourceType: string;
  source: string | null;
  outcome: ApiAuditOutcome;
  metadata?: Record<string, unknown> | null;
}

export interface ApiAuditPage {
  entries: ApiAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditQueryParams {
  category?: ApiAuditCategory;
  action?: ApiAuditAction;
  outcome?: ApiAuditOutcome;
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly base = `${environment.apiBase}/audit`;

  constructor(private http: HttpClient) {}

  query(q: AuditQueryParams = {}): Observable<ApiAuditPage> {
    let params = new HttpParams();
    if (q.category) params = params.set('category', q.category);
    if (q.action)   params = params.set('action', q.action);
    if (q.outcome)  params = params.set('outcome', q.outcome);
    if (q.search)   params = params.set('search', q.search);
    if (q.page)     params = params.set('page', q.page.toString());
    if (q.pageSize) params = params.set('pageSize', q.pageSize.toString());
    return this.http.get<ApiAuditPage>(this.base, { params });
  }
}
