import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { startWith, takeUntil } from 'rxjs/operators';

import { SystemConfigStore, formatInZone } from '../../../@core/utils';

@Component({
  selector: 'ngx-footer',
  styleUrls: ['./footer.component.scss'],
  template: `
    <div class="clock" [attr.title]="timezone">
      <span class="clock-zone">{{ timezone }}</span>
      <span class="clock-divider">·</span>
      <span class="clock-time">{{ formatted }}</span>
    </div>
    <div class="socials">
      <a href="#" target="_blank" class="ion ion-social-github"></a>
      <a href="#" target="_blank" class="ion ion-social-facebook"></a>
      <a href="#" target="_blank" class="ion ion-social-twitter"></a>
      <a href="#" target="_blank" class="ion ion-social-linkedin"></a>
    </div>
  `,
})
export class FooterComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  timezone = 'UTC';
  dateFormat = 'YYYY-MM-DD';
  formatted = '';

  constructor(private readonly configStore: SystemConfigStore) {}

  ngOnInit(): void {
    this.configStore.config$.pipe(takeUntil(this.destroy$)).subscribe((c) => {
      this.timezone = c?.defaultTimezone || 'UTC';
      this.dateFormat = c?.dateFormat || 'YYYY-MM-DD';
      this.formatted = formatInZone(new Date(), this.timezone, this.dateFormat);
    });

    // Tick once a minute. The clock shows minutes only, so polling faster
    // would just churn change detection without changing the rendered string.
    interval(60_000)
      .pipe(startWith(0), takeUntil(this.destroy$))
      .subscribe(() => {
        this.formatted = formatInZone(new Date(), this.timezone, this.dateFormat);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
