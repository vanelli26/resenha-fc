import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import {
  referenciaMensal,
  referenciaSemestral,
  referenciasMensais,
  referenciasSemestrais,
  rotuloReferencia,
  vencimentoMensal,
  vencimentoSemestral,
} from '../../shared/competencia';
import { ReaisPipe } from '../../shared/dinheiro';
import { mensagemDeErro } from '../../shared/erros';
import { Voltar } from '../../shared/voltar';
import { AtletasService } from '../elenco/data/atletas.service';
import { CobrancasService, NovaCobranca } from './data/cobrancas.service';

/** Geração manual pela tesouraria. Avulso sai dos jogos (Fase 3). */
type TipoGeracao = 'mensal' | 'semestral';

const ROTULO_GERACAO: Record<TipoGeracao, string> = { mensal: 'Mensalidade', semestral: 'Semestralidade' };

interface Candidato {
  atleta: ComId<Atleta>;
  jaGerada: boolean;
}

@Component({
  selector: 'app-gerar-cobrancas-page',
  imports: [DatePipe, FormsModule, RouterLink, ButtonModule, CheckboxModule, SelectModule, SkeletonModule, ReaisPipe, Voltar],
  templateUrl: './gerar-cobrancas-page.html',
  styleUrl: './gerar-cobrancas-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GerarCobrancasPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly atletasService = inject(AtletasService);
  private readonly cobrancasService = inject(CobrancasService);
  private readonly mensagens = inject(MessageService);
  private readonly router = inject(Router);

  protected readonly timeId = this.timeAtual.timeId;

  protected readonly opcoesTipo = computed(() =>
    this.timeAtual
      .modalidadesHabilitadas()
      .filter((m): m is TipoGeracao => m === 'mensal' || m === 'semestral')
      .map((value) => ({ value, label: ROTULO_GERACAO[value] })),
  );
  protected readonly tipo = linkedSignal<TipoGeracao | null>(() => this.opcoesTipo()[0]?.value ?? null);

  protected readonly opcoesReferencia = computed(() => {
    const hoje = new Date();
    const refs = this.tipo() === 'semestral' ? referenciasSemestrais(hoje) : referenciasMensais(hoje);
    return refs.map((value) => ({ value, label: rotuloReferencia(value) }));
  });
  protected readonly referencia = linkedSignal(() =>
    this.tipo() === 'semestral' ? referenciaSemestral(new Date()) : referenciaMensal(new Date()),
  );

  /** Valor e vencimento vêm da configuração do time no momento da geração (DIRETRIZES 2.5). */
  protected readonly condicoes = computed(() => {
    const financeiro = this.timeAtual.time()?.financeiro;
    const tipo = this.tipo();
    const referencia = this.referencia();
    if (!financeiro || !tipo) return null;
    if (tipo === 'mensal') {
      return {
        valorCentavos: financeiro.mensal.valorCentavos,
        vencimento: vencimentoMensal(referencia, financeiro.mensal.diaVencimento),
      };
    }
    const s = financeiro.semestral;
    return {
      valorCentavos: s.valorCentavos,
      vencimento: vencimentoSemestral(referencia, s.diaVencimento, s.mesVencimentoS1, s.mesVencimentoS2),
    };
  });

  private readonly atletas = signal<ComId<Atleta>[]>([]);
  private readonly existentes = signal<ReadonlySet<string>>(new Set());
  protected readonly carregando = signal(true);
  protected readonly gerando = signal(false);

  protected readonly candidatos = computed<Candidato[]>(() => {
    const tipo = this.tipo();
    const existentes = this.existentes();
    return this.atletas()
      .filter((a) => a.status === 'ativo' && a.modalidade === tipo)
      .map((atleta) => ({ atleta, jaGerada: existentes.has(atleta.id) }));
  });

  /** Marcados por padrão: todos que ainda não têm cobrança nesta competência. */
  protected readonly selecionados = linkedSignal<ReadonlySet<string>>(
    () => new Set(this.candidatos().filter((c) => !c.jaGerada).map((c) => c.atleta.id)),
  );
  protected readonly total = computed(() => this.selecionados().size * (this.condicoes()?.valorCentavos ?? 0));

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        if (timeId) void this.carregarAtletas(timeId);
      });
    });
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const referencia = this.referencia();
      untracked(() => {
        if (timeId) void this.carregarExistentes(timeId, referencia);
      });
    });
  }

  protected alternar(atletaId: string, marcado: boolean): void {
    this.selecionados.update((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(atletaId);
      else novo.delete(atletaId);
      return novo;
    });
  }

  protected async gerar(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const tipo = this.tipo();
    const condicoes = this.condicoes();
    const referencia = this.referencia();
    if (!timeId || !tipo || !condicoes) return;
    const selecionados = this.selecionados();
    const novas: NovaCobranca[] = this.candidatos()
      .filter((c) => !c.jaGerada && selecionados.has(c.atleta.id))
      .map((c) => ({
        atletaId: c.atleta.id,
        atletaNome: c.atleta.nome,
        tipo,
        referencia,
        valorCentavos: condicoes.valorCentavos,
        vencimento: condicoes.vencimento,
      }));
    if (novas.length === 0) return;

    this.gerando.set(true);
    try {
      await this.cobrancasService.gerar(timeId, novas);
      this.mensagens.add({ severity: 'success', summary: `${novas.length} cobrança(s) gerada(s)` });
      await this.router.navigate(['/t', timeId, 'financeiro', 'cobrancas'], { queryParams: { ref: referencia } });
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível gerar', detail: mensagemDeErro(e) });
      await this.carregarExistentes(timeId, referencia);
    } finally {
      this.gerando.set(false);
    }
  }

  private async carregarAtletas(timeId: string): Promise<void> {
    try {
      const dados = await this.atletasService.listar(timeId);
      if (this.timeAtual.timeId() === timeId) this.atletas.set(dados);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar o elenco', detail: mensagemDeErro(e) });
    }
  }

  private async carregarExistentes(timeId: string, referencia: string): Promise<void> {
    this.carregando.set(true);
    try {
      const dados = await this.cobrancasService.listarPorReferencia(timeId, referencia);
      if (this.timeAtual.timeId() === timeId && this.referencia() === referencia) {
        this.existentes.set(new Set(dados.map((c) => c.atletaId)));
      }
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar cobranças', detail: mensagemDeErro(e) });
    } finally {
      this.carregando.set(false);
    }
  }
}
