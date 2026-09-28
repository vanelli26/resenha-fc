import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BarraAtividade } from './core/layout/barra-atividade';
import { ModoTemaService } from './core/theme/modo-tema.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BarraAtividade],
  template: '<app-barra-atividade /><router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    // Instancia cedo para aplicar a classe de modo escuro/claro antes da primeira tela.
    inject(ModoTemaService);
  }
}
