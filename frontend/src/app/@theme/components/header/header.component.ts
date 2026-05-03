import { Component, OnDestroy, OnInit } from '@angular/core';
import { NbMediaBreakpointsService, NbMenuService, NbSidebarService, NbThemeService } from '@nebular/theme';
import { NbAuthJWTToken, NbAuthService } from '@nebular/auth';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SettingsService, SystemConfigStore } from '../../../@core/utils';
import { UsersApiService } from '../../../@core/api/users-api.service';
import { environment } from '../../../../environments/environment';

import { UserData } from '../../../@core/data/users';
import { catchError, filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { EMPTY, Subject } from 'rxjs';

interface UserProfile {
  displayName: string;
  email: string;
  jobTitle: string;
  role: string;
  memberSince: string;
  timezone: string;
  locale: string;
  dateFormat: string;
  emailDigest: 'daily' | 'weekly' | 'never';
  emailMentions: boolean;
  emailAlerts: boolean;
  emailSystem: boolean;
  inAppDoNotDisturb: boolean;
  mfaEnabled: boolean;
}

@Component({
  selector: 'ngx-header',
  styleUrls: ['./header.component.scss'],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit, OnDestroy {

  private destroy$: Subject<void> = new Subject<void>();
  private readonly PROFILE_STORAGE_KEY = 'nexus-user-profile';

  userPictureOnly: boolean = false;
  user: any;

  currentTheme: 'default' | 'dark' = 'default';
  appName = 'Nexus';

  userMenu = [
    { title: 'Profile' },
    { title: 'Log out' },
  ];

  // ---- Profile modal -----------------------------------------------------

  readonly defaultProfile: UserProfile = {
    displayName: 'Jaime Colom',
    email: 'jcolom.contractor@anchore.com',
    jobTitle: 'System Administrator',
    role: 'Administrator',
    memberSince: '2026-02-14',
    timezone: 'America/Los_Angeles',
    locale: 'en-US',
    dateFormat: 'YYYY-MM-DD',
    emailDigest: 'weekly',
    emailMentions: true,
    emailAlerts: true,
    emailSystem: false,
    inAppDoNotDisturb: false,
    mfaEnabled: false,
  };

  profile: UserProfile = { ...this.defaultProfile };
  profileBaseline: UserProfile = { ...this.defaultProfile };

  profileModalOpen = false;
  profileSaved = false;
  profileSaving = false;
  profileError: string | null = null;
  private profileSavedTimer?: number;

  localeOptions = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'pt-BR', 'zh-CN'];
  timezoneOptions = ['UTC', 'America/Los_Angeles', 'America/New_York', 'America/Chicago', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore'];
  dateFormatOptions = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'D MMM YYYY', 'MMM D, YYYY'];

  constructor(private sidebarService: NbSidebarService,
              private menuService: NbMenuService,
              private themeService: NbThemeService,
              private userService: UserData,
              private breakpointService: NbMediaBreakpointsService,
              private settingsService: SettingsService,
              private authService: NbAuthService,
              private router: Router,
              private http: HttpClient,
              private systemConfigStore: SystemConfigStore,
              private usersApi: UsersApiService) {
  }

  ngOnInit() {
    // Get current theme from settings service; coerce any legacy theme value to default.
    const stored = this.settingsService.getCurrentTheme();
    this.currentTheme = stored === 'dark' ? 'dark' : 'default';
    if (stored !== this.currentTheme) {
      this.settingsService.setTheme(this.currentTheme);
    }

    this.loadProfile();

    // Whenever a valid JWT lands (login, page refresh, token rotation), pull
    // the authoritative user record from the API. Email/role/sub live in the
    // JWT but the displayName does not, so we hydrate from /auth/me.
    this.authService.onTokenChange()
      .pipe(
        takeUntil(this.destroy$),
        filter((token: NbAuthJWTToken) => !!(token && token.isValid())),
        switchMap((token: NbAuthJWTToken) => {
          const payload: any = token.getPayload();
          if (payload?.email) this.profile.email = payload.email;
          if (payload?.role) this.profile.role = this.formatRole(payload.role);
          return this.http.get<{ id: string; email: string; name: string; role: string }>(
            `${environment.apiBase}/auth/me`,
          ).pipe(catchError(() => EMPTY));
        }),
      )
      .subscribe(me => {
        this.profile.displayName = me.name;
        this.profile.email = me.email;
        this.profile.role = this.formatRole(me.role);
        this.profileBaseline = { ...this.profile };
      });

    this.userService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe((users: any) => this.user = users.nick);

    const { xl } = this.breakpointService.getBreakpointsMap();
    this.themeService.onMediaQueryChange()
      .pipe(
        map(([, currentBreakpoint]) => currentBreakpoint.width < xl),
        takeUntil(this.destroy$),
      )
      .subscribe((isLessThanXl: boolean) => this.userPictureOnly = isLessThanXl);

    this.themeService.onThemeChange()
      .pipe(
        map(({ name }) => name),
        takeUntil(this.destroy$),
      )
      .subscribe(themeName => {
        this.currentTheme = themeName === 'dark' ? 'dark' : 'default';
      });

    // Header label tracks the system-config app-name override. Falls back to
    // 'Nexus' if the store is empty (pre-auth) or the override is blank.
    this.systemConfigStore.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe((c) => {
        this.appName = c?.appNameOverride?.trim() || 'Nexus';
      });

    // Listen for user menu clicks
    this.menuService.onItemClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: any) => {
        this.onUserMenuClick(event.item.title);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleTheme(): void {
    const next = this.currentTheme === 'dark' ? 'default' : 'dark';
    this.currentTheme = next;
    this.settingsService.setTheme(next);
  }



  navigateHome() {
    this.menuService.navigateHome();
    return false;
  }

  onUserMenuClick(title: string) {
    switch (title) {
      case 'Profile':
        this.openProfile();
        break;
      case 'Log out':
        this.logout();
        break;
    }
  }

  // ---- Profile modal API -------------------------------------------------

  private loadProfile(): void {
    try {
      const raw = localStorage.getItem(this.PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserProfile>;
        this.profile = { ...this.defaultProfile, ...parsed };
      }
      this.profileBaseline = { ...this.profile };
    } catch {
      // ignore corrupted storage; keep defaults
    }
  }

  openProfile(): void {
    this.profile = { ...this.profileBaseline };
    this.profileModalOpen = true;
  }

  closeProfile(): void {
    if (this.profileDirty) {
      const ok = window.confirm('Discard unsaved profile changes?');
      if (!ok) return;
    }
    this.profileModalOpen = false;
  }

  saveProfile(): void {
    if (!this.canSaveProfile()) return;

    // The display name is the only field the backend currently accepts via
    // `PATCH /users/me` (User.name). Everything else in the modal —
    // job title, locale/tz/date format, notification toggles, MFA — is
    // browser-only until those features land. The Reserved info-banner in
    // the modal explains the asymmetry.
    const displayNameChanged = this.profile.displayName.trim() !== this.profileBaseline.displayName;

    const persistLocal = () => {
      try {
        localStorage.setItem(this.PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
      } catch {
        // storage may be full/disabled — nothing actionable
      }
      this.profileBaseline = { ...this.profile };
      this.profileSaving = false;
      this.profileSaved = true;
      if (this.profileSavedTimer !== undefined) clearTimeout(this.profileSavedTimer);
      this.profileSavedTimer = window.setTimeout(() => (this.profileSaved = false), 2000);
      this.profileModalOpen = false;
    };

    if (!displayNameChanged) {
      persistLocal();
      return;
    }

    this.profileSaving = true;
    this.profileError = null;
    this.usersApi.updateMe({ name: this.profile.displayName.trim() }).subscribe({
      next: (me) => {
        this.profile.displayName = me.name;
        persistLocal();
      },
      error: (err) => {
        this.profileError = err?.error?.message || err?.message || 'Failed to save profile';
        this.profileSaving = false;
      },
    });
  }

  resetProfile(): void {
    this.profile = { ...this.profileBaseline };
  }

  get profileDirty(): boolean {
    return JSON.stringify(this.profile) !== JSON.stringify(this.profileBaseline);
  }

  canSaveProfile(): boolean {
    return this.profile.displayName.trim().length > 0
      && /\S+@\S+\.\S+/.test(this.profile.email);
  }

  changePassword(): void {
    window.alert('Password change flow is not wired in this starter — would normally launch a guided dialog.');
  }

  toggleMfa(): void {
    this.profile.mfaEnabled = !this.profile.mfaEnabled;
  }

  private formatRole(role: string): string {
    if (!role) return '';
    const lower = role.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');
  }

  avatarHue(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 360;
  }

  resetSettings() {
    this.settingsService.resetSettings();
    // Update current theme display after reset
    const stored = this.settingsService.getCurrentTheme();
    this.currentTheme = stored === 'dark' ? 'dark' : 'default';
  }
  
  logout() {
    this.authService.logout('email').subscribe(() => {
      this.router.navigate(['/auth/login']);
    });
  }
  
  onWhatsNewClick() {
    // TODO: Implement What's New functionality
    console.log('What\'s New functionality to be implemented');
  }
}
