import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { MenuComponent } from './menu/menu';

@Component({
  selector: 'app-root',
  imports: [MenuComponent, MatToolbarModule, MatIconModule, MatButtonModule, RouterOutlet],
   template: `
      <app-menu #menu>
      <mat-toolbar color="primary">
        <button mat-icon-button aria-label="Open menu" (click)="menu.toggle()">
          <mat-icon>menu</mat-icon>
        </button>
        <span style="margin-left:8px">Place</span>
      </mat-toolbar>
      <router-outlet></router-outlet>
    </app-menu>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss'
})
export class App {

}
