import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta, vinculoDe } from '../../models/atleta.model';
import { AjusteEstatistica, NumerosAtleta } from '../../models/estatistica.model';
import { Avisos } from '../../shared/avisos';
import { ehReferenciaAnual, intervaloDoPeriodo, referenciaAnual } from '../../shared/competencia';
import { FotoPessoa } from '../../shared/foto-pessoa';
import { AtletasService } from '../elenco/data/atletas.service';
import { ElencoAbas } from '../elenco/elenco-abas';
import { NavegadorPeriodo } from '../financeiro/navegador-periodo';
import { AjusteArtilharia, OpcaoAtleta, TotaisAtleta } from './ajuste-artilharia';
import { Automatico, EstatisticasService } from './data/estatisticas.service';

type Metrica = keyof NumerosAtleta;

interface LinhaArtilharia extends NumerosAtleta {
  posicao: number;
  atleta: ComId<Atleta>;
  ajustado: boolean;
}

function nomeDe(a: Atleta): string {
  return a.apelido || a.nome;
}

/** Artilharia e assistências do ano (DIRETRIZES 2.10): automático dos gols + ajuste manual da diretoria. */
@Component({
  selector: 'app-artilharia-page',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    SelectButtonModule,
    SkeletonModule,
    AjusteArtilharia,
    ElencoAbas,
    FotoPessoa,
    NavegadorPeriodo,
  ],
  templateUrl: './artilharia-page.html',
  styleUrl: './artilharia-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtilhariaPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly atletasService = inject(AtletasService);
  private readonly service = inject(EstatisticasService);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);

  /** Ano na URL (?ano=AAAA). */
  readonly ano = input<string>();
  protected readonly escopo = computed(() => {
    const ano = this.ano();
    return ano && ehReferenciaAnual(ano) ? ano : referenciaAnual(new Date());
  });

  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly opcoesMetrica: { label: string; value: Metrica }[] = [
    { label: 'Gols', value: 'gols' },
    { label: 'Assistências', value: 'assistencias' },
  ];
  protected readonly metrica = signal<Metrica>('gols');

  private readonly cadastros = signal<ComId<Atleta>[]>([]);
  protected readonly automatico = signal<Automatico | null>(null);
  private readonly ajustes = signal<ReadonlyMap<string, AjusteEstatistica>>(new Map());
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly dialogAberto = signal(false);
  protected readonly atletaEmAjuste = signal<string | null>(null);

  protected readonly automaticoPorAtleta = computed<ReadonlyMap<string, NumerosAtleta>>(
    () => this.automatico()?.porAtleta ?? new Map(),
  );

  /** Exibido = automático + ajuste (nunca negativo), por atletaId. */
  protected readonly totais = computed<ReadonlyMap<string, NumerosAtleta>>(() => {
    const auto = this.automaticoPorAtleta();
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

  /** Ranking pela métrica escolhida (empate: mesma posição), só quem tem algum número. */
  protected readonly linhas = computed<LinhaArtilharia[]>(() => {
    const m = this.metrica();
    const outra: Metrica = m === 'gols' ? 'assistencias' : 'gols';
    const totais = this.totais();
    const ajustes = this.ajustes();
    const ordenadas = this.cadastros()
      .flatMap((atleta) => {
        const t = totais.get(atleta.id);
        const j = ajustes.get(atleta.id);
        return t && (t.gols > 0 || t.assistencias > 0)
          ? [{ atleta, ...t, ajustado: !!j && (j.gols !== 0 || j.assistencias !== 0), posicao: 0 }]
          : [];
      })
      .filter((l) => l[m] > 0)
      .sort((a, b) => b[m] - a[m] || b[outra] - a[outra] || nomeDe(a.atleta).localeCompare(nomeDe(b.atleta), 'pt-BR'));
    ordenadas.forEach((l, i) => (l.posicao = i > 0 && ordenadas[i - 1][m] === l[m] ? ordenadas[i - 1].posicao : i + 1));
    return ordenadas;
  });

  /** Atletas para lançar números: elenco em atividade + quem já tem números no ano. */
  protected readonly opcoesAtleta = computed<OpcaoAtleta[]>(() => {
    const totais = this.totais();
    return this.cadastros()
      .filter((a) => (vinculoDe(a) === 'atleta' && a.status !== 'inativo') || totais.has(a.id))
      .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'))
      .map((a) => ({ value: a.id, label: nomeDe(a) }));
  });

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const escopo = this.escopo();
      untracked(() => {
        this.automatico.set(null);
        this.ajustes.set(new Map());
        this.dialogAberto.set(false);
        if (timeId) void this.carregar(timeId, escopo);
      });
    });
  }

  protected irParaAno(ano: string): void {
    void this.router.navigate([], { queryParams: { ano }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected abrirAjuste(atletaId: string | null): void {
    if (!this.ehDiretoria()) return;
    this.atletaEmAjuste.set(atletaId);
    this.dialogAberto.set(true);
  }

  protected async salvarAjuste(totais: TotaisAtleta): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const uid = this.auth.usuario()?.uid;
    if (!timeId || !uid) return;
    const escopo = this.escopo();
    const auto = this.automaticoPorAtleta().get(totais.atletaId);
    const ajuste = {
      gols: totais.gols - (auto?.gols ?? 0),
      assistencias: totais.assistencias - (auto?.assistencias ?? 0),
    };
    const ok = await this.avisos.executar(
      this.salvando,
      () => this.service.salvarAjuste(timeId, escopo, totais.atletaId, ajuste, uid),
      'Números atualizados',
      'Não foi possível salvar',
    );
    if (!ok) return;
    this.dialogAberto.set(false);
    await this.carregarAjustes(timeId, escopo);
  }

  private async carregar(timeId: string, escopo: string): Promise<void> {
    this.carregando.set(true);
    try {
      const { inicio, fim } = intervaloDoPeriodo(escopo);
      const [cadastros, automatico] = await Promise.all([
        this.atletasService.listar(timeId),
        this.service.automatico(timeId, inicio, fim),
        this.carregarAjustes(timeId, escopo),
      ]);
      if (!this.ehAtual(timeId, escopo)) return;
      this.cadastros.set(cadastros);
      this.automatico.set(automatico);
    } catch (e) {
      this.avisos.erro('Erro ao carregar a artilharia', e);
    } finally {
      this.carregando.set(false);
    }
  }

  private async carregarAjustes(timeId: string, escopo: string): Promise<void> {
    const lista = await this.service.listarAjustes(timeId, escopo);
    if (this.ehAtual(timeId, escopo)) this.ajustes.set(new Map(lista.map((a) => [a.atletaId, a])));
  }

  /** Descarta resposta atrasada (outro time ou outro ano). */
  private ehAtual(timeId: string, escopo: string): boolean {
    return this.timeAtual.timeId() === timeId && this.escopo() === escopo;
  }
}
