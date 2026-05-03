import { NgModule } from '@angular/core';
import { NbMenuModule, NbIconModule, NbCardModule, NbTabsetModule, NbButtonModule, NbBadgeModule, NbSelectModule, NbProgressBarModule, NbListModule, NbAlertModule, NbInputModule, NbCheckboxModule, NbTooltipModule, NbToggleModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';

import { ThemeModule } from '../@theme/theme.module';
import { PagesComponent } from './pages.component';
import { DashboardModule } from './dashboard/dashboard.module';
import { AssetsModule } from './assets/assets.module';
import { SystemComponent } from './system/system.component';
import { PagesRoutingModule } from './pages-routing.module';

@NgModule({
  imports: [
    PagesRoutingModule,
    ThemeModule,
    NbMenuModule,
    NbIconModule,
    NbCardModule,
    NbTabsetModule,
    NbButtonModule,
    NbBadgeModule,
    NbSelectModule,
    NbProgressBarModule,
    NbListModule,
    NbAlertModule,
    NbInputModule,
    NbCheckboxModule,
    NbTooltipModule,
    NbToggleModule,
    FormsModule,
    DashboardModule,
    AssetsModule,
  ],
  declarations: [
    PagesComponent,
    SystemComponent,
  ],
})
export class PagesModule {
}
