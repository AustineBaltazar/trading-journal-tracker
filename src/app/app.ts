import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TradesList } from './trades-list/trades-list';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('trading-journal-frontend');
}
