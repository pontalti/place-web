import { Component, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatCardModule],
  template: `
      <span class="mat-title-medium title"><h1> {{ title() }} </h1></span>
  `,
  styles: [`
    .title {
      text-align: center;
    }
  `]
})
export class Home {
  protected readonly title = signal('Welcome to Place Web, powered by Angular.');
}
