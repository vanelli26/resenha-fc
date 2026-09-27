import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { IdCard } from '@primeicons/angular/id-card';
import { Link } from '@primeicons/angular/link';
import { SlidersH } from '@primeicons/angular/sliders-h';
import { UserPlus } from '@primeicons/angular/user-plus';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { SolicitacoesService } from '../solicitacoes/data/solicitacoes.service';

interface Item {
  caminho: string;
  titulo: string;
  descricao: string;
  icone: 'membros' | 'convites' | 'solicitacoes' | 'financeiro';
  selo?: number;
}

/** Entrada das telas de administração do time; cada item aparece conforme o papel. */
@Component({
  selector: 'app-gestao-page',
  imports: [RouterLink, ChevronRight, IdCard, Link, SlidersH, UserPlus],
  templateUrl: './gestao-page.html',
  styleUrl: './gestao-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestaoPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly solicitacoes = inject(SolicitacoesService);

  protected readonly itens = computed<Item[]>(() => {
    const itens: Item[] = [];
    if (this.timeAtual.ehDiretoria()) {
      itens.push(
        { caminho: 'membros', titulo: 'Membros', descricao: 'Papéis e vínculo com o elenco', icone: 'membros' },
        { caminho: 'convites', titulo: 'Convites', descricao: 'Links para entrar no time', icone: 'convites' },
        {
          caminho: 'solicitacoes',
          titulo: 'Solicitações',
          descricao: 'Pedidos de entrada para aprovar',
          icone: 'solicitacoes',
          selo: this.solicitacoes.qtdPendentes(),
        },
      );
    }
    if (this.timeAtual.ehTesouraria()) {
      itens.push({
        caminho: 'financeiro',
        titulo: 'Configuração financeira',
        descricao: 'Modalidades, valores e vencimentos',
        icone: 'financeiro',
      });
    }
    return itens;
  });
}
