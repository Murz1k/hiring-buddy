import { NgModule } from '@angular/core';

import { WelcomeRoutingModule } from './welcome-routing.module';

import { WelcomeComponent } from './welcome.component';
import { NzButtonModule, NzInputModule, NzTableModule } from 'ng-zorro-antd';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';


@NgModule({
  imports: [WelcomeRoutingModule, NzInputModule, NzButtonModule, FormsModule, NzTableModule, CommonModule],
  declarations: [WelcomeComponent],
  exports: [WelcomeComponent]
})
export class WelcomeModule { }
