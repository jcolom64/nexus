import { Injectable } from '@angular/core';
import { NbAuthJWTToken, NbAuthService } from '@nebular/auth';
import { BehaviorSubject, EMPTY, Observable } from 'rxjs';
import { catchError, filter, switchMap, tap } from 'rxjs/operators';

import {
  ApiSystemConfig,
  ConfigApiService,
  UpdateSystemConfigPayload,
} from '../api/config-api.service';

// Process-wide singleton holding the latest system config. The header/footer
// subscribe to render app name + clock; SystemComponent uses `update()` so a
// save propagates to those without a page reload.
//
// Initial fetch is deferred until the JWT is valid — `/api/config` needs auth.
@Injectable({ providedIn: 'root' })
export class SystemConfigStore {
  private readonly subject = new BehaviorSubject<ApiSystemConfig | null>(null);
  readonly config$ = this.subject.asObservable();

  constructor(
    private readonly api: ConfigApiService,
    private readonly auth: NbAuthService,
  ) {
    this.auth
      .onTokenChange()
      .pipe(
        filter((t: NbAuthJWTToken) => !!(t && t.isValid())),
        switchMap(() => this.api.get().pipe(catchError(() => EMPTY))),
      )
      .subscribe((c) => this.subject.next(c));
  }

  get value(): ApiSystemConfig | null {
    return this.subject.value;
  }

  refresh(): Observable<ApiSystemConfig> {
    return this.api.get().pipe(tap((c) => this.subject.next(c)));
  }

  update(payload: UpdateSystemConfigPayload): Observable<ApiSystemConfig> {
    return this.api.update(payload).pipe(tap((c) => this.subject.next(c)));
  }
}
