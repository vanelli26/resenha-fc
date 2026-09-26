import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IdCard } from '@primeicons/angular/id-card';
import { Link } from '@primeicons/angular/link';
import { UserPlus } from '@primeicons/angular/user-plus';
import { Users } from '@primeicons/angular/users';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Escudo } from '../../shared/escudo';
import { SolicitacoesService } from '../solicitacoes/data/solicitacoes.service';

interface Aba {
  caminho: string;
  rotulo: string;
  icone: 'elenco' | 'membros' | 'convites' | 'solicitacoes';
  selo?: number;
}

@Component({
  selector: 'app-time-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Escudo, Users, IdCard, Link, UserPlus],
  templateUrl: './time-layout.html',
  styleUrl: './time-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeLayout {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly solicitacoes = inject(SolicitacoesService);

  protected readonly time = this.timeAtual.time;
  protected readonly abas = computed<Aba[]>(() => {
    const abas: Aba[] = [{ caminho: 'elenco', rotulo: 'Elenco', icone: 'elenco' }];
    if (this.timeAtual.ehDiretoria()) {
      abas.push(
        { caminho: 'membros', rotulo: 'Membros', icone: 'membros' },
        { caminho: 'convites', rotulo: 'Convites', icone: 'convites' },
        {
          caminho: 'solicitacoes',
          rotulo: 'Solicitações',
          icone: 'solicitacoes',
          selo: this.solicitacoes.qtdPendentes(),
        },
      );
    }
    return abas;
  });

  constructor() {
    // Selo de pendentes: só a gestão pode consultar solicitações (Rules).
    effect(() => {
      const timeId = this.timeAtual.timeId();
      if (timeId && this.timeAtual.ehDiretoria()) {
        this.solicitacoes.contarPendentes(timeId).catch(() => undefined);
      }
    });
    // Ao sair de /t/:timeId, volta ao tema base e limpa o contexto.
    inject(DestroyRef).onDestroy(() => this.timeAtual.sair());
  }
}
