import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { EllipsisV } from '@primeicons/angular/ellipsis-v';
import { Thumbtack } from '@primeicons/angular/thumbtack';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { ComId } from '../../core/firebase/conversor';
import { Recado } from '../../models/recado.model';
import { FotoPessoa } from '../../shared/foto-pessoa';

/** Proporção do carrossel: a da 1ª foto, entre quadrada (1:1) e paisagem (1.91:1); retrato é cortado no centro. */
function proporcao(largura: number, altura: number): number {
  return Math.min(1.91, Math.max(1, largura / altura));
}

/** Postagem no feed: autor, fotos (carrossel com rolagem lateral) e legenda. */
@Component({
  selector: 'app-post-card',
  imports: [DatePipe, ButtonModule, MenuModule, EllipsisV, Thumbtack, FotoPessoa],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCard {
  readonly recado = input.required<ComId<Recado>>();
  /** Autor: edita a legenda e exclui. */
  readonly ehAutor = input(false);
  /** Diretoria: fixa e exclui qualquer post. */
  readonly podeModerar = input(false);
  readonly editar = output<void>();
  readonly excluir = output<void>();
  readonly fixar = output<boolean>();

  protected readonly fotoAtual = signal(0);
  protected readonly fotos = computed(() => this.recado().fotos ?? []);
  protected readonly proporcao = computed(() => {
    const primeira = this.fotos()[0];
    return primeira ? proporcao(primeira.largura, primeira.altura) : 1;
  });

  protected readonly menu = computed<MenuItem[]>(() => {
    const itens: MenuItem[] = [];
    if (this.ehAutor()) itens.push({ label: 'Editar legenda', command: () => this.editar.emit() });
    if (this.podeModerar()) {
      const fixado = this.recado().fixado;
      itens.push({ label: fixado ? 'Soltar do topo' : 'Fixar no topo', command: () => this.fixar.emit(!fixado) });
    }
    if (this.ehAutor() || this.podeModerar()) itens.push({ label: 'Excluir', command: () => this.excluir.emit() });
    return itens;
  });

  /** Índice da foto visível a partir da rolagem do carrossel. */
  protected aoRolar(evento: Event): void {
    const faixa = evento.target;
    if (!(faixa instanceof HTMLElement) || faixa.clientWidth === 0) return;
    this.fotoAtual.set(Math.round(faixa.scrollLeft / faixa.clientWidth));
  }
}
