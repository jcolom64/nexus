import { Component, OnInit, OnDestroy, ElementRef, Renderer2, AfterViewInit } from '@angular/core';
import { NbSidebarService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil, delay } from 'rxjs/operators';

@Component({
  selector: 'ngx-one-column-layout',
  styleUrls: ['./one-column.layout.scss'],
  template: `
    <nb-layout windowMode>
      <nb-layout-header fixed>
        <ngx-header></ngx-header>
      </nb-layout-header>

      <nb-sidebar
        class="menu-sidebar"
        tag="menu-sidebar"
        start
        responsive
        [collapsedBreakpoints]="[]">
        <ng-content></ng-content>
      </nb-sidebar>

      <nb-layout-column class="main-content" #mainContent>
        <ng-content select="router-outlet"></ng-content>
      </nb-layout-column>

      <nb-layout-footer fixed>
        <ngx-footer></ngx-footer>
      </nb-layout-footer>
    </nb-layout>
  `,
})
export class OneColumnLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private sidebarService: NbSidebarService,
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit() {
    this.setupSidebarStateListener();
  }

  ngAfterViewInit() {
    // Initial layout adjustment
    setTimeout(() => this.adjustContentArea(), 100);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSidebarStateListener() {
    // Listen to sidebar state changes via Nebular services
    this.sidebarService.onToggle()
      .pipe(
        takeUntil(this.destroy$),
        delay(50) // Small delay to ensure DOM updates
      )
      .subscribe((data: any) => {
        console.log('Sidebar toggle detected:', data);
        this.adjustContentArea();
      });

    this.sidebarService.onExpand()
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: any) => {
        console.log('Sidebar expand detected:', data);
        setTimeout(() => this.adjustContentArea(), 100);
      });

    this.sidebarService.onCollapse()
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: any) => {
        console.log('Sidebar collapse detected:', data);
        setTimeout(() => this.adjustContentArea(), 100);
      });

    // Also use MutationObserver to catch any DOM changes to sidebar
    setTimeout(() => this.setupMutationObserver(), 500);
  }

  private setupMutationObserver() {
    const sidebar = this.elementRef.nativeElement.querySelector('.menu-sidebar');
    if (sidebar) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'class' || 
               mutation.attributeName === 'style')) {
            console.log('Sidebar DOM change detected:', mutation);
            setTimeout(() => this.adjustContentArea(), 50);
          }
        });
      });

      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });

      // Clean up observer on destroy
      this.destroy$.subscribe(() => {
        observer.disconnect();
      });
    }
  }

  private adjustContentArea() {
    // Read the sidebar's current state CLASS (set instantly by Nebular when
    // toggled), NOT its measured width — measuring during the CSS transition
    // returns intermediate values and lands the column at the wrong margin.
    const mainContent = this.elementRef.nativeElement.querySelector('.main-content');
    const sidebar = this.elementRef.nativeElement.querySelector('.menu-sidebar');
    if (!mainContent || !sidebar) return;

    const cls = (sidebar as HTMLElement).classList;

    let marginLeft: string;
    let contentWidth: string;

    if (cls.contains('collapsed')) {
      marginLeft = '0';
      contentWidth = '100%';
    } else if (cls.contains('compacted')) {
      marginLeft = '3.5rem';
      contentWidth = 'calc(100% - 3.5rem)';
    } else {
      // Expanded (default) — Nebular doesn't always carry the literal `expanded`
      // class while transitioning, so fall through to this branch.
      marginLeft = '10rem';
      contentWidth = 'calc(100% - 10rem)';
    }

    this.renderer.setStyle(mainContent, 'margin-left', marginLeft);
    this.renderer.setStyle(mainContent, 'width', contentWidth);
  }
}
