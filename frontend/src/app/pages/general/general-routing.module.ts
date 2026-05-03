import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';

import { GeneralComponent } from './general.component';
import { AccountComponent } from './account/account.component';

const routes: Routes = [{
  path: '',
  component: GeneralComponent,
  children: [
    {
      path: 'account',
      component: AccountComponent,
    },
    {
      path: '',
      redirectTo: 'account',
      pathMatch: 'full',
    },
  ],
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GeneralRoutingModule {
}