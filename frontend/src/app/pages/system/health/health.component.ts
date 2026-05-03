import { Component, OnInit } from '@angular/core';

interface HealthMetric {
  name: string;
  status: 'success' | 'warning' | 'danger' | 'info';
  value: string;
  description: string;
}

@Component({
  selector: 'ngx-health',
  template: `
    <div class="health-container">
      <div class="health-overview">
        <h6>System Health Overview</h6>
        <p class="description">Monitor the overall health and status of system components.</p>
      </div>
      
      <div class="health-metrics">
        <div class="metric-card" *ngFor="let metric of healthMetrics">
          <div class="metric-header">
            <nb-icon [icon]="getStatusIcon(metric.status)" [status]="metric.status"></nb-icon>
            <span class="metric-name">{{ metric.name }}</span>
          </div>
          <div class="metric-value">
            <span [ngClass]="'status-' + metric.status">{{ metric.value }}</span>
          </div>
          <div class="metric-description">
            <small>{{ metric.description }}</small>
          </div>
        </div>
      </div>
      
      <div class="health-actions">
        <button nbButton status="primary" size="small" (click)="refreshHealth()">
          <nb-icon icon="refresh-outline"></nb-icon>
          Refresh Status
        </button>
        <button nbButton ghost status="basic" size="small" (click)="viewLogs()">
          <nb-icon icon="file-text-outline"></nb-icon>
          View Logs
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./health.component.scss']
})
export class HealthComponent implements OnInit {
  
  healthMetrics: HealthMetric[] = [
    {
      name: 'Database Connection',
      status: 'success',
      value: 'Connected',
      description: 'Primary database connection is stable'
    },
    {
      name: 'API Response Time',
      status: 'success',
      value: '< 200ms',
      description: 'Average response time is within acceptable range'
    },
    {
      name: 'Memory Usage',
      status: 'warning',
      value: '78%',
      description: 'Memory usage is approaching threshold'
    },
    {
      name: 'Disk Space',
      status: 'success',
      value: '42% Used',
      description: 'Sufficient disk space available'
    },
    {
      name: 'Active Sessions',
      status: 'info',
      value: '24',
      description: 'Currently active user sessions'
    },
    {
      name: 'External Services',
      status: 'success',
      value: '3/3 Online',
      description: 'All external service dependencies are operational'
    }
  ];

  constructor() { }

  ngOnInit(): void {
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'success':
        return 'checkmark-circle-2-outline';
      case 'warning':
        return 'alert-triangle-outline';
      case 'danger':
        return 'close-circle-outline';
      case 'info':
        return 'info-outline';
      default:
        return 'question-mark-circle-outline';
    }
  }

  refreshHealth(): void {
    console.log('Refreshing health status...');
    // TODO: Implement health status refresh
  }

  viewLogs(): void {
    console.log('Opening system logs...');
    // TODO: Implement log viewer
  }
}