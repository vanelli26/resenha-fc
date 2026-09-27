import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { RESPOSTAS_PRESENCA, RespostaPresenca } from '../../models/evento.model';
import { ROTULO_RESPOSTA, opcoes } from '../../shared/rotulos';

/** Vou · Talvez · Não vou. A resposta atual fica marcada; tocar em outra troca. */
@Component({
  selector: 'app-seletor-presenca',
  imports: [FormsModule, SelectButtonModule],
  template: `
    <p-selectbutton
      [options]="opcoes"
      optionLabel="label"
      optionValue="value"
      [allowEmpty]="false"
      [ngModel]="resposta()"
      (ngModelChange)="responder.emit($event)"
      [disabled]="desabilitado()"
      size="small"
      ariaLabel="Sua presença"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorPresenca {
  readonly resposta = input<RespostaPresenca | null>(null);
  readonly desabilitado = input(false);
  readonly responder = output<RespostaPresenca>();

  protected readonly opcoes = opcoes(RESPOSTAS_PRESENCA, ROTULO_RESPOSTA);
}
