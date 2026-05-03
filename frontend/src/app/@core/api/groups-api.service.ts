import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ApiSystemRole = 'SYSTEM_ADMIN' | 'ACCOUNT_VIEWER' | 'LICENSE_OVERRIDE' | 'USER_VIEWER';

export interface ApiAccount {
  id: string;
  name: string;
}

export interface ApiGroupAccountAssignment {
  accountId: string;
  accountName: string;
  role: ApiSystemRole;
}

export interface ApiUserGroup {
  id: string;
  name: string;
  description: string;
  systemRoles: ApiSystemRole[];
  accountAssignments: ApiGroupAccountAssignment[];
  memberEmails: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  systemRoles?: ApiSystemRole[];
  accountAssignments?: { accountId: string; role: ApiSystemRole }[];
  memberEmails?: string[];
}

export type UpdateGroupPayload = Partial<CreateGroupPayload>;

@Injectable({ providedIn: 'root' })
export class GroupsApiService {
  private readonly base = `${environment.apiBase}/groups`;
  private readonly accountsBase = `${environment.apiBase}/accounts`;

  constructor(private http: HttpClient) {}

  list(): Observable<ApiUserGroup[]> {
    return this.http.get<ApiUserGroup[]>(this.base);
  }

  get(id: string): Observable<ApiUserGroup> {
    return this.http.get<ApiUserGroup>(`${this.base}/${id}`);
  }

  create(payload: CreateGroupPayload): Observable<ApiUserGroup> {
    return this.http.post<ApiUserGroup>(this.base, payload);
  }

  update(id: string, payload: UpdateGroupPayload): Observable<ApiUserGroup> {
    return this.http.patch<ApiUserGroup>(`${this.base}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  listAccounts(): Observable<ApiAccount[]> {
    return this.http.get<ApiAccount[]>(this.accountsBase);
  }
}
