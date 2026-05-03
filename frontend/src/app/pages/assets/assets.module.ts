import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule,
  NbIconModule,
  NbBadgeModule,
  NbButtonModule,
  NbInputModule,
  NbSelectModule,
  NbTooltipModule,
} from '@nebular/theme';

import { ThemeModule } from '../../@theme/theme.module';
import { AssetsComponent } from './assets.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NbCardModule,
    NbIconModule,
    NbBadgeModule,
    NbButtonModule,
    NbInputModule,
    NbSelectModule,
    NbTooltipModule,
    ThemeModule,
  ],
  declarations: [
    AssetsComponent,
  ],
})
export class AssetsModule { }
