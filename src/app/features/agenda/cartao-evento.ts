import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Evento, RespostaPresenca } from '../../models/evento.model';
import { ROTULO_TIPO_EVENTO } from '../../shared/rotulos';
import { SeletorPresenca } from './seletor-presenca';

/** Evento na lista da agenda: data em destaque, dados e, se couber, a resposta de presença. */
@Component({
  selector: 'app-cartao-evento',
  imports: [DatePipe, RouterLink, TagModule, SeletorPresenca],
  templateUrl: './cartao-evento.html',
  styleUrl: './cartao-evento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartaoEvento {
  private readonly timeAtual = inject(TimeAtualService);

  readonly evento = input.required<ComId<Evento>>();
  /** Rótulo do esporte, só quando o time pratica mais de um. */
  readonly esporte = input<string | null>(null);
  readonly podeResponder = input(false);
  readonly resposta = input<RespostaPresenca | null>(null);
  /** Resposta sendo gravada neste evento (carregando no botão). */
  readonly enviando = input<RespostaPresenca | null>(null);
  readonly responder = output<RespostaPresenca>();

  protected readonly rotuloTipo = ROTULO_TIPO_EVENTO;
  /** Link absoluto: o cartão aparece na agenda e na tela do campeonato. */
  protected readonly link = computed(() => ['/t', this.timeAtual.timeId(), 'agenda', this.evento().id]);
}
