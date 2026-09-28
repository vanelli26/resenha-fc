import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import { NumerosAtleta } from '../../models/estatistica.model';
import { Avisos } from '../../shared/avisos';
import { ehReferenciaAnual, intervaloDoPeriodo, referenciaAnual } from '../../shared/competencia';
import { AtletasService } from '../elenco/data/atletas.service';
import { ElencoAbas } from '../elenco/elenco-abas';
import { NavegadorPeriodo } from '../financeiro/navegador-periodo';
import { TotaisAtleta } from './ajuste-artilharia';
import { Automatico, EstatisticasService } from './data/estatisticas.service';
import { RankingArtilharia } from './ranking-artilharia';

/** Artilharia e assistências do ano (DIRETRIZES 2.10): automático dos gols + ajuste manual da diretoria. */
@Component({
  selector: 'app-artilharia-page',
  imports: [SkeletonModule, ElencoAbas, NavegadorPeriodo, RankingArtilharia],
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
  protected readonly cadastros = signal<ComId<Atleta>[]>([]);
  protected readonly automatico = signal<Automatico | null>(null);
  protected readonly automaticoPorAtleta = computed<ReadonlyMap<string, NumerosAtleta>>(
    () => this.automatico()?.porAtleta ?? new Map(),
  );
  protected readonly ajustes = signal<ReadonlyMap<string, NumerosAtleta>>(new Map());
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly editando = signal(false);

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const escopo = this.escopo();
      untracked(() => {
        this.automatico.set(null);
        this.ajustes.set(new Map());
        this.editando.set(false);
        if (timeId) void this.carregar(timeId, escopo);
      });
    });
  }

  protected irParaAno(ano: string): void {
    void this.router.navigate([], { queryParams: { ano }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected async salvarAjuste(totais: TotaisAtleta): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const uid = this.auth.usuario()?.uid;
    if (!timeId || !uid) return;
    const escopo = this.escopo();
    const { atletaId, ...numeros } = totais;
    const ok = await this.avisos.executar(
      this.salvando,
      () =>
        this.service.salvarTotais(timeId, escopo, atletaId, numeros, this.automaticoPorAtleta().get(atletaId), uid),
      'Números atualizados',
      'Não foi possível salvar',
    );
    if (!ok) return;
    this.editando.set(false);
    const ajustes = await this.service.ajustesPorAtleta(timeId, escopo);
    if (this.ehAtual(timeId, escopo)) this.ajustes.set(ajustes);
  }

  private async carregar(timeId: string, escopo: string): Promise<void> {
    this.carregando.set(true);
    try {
      const { inicio, fim } = intervaloDoPeriodo(escopo);
      const [cadastros, automatico, ajustes] = await Promise.all([
        this.atletasService.listar(timeId),
        this.service.automaticoDoPeriodo(timeId, inicio, fim),
        this.service.ajustesPorAtleta(timeId, escopo),
      ]);
      if (!this.ehAtual(timeId, escopo)) return;
      this.cadastros.set(cadastros);
      this.automatico.set(automatico);
      this.ajustes.set(ajustes);
    } catch (e) {
      this.avisos.erro('Erro ao carregar a artilharia', e);
    } finally {
      this.carregando.set(false);
    }
  }

  /** Descarta resposta atrasada (outro time ou outro ano). */
  private ehAtual(timeId: string, escopo: string): boolean {
    return this.timeAtual.timeId() === timeId && this.escopo() === escopo;
  }
}
