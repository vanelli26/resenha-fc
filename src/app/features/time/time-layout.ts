import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Briefcase } from '@primeicons/angular/briefcase';
import { Users } from '@primeicons/angular/users';
import { Wallet } from '@primeicons/angular/wallet';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Escudo } from '../../shared/escudo';
import { SolicitacoesService } from '../solicitacoes/data/solicitacoes.service';

interface Aba {
  caminho: string;
  rotulo: string;
  icone: 'elenco' | 'financeiro' | 'gestao';
  selo?: number;
}

@Component({
  selector: 'app-time-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Escudo, Users, Wallet, Briefcase],
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
    if (this.timeAtual.ehGestao()) {
      abas.push(
        { caminho: 'financeiro', rotulo: 'Financeiro', icone: 'financeiro' },
        {
          caminho: 'gestao',
          rotulo: 'Gestão',
          icone: 'gestao',
          selo: this.timeAtual.ehDiretoria() ? this.solicitacoes.qtdPendentes() : 0,
        },
      );
    } else if (this.timeAtual.acesso()?.atletaId) {
      // Jogador: só as próprias cobranças (nunca o caixa).
      abas.push({ caminho: 'financeiro/minhas', rotulo: 'Financeiro', icone: 'financeiro' });
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
