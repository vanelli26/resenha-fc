import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { Flag } from '@primeicons/angular/flag';
import { Palette } from '@primeicons/angular/palette';
import { Star } from '@primeicons/angular/star';
import { IdCard } from '@primeicons/angular/id-card';
import { Link } from '@primeicons/angular/link';
import { SlidersH } from '@primeicons/angular/sliders-h';
import { UserPlus } from '@primeicons/angular/user-plus';
import { Users } from '@primeicons/angular/users';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { SolicitacoesService } from '../solicitacoes/data/solicitacoes.service';

interface Item {
  caminho: string;
  titulo: string;
  descricao: string;
  icone: 'time' | 'membros' | 'convites' | 'solicitacoes' | 'socios' | 'apoiadores' | 'esportes' | 'financeiro';
  selo?: number;
}

/** Entrada das telas de administração do time; cada item aparece conforme o papel. */
@Component({
  selector: 'app-gestao-page',
  imports: [RouterLink, ChevronRight, Flag, Palette, Star, IdCard, Link, SlidersH, UserPlus, Users],
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
        { caminho: 'time', titulo: 'Dados do time', descricao: 'Nome, escudo e cor', icone: 'time' },
        { caminho: 'membros', titulo: 'Membros', descricao: 'Papéis e vínculo com o elenco', icone: 'membros' },
        { caminho: 'convites', titulo: 'Convites', descricao: 'Links para entrar no time', icone: 'convites' },
        {
          caminho: 'solicitacoes',
          titulo: 'Solicitações',
          descricao: 'Pedidos de entrada para aprovar',
          icone: 'solicitacoes',
          selo: this.solicitacoes.qtdPendentes(),
        },
        { caminho: 'socios', titulo: 'Sócios e colaboradores', descricao: 'Quem apoia o time sem jogar', icone: 'socios' },
        { caminho: 'apoiadores', titulo: 'Apoiadores', descricao: 'Patrocinadores na faixa do mural', icone: 'apoiadores' },
        { caminho: 'esportes', titulo: 'Esportes', descricao: 'Campo, society, futsal e posições', icone: 'esportes' },
      );
    }
    if (this.timeAtual.ehTesouraria()) {
      itens.push({
        caminho: 'financeiro',
        titulo: 'Configuração financeira',
        descricao: 'Planos de cobrança, vencimentos e despesas fixas',
        icone: 'financeiro',
      });
    }
    return itens;
  });
}
