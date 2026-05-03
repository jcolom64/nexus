/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
import { Component, OnInit } from '@angular/core';
import { AnalyticsService } from './@core/utils/analytics.service';
import { SeoService } from './@core/utils/seo.service';
import { SettingsService } from './@core/utils/settings.service';

@Component({
  selector: 'ngx-app',
  template: '<router-outlet></router-outlet>',
})
export class AppComponent implements OnInit {

  constructor(
    private analytics: AnalyticsService, 
    private seoService: SeoService,
    private settingsService: SettingsService
  ) {
  }

  ngOnInit() {
    this.analytics.trackPageViews();
    this.seoService.trackCanonicalChanges();
    // Settings service is initialized via constructor injection
    // This ensures saved settings are loaded and applied on app startup
  }
}
