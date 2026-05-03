import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbProgressBarModule, NbBadgeModule, NbButtonModule, NbListModule } from '@nebular/theme';

import { ThemeModule } from '../../@theme/theme.module';
import { DashboardComponent } from './dashboard.component';

@NgModule({
  imports: [
    CommonModule,
    NbCardModule,
    NbIconModule,
    NbProgressBarModule,
    NbBadgeModule,
    NbButtonModule,
    NbListModule,
    ThemeModule,
  ],
  declarations: [
    DashboardComponent,
  ],
})
export class DashboardModule { }
