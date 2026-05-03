import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ApiRole = 'ADMINISTRATOR' | 'MANAGER' | 'USER' | 'AUDITOR';
export type ApiState = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'INVITED';

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: ApiRole;
  state: ApiState;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  groups: { id: string; name: string }[];
}

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  role?: ApiRole;
  state?: ApiState;
  groupIds?: string[];
}

export interface UpdateUserPayload {
  email?: string;
  name?: string;
  password?: string;
  role?: ApiRole;
  state?: ApiState;
  // `[]` removes from all groups; omit to leave membership untouched.
  groupIds?: string[];
}

// Self-edit payload — strict subset of UpdateUserPayload. Mirrors the
// server's UpdateMeDto: name only. Role/state/email/password/group changes
// for self are not allowed via this path.
export interface UpdateMePayload {
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly base = `${environment.apiBase}/users`;

  constructor(private http: HttpClient) {}

  list(): Observable<ApiUser[]> {
    return this.http.get<ApiUser[]>(this.base);
  }

  get(id: string): Observable<ApiUser> {
    return this.http.get<ApiUser>(`${this.base}/${id}`);
  }

  create(payload: CreateUserPayload): Observable<ApiUser> {
    return this.http.post<ApiUser>(this.base, payload);
  }

  update(id: string, payload: UpdateUserPayload): Observable<ApiUser> {
    return this.http.patch<ApiUser>(`${this.base}/${id}`, payload);
  }

  // Self-edit. Backed by `PATCH /users/me` — accepts `name` only.
  updateMe(payload: UpdateMePayload): Observable<ApiUser> {
    return this.http.patch<ApiUser>(`${this.base}/me`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
