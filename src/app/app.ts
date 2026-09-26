import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModoTemaService } from './core/theme/modo-tema.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    // Instancia cedo para aplicar a classe de modo escuro/claro antes da primeira tela.
    inject(ModoTemaService);
  }
}
