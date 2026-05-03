import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { NbAuthJWTToken, NbAuthService } from '@nebular/auth';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

/**
 * Blocks navigation to /pages/** when the user has no valid JWT.
 * Sends them to /auth/login instead.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: NbAuthService, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.auth.getToken().pipe(
      take(1),
      map((token: NbAuthJWTToken) => {
        if (token && token.isValid()) return true;
        this.router.navigate(['/auth/login']);
        return false;
      }),
    );
  }
}
