import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Evento } from '../../models/evento.model';
import { mensagemDeErro } from '../../shared/erros';
import { EventosService } from '../agenda/data/eventos.service';

/** Atalho da tesouraria: últimos eventos encerrados; a cobrança dos avulsos é gerada no próprio evento. */
@Component({
  selector: 'app-jogos-para-cobrar',
  imports: [DatePipe, RouterLink, ChevronRight],
  templateUrl: './jogos-para-cobrar.html',
  styleUrl: './jogos-para-cobrar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JogosParaCobrar {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly eventosService = inject(EventosService);

  protected readonly timeId = this.timeAtual.timeId;
  protected readonly eventos = signal<ComId<Evento>[] | null>(null);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.eventos.set(null);
        if (timeId) void this.carregar(timeId);
      });
    });
  }

  private async carregar(timeId: string): Promise<void> {
    try {
      const eventos = await this.eventosService.listarRealizados(timeId);
      if (this.timeAtual.timeId() === timeId) this.eventos.set(eventos);
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    }
  }
}
