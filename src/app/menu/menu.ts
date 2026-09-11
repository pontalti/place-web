import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    RouterLink,
    RouterLinkActive
  ],
  template: `
    <mat-sidenav-container class="menu-shell">
      <mat-sidenav #sidenav mode="over" class="menu-sidenav">
        <mat-nav-list>

          <a mat-list-item routerLink="/" routerLinkActive="active" (click)="close()">
            <mat-icon aria-hidden="true">home</mat-icon>
            <span>Home</span>
          </a>

          <a mat-list-item routerLink="/place/new" routerLinkActive="active" (click)="closeIfOver()">
            <mat-icon aria-hidden="true">add</mat-icon>
            <span>New place</span>
          </a>

          <a mat-list-item routerLink="/place/list" routerLinkActive="active" (click)="closeIfOver()">
            <mat-icon aria-hidden="true">list</mat-icon>
            <span>Place list</span>
          </a>

        </mat-nav-list>
      </mat-sidenav>

      <!-- Parent content -->
      <mat-sidenav-content>
        <ng-content></ng-content>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .menu-shell { height: 100vh; }
    .menu-sidenav { width: 280px; }
    a.mat-mdc-list-item .mat-icon { margin-right: 8px; }
    .active { font-weight: 600; }
  `]
})
export class MenuComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  open() : void{ void this.sidenav.open(); }
  close() : void { void this.sidenav.close(); }
  toggle() : void { void this.sidenav.toggle(); }
  closeIfOver() : void {
    if(this.sidenav.mode === 'over') {
      void this.sidenav.close();
    }
  }
}
