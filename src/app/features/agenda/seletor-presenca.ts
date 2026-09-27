import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Check } from '@primeicons/angular/check';
import { Question } from '@primeicons/angular/question';
import { Times } from '@primeicons/angular/times';
import { ButtonModule } from 'primeng/button';
import { RespostaPresenca } from '../../models/evento.model';
import { ROTULO_RESPOSTA } from '../../shared/rotulos';

interface OpcaoPresenca {
  valor: RespostaPresenca;
  rotulo: string;
  cor: 'success' | 'warn' | 'danger';
}

/** Vou · Talvez · Não vou, com cor e ícone. A resposta atual fica preenchida; as outras, só contorno. */
@Component({
  selector: 'app-seletor-presenca',
  imports: [ButtonModule, Check, Question, Times],
  template: `
    <div class="seletor" role="group" aria-label="Sua presença">
      @for (o of opcoes; track o.valor) {
        @let marcada = resposta() === o.valor;
        <p-button
          [severity]="o.cor"
          [outlined]="!marcada"
          [fluid]="true"
          [disabled]="desabilitado()"
          [ariaLabel]="marcada ? o.rotulo + ' (sua resposta)' : o.rotulo"
          (onClick)="marcada || responder.emit(o.valor)"
        >
          @switch (o.valor) {
            @case ('vou') {
              <svg data-p-icon="check" [size]="16" aria-hidden="true"></svg>
            }
            @case ('talvez') {
              <svg data-p-icon="question" [size]="16" aria-hidden="true"></svg>
            }
            @case ('nao_vou') {
              <svg data-p-icon="times" [size]="16" aria-hidden="true"></svg>
            }
          }
          <span>{{ o.rotulo }}</span>
        </p-button>
      }
    </div>
  `,
  styles: `
    .seletor {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
      min-width: min(100%, 20rem);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorPresenca {
  readonly resposta = input<RespostaPresenca | null>(null);
  readonly desabilitado = input(false);
  readonly responder = output<RespostaPresenca>();

  protected readonly opcoes: OpcaoPresenca[] = [
    { valor: 'vou', rotulo: ROTULO_RESPOSTA.vou, cor: 'success' },
    { valor: 'talvez', rotulo: ROTULO_RESPOSTA.talvez, cor: 'warn' },
    { valor: 'nao_vou', rotulo: ROTULO_RESPOSTA.nao_vou, cor: 'danger' },
  ];
}
