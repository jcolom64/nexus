import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ApiAssetType = 'TABLE' | 'VIEW' | 'TOPIC' | 'FILE' | 'API';

export type ApiAssetTag =
  | 'PII' | 'GDPR' | 'SENSITIVE' | 'CERTIFIED' | 'DEPRECATED' | 'GOLDEN';

export type ApiAssetDomain =
  | 'SALES' | 'FINANCE' | 'MARKETING' | 'PRODUCT' | 'COMPLIANCE' | 'OPS';

export interface ApiSchemaField {
  name: string;
  type: string;
  pii?: boolean;
}

export interface ApiAsset {
  id: string;
  name: string;
  qualifiedName: string;
  type: ApiAssetType;
  sourceId: string;
  sourceName: string;
  schema: ApiSchemaField[];
  rowCount: number;
  sizeMb: number;
  ownerEmail: string | null;
  ownerName: string | null;
  domain: ApiAssetDomain;
  tags: ApiAssetTag[];
  description: string;
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  upstream: string[];   // qualifiedNames
  downstream: string[]; // qualifiedNames
}

export interface CreateAssetPayload {
  name: string;
  qualifiedName: string;
  type: ApiAssetType;
  domain: ApiAssetDomain;
  sourceId: string;
  schema: ApiSchemaField[];
  rowCount?: number;
  sizeMb?: number;
  ownerEmail?: string;
  ownerName?: string;
  tags?: ApiAssetTag[];
  description?: string;
  upstream?: string[];
  downstream?: string[];
}

export type UpdateAssetPayload = Partial<CreateAssetPayload>;

@Injectable({ providedIn: 'root' })
export class AssetsApiService {
  private readonly base = `${environment.apiBase}/assets`;

  constructor(private http: HttpClient) {}

  list(): Observable<ApiAsset[]> {
    return this.http.get<ApiAsset[]>(this.base);
  }

  get(id: string): Observable<ApiAsset> {
    return this.http.get<ApiAsset>(`${this.base}/${id}`);
  }

  create(payload: CreateAssetPayload): Observable<ApiAsset> {
    return this.http.post<ApiAsset>(this.base, payload);
  }

  update(id: string, payload: UpdateAssetPayload): Observable<ApiAsset> {
    return this.http.patch<ApiAsset>(`${this.base}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
