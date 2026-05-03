import { NgModule } from '@angular/core';
import { 
  NbCardModule, 
  NbButtonModule, 
  NbIconModule, 
  NbSelectModule, 
  NbBadgeModule 
} from '@nebular/theme';

import { ThemeModule } from '../../@theme/theme.module';
import { GeneralRoutingModule } from './general-routing.module';
import { GeneralComponent } from './general.component';
import { AccountComponent } from './account/account.component';

@NgModule({
  imports: [
    ThemeModule,
    GeneralRoutingModule,
    NbCardModule,
    NbButtonModule,
    NbIconModule,
    NbSelectModule,
    NbBadgeModule,
  ],
  declarations: [
    GeneralComponent,
    AccountComponent,
  ],
})
export class GeneralModule { }