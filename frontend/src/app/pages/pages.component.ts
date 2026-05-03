import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbMenuService, NbSidebarService } from '@nebular/theme';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

import { MENU_ITEMS } from './pages-menu';

@Component({
  selector: 'ngx-pages',
  styleUrls: ['pages.component.scss'],
  template: `
    <ngx-one-column-layout>
      <div class="sidebar-content">
        <a (click)="toggleSidebar()" href="#" class="sidebar-toggle">
          <nb-icon icon="menu-outline"></nb-icon>
        </a>
        <nb-menu [items]="menu" (itemClick)="onMenuClick($event)"></nb-menu>
      </div>
      <router-outlet></router-outlet>
    </ngx-one-column-layout>
  `,
})
export class PagesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  menu = MENU_ITEMS;

  constructor(
    private menuService: NbMenuService,
    private sidebarService: NbSidebarService,
    private router: Router
  ) {}

  ngOnInit() {
    // Listen for menu clicks
    this.menuService.onItemClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: any) => {
        console.log('Menu service click:', event);
        this.expandSidebar();
      });

    // Listen for router navigation events
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        console.log('Navigation to:', event.url);
        // Check if navigating to a menu page
        const menuRoutes = ['/pages/dashboard', '/pages/assets', '/pages/system'];
        if (menuRoutes.includes(event.url)) {
          this.expandSidebar();
        }
      });
  }

  onMenuClick(event: any) {
    console.log('Direct template click:', event);
    this.expandSidebar();
  }

  toggleSidebar(): boolean {
    this.sidebarService.toggle(true, 'menu-sidebar');
    return false;
  }

  private expandSidebar() {
    // Ensure sidebar is expanded when menu items are clicked
    console.log('Expanding sidebar...');
    this.sidebarService.expand('menu-sidebar');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
