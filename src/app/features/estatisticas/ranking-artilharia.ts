import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ComId } from '../../core/firebase/conversor';
import { Atleta, vinculoDe } from '../../models/atleta.model';
import { NumerosAtleta } from '../../models/estatistica.model';
import { FotoPessoa } from '../../shared/foto-pessoa';
import { AjusteArtilharia, OpcaoAtleta, TotaisAtleta } from './ajuste-artilharia';

type Metrica = keyof NumerosAtleta;

interface LinhaArtilharia extends NumerosAtleta {
  posicao: number;
  atleta: ComId<Atleta>;
  ajustado: boolean;
}

function nomeDe(a: Atleta): string {
  return a.apelido || a.nome;
}

/**
 * Ranking de gols ou assistências (DIRETRIZES 2.10): exibido = automático + ajuste, nunca negativo.
 * Com `podeEditar`, tocar num atleta (ou "Lançar números") abre o ajuste; quem usa grava e fecha `editando`.
 */
@Component({
  selector: 'app-ranking-artilharia',
  imports: [FormsModule, ButtonModule, DialogModule, SelectButtonModule, AjusteArtilharia, FotoPessoa],
  templateUrl: './ranking-artilharia.html',
  styleUrl: './ranking-artilharia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingArtilharia {
  readonly cadastros = input.required<ComId<Atleta>[]>();
  readonly automatico = input.required<ReadonlyMap<string, NumerosAtleta>>();
  readonly ajustes = input.required<ReadonlyMap<string, NumerosAtleta>>();
  readonly podeEditar = input(false);
  readonly salvando = input(false);
  /** Ex.: "no ano", "no campeonato". */
  readonly escopo = input.required<string>();
  /** Diálogo de ajuste aberto (quem usa fecha após gravar). */
  readonly editando = model(false);
  readonly ajustar = output<TotaisAtleta>();

  protected readonly opcoesMetrica: { label: string; value: Metrica }[] = [
    { label: 'Gols', value: 'gols' },
    { label: 'Assistências', value: 'assistencias' },
  ];
  protected readonly metrica = signal<Metrica>('gols');
  protected readonly atletaEmAjuste = signal<string | null>(null);

  protected readonly totais = computed<ReadonlyMap<string, NumerosAtleta>>(() => {
    const auto = this.automatico();
    const ajustes = this.ajustes();
    const ids = new Set([...auto.keys(), ...ajustes.keys()]);
    return new Map(
      [...ids].map((id) => {
        const a = auto.get(id);
        const j = ajustes.get(id);
        return [
          id,
          {
            gols: Math.max(0, (a?.gols ?? 0) + (j?.gols ?? 0)),
            assistencias: Math.max(0, (a?.assistencias ?? 0) + (j?.assistencias ?? 0)),
          },
        ];
      }),
    );
  });

  /** Ordenado pela métrica escolhida (empate: mesma posição); só quem tem número nela. */
  protected readonly linhas = computed<LinhaArtilharia[]>(() => {
    const m = this.metrica();
    const outra: Metrica = m === 'gols' ? 'assistencias' : 'gols';
    const totais = this.totais();
    const ajustes = this.ajustes();
    const ordenadas = this.cadastros()
      .flatMap((atleta) => {
        const t = totais.get(atleta.id);
        const j = ajustes.get(atleta.id);
        return t && t[m] > 0
          ? [{ atleta, ...t, ajustado: !!j && (j.gols !== 0 || j.assistencias !== 0), posicao: 0 }]
          : [];
      })
      .sort((a, b) => b[m] - a[m] || b[outra] - a[outra] || nomeDe(a.atleta).localeCompare(nomeDe(b.atleta), 'pt-BR'));
    ordenadas.forEach((l, i) => (l.posicao = i > 0 && ordenadas[i - 1][m] === l[m] ? ordenadas[i - 1].posicao : i + 1));
    return ordenadas;
  });

  /** Para lançar números: elenco em atividade + quem já tem números no escopo. */
  protected readonly opcoesAtleta = computed<OpcaoAtleta[]>(() => {
    const totais = this.totais();
    return this.cadastros()
      .filter((a) => (vinculoDe(a) === 'atleta' && a.status !== 'inativo') || totais.has(a.id))
      .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'))
      .map((a) => ({ value: a.id, label: nomeDe(a) }));
  });

  protected abrir(atletaId: string | null): void {
    if (!this.podeEditar()) return;
    this.atletaEmAjuste.set(atletaId);
    this.editando.set(true);
  }
}
