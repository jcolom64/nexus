import { NgModule } from '@angular/core';
import { 
  NbCardModule, 
  NbButtonModule, 
  NbIconModule, 
  NbSelectModule, 
  NbBadgeModule,
  NbTabsetModule
} from '@nebular/theme';

import { ThemeModule } from '../../@theme/theme.module';
import { AccountComponent } from './account/account.component';
import { HealthComponent } from './health/health.component';

@NgModule({
  imports: [
    ThemeModule,
    NbCardModule,
    NbButtonModule,
    NbIconModule,
    NbSelectModule,
    NbBadgeModule,
    NbTabsetModule,
  ],
  declarations: [
    AccountComponent,
    HealthComponent,
  ],
  exports: [
    AccountComponent,
    HealthComponent,
  ]
})
export class SystemModule { }