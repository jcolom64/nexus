import { ModuleWithProviders, NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import {
  NB_AUTH_INTERCEPTOR_HEADER,
  NB_AUTH_TOKEN_INTERCEPTOR_FILTER,
  NbAuthJWTInterceptor,
  NbAuthJWTToken,
  NbAuthModule,
  NbAuthService,
  NbPasswordAuthStrategy,
} from '@nebular/auth';
import { NbSecurityModule, NbRoleProvider } from '@nebular/security';
import { Observable, of as observableOf } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { throwIfAlreadyLoaded } from './module-import-guard';
import { AnalyticsService, SeoService } from './utils';
import { UserData } from './data/users';
import { UserService } from './mock/users.service';
import { MockDataModule } from './mock/mock-data.module';
import { environment } from '../../environments/environment';

const socialLinks = [
  {
    url: 'https://github.com/akveo/nebular',
    target: '_blank',
    icon: 'github',
  },
  {
    url: 'https://www.facebook.com/akveo/',
    target: '_blank',
    icon: 'facebook',
  },
  {
    url: 'https://twitter.com/akveo_inc',
    target: '_blank',
    icon: 'twitter',
  },
];

const DATA_SERVICES = [
  { provide: UserData, useClass: UserService },
];

// Resolves the current user's role from the JWT issued by the Nexus API. The
// API encodes role as a top-level claim ('ADMINISTRATOR' | 'MANAGER' | 'USER'
// | 'AUDITOR'); we lower-case it so the access-control map below stays
// idiomatic CSS-style. Falls back to 'guest' when there's no valid token.
export class NbSimpleRoleProvider extends NbRoleProvider {
  constructor(private readonly authService: NbAuthService) {
    super();
  }

  getRole(): Observable<string> {
    return this.authService.onTokenChange().pipe(
      map((token: NbAuthJWTToken) => {
        if (!token || !token.isValid()) return 'guest';
        const payload: any = token.getPayload();
        const role: string | undefined = payload?.role;
        return role ? role.toLowerCase() : 'guest';
      }),
      catchError(() => observableOf('guest')),
    );
  }
}

export const NB_CORE_PROVIDERS = [
  ...MockDataModule.forRoot().providers,
  ...DATA_SERVICES,
  ...NbAuthModule.forRoot({

    strategies: [
      NbPasswordAuthStrategy.setup({
        name: 'email',
        baseEndpoint: environment.apiBase + '/auth',
        login: {
          endpoint: '/login',
          method: 'post',
          redirect: { success: '/pages/dashboard', failure: null },
          defaultErrors: ['Invalid email or password.'],
          defaultMessages: ['You have been successfully logged in.'],
        },
        logout: {
          endpoint: '/logout',
          method: 'post',
          redirect: { success: '/auth/login', failure: null },
        },
        // Server returns { accessToken, user }. Nebular's NbAuthJWTToken
        // wants the JWT string at a configurable path within the response.
        token: {
          class: NbAuthJWTToken,
          key: 'accessToken',
        },
      }),
    ],
    forms: {
      login: {
        socialLinks: socialLinks,
        rememberMe: true,
      },
      register: {
        socialLinks: socialLinks,
      },
    },
  }).providers,

  NbSecurityModule.forRoot({
    accessControl: {
      guest: {
        view: ['public'],
      },
      auditor: {
        parent: 'guest',
        view: '*',
      },
      user: {
        parent: 'auditor',
        create: ['profile'],
        edit:   ['profile'],
      },
      manager: {
        parent: 'user',
        create: '*',
        edit:   '*',
        remove: ['user', 'group'],
      },
      administrator: {
        parent: 'manager',
        create: '*',
        edit:   '*',
        remove: '*',
      },
    },
  }).providers,

  {
    provide: NbRoleProvider,
    useClass: NbSimpleRoleProvider,
    deps: [NbAuthService],
  },
  // Attach the JWT to outgoing requests, but ONLY for our API origin —
  // otherwise we'd leak it to Google Maps, Eva Icons CDN, etc.
  {
    provide: HTTP_INTERCEPTORS,
    useClass: NbAuthJWTInterceptor,
    multi: true,
  },
  {
    provide: NB_AUTH_INTERCEPTOR_HEADER,
    useValue: 'Authorization',
  },
  // The Nebular interceptor calls this filter for every request and skips
  // attaching the token whenever the predicate returns true. We only want
  // the token going to the Nexus API — and we also skip /auth/login and
  // /auth/register (public endpoints): if a stale or malformed token is
  // sitting in localStorage, isAuthenticatedOrRefresh() can hang the login
  // request before it ever leaves the browser.
  {
    provide: NB_AUTH_TOKEN_INTERCEPTOR_FILTER,
    useValue: (req: any) => {
      if (!req.url.startsWith(environment.apiBase)) return true;
      if (req.url.startsWith(environment.apiBase + '/auth/login')) return true;
      if (req.url.startsWith(environment.apiBase + '/auth/register')) return true;
      return false;
    },
  },
  AnalyticsService,
  SeoService,
];

@NgModule({
  imports: [
    CommonModule,
  ],
  exports: [
    NbAuthModule,
  ],
  declarations: [],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    throwIfAlreadyLoaded(parentModule, 'CoreModule');
  }

  static forRoot(): ModuleWithProviders<CoreModule> {
    return {
      ngModule: CoreModule,
      providers: [
        ...NB_CORE_PROVIDERS,
      ],
    };
  }
}
