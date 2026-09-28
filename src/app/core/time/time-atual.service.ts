import { Injectable, computed, inject, signal } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { Acesso } from '../../models/acesso.model';
import { ISENTO, Periodicidade } from '../../models/modalidade.model';
import { PapelTime } from '../../models/papel.model';
import { ESPORTES, ESPORTES_PADRAO, Esporte } from '../../models/posicao.model';
import { ConfigFinanceira, Time, TimeGravado, normalizarFinanceiro } from '../../models/time.model';
import { Opcao, ROTULO_TIPO_COBRANCA } from '../../shared/rotulos';
import { AuthService } from '../auth/auth.service';
import { ComId, conversor } from '../firebase/conversor';
import { FIRESTORE } from '../firebase/firestore.token';
import { aplicarTemaDoTime } from '../theme/app-theme';

/** Contexto do time selecionado (URL /t/:timeId). Autorização aqui é UX; a segurança está nas Rules. */
@Injectable({ providedIn: 'root' })
export class TimeAtualService {
  private readonly firestore = inject(FIRESTORE);
  private readonly auth = inject(AuthService);

  private readonly _time = signal<ComId<Time> | null>(null);
  private readonly _acesso = signal<Acesso | null>(null);

  readonly time = this._time.asReadonly();
  readonly acesso = this._acesso.asReadonly();
  readonly timeId = computed(() => this._time()?.id ?? null);
  readonly papeis = computed<PapelTime[]>(() => this._acesso()?.papeis ?? []);
  readonly ehDiretoria = computed(() => this.papeis().includes('diretoria'));
  readonly ehTesouraria = computed(() => this.papeis().includes('tesouraria'));
  /** Diretoria ou tesouraria: veem caixa e cobranças (DIRETRIZES 2.3). */
  readonly ehGestao = computed(() => this.ehDiretoria() || this.ehTesouraria());

  /** Planos de cobrança do time (DIRETRIZES 2.4). */
  readonly planos = computed(() => this._time()?.financeiro.planos ?? []);
  /** Periodicidades com ao menos um plano (define a navegação por mês/semestre e a geração). */
  readonly periodicidades = computed<Periodicidade[]>(() => [...new Set(this.planos().map((p) => p.periodicidade))]);
  /** Opções de modalidade do atleta: planos do time + Isento (sempre disponível). */
  readonly opcoesModalidade = computed<Opcao<string>[]>(() => [
    ...this.planos().map((p) => ({ value: p.id, label: p.nome })),
    { value: ISENTO, label: 'Isento' },
  ]);
  /** Nome de exibição por modalidade (id de plano ou isento). */
  readonly nomesModalidade = computed<ReadonlyMap<string, string>>(
    () => new Map(this.opcoesModalidade().map((o) => [o.value, o.label])),
  );
  /** Modalidade padrão de um cadastro novo: primeiro plano, ou isento. */
  readonly modalidadePadrao = computed(() => this.planos()[0]?.id ?? ISENTO);

  /** Esportes do time, na ordem de exibição. */
  readonly esportes = computed<Esporte[]>(() => {
    const doTime = this._time()?.esportes ?? ESPORTES_PADRAO;
    return ESPORTES.filter((e) => doTime.includes(e));
  });

  private entrando: { timeId: string; promessa: Promise<boolean> } | null = null;

  /**
   * Carrega o time e o acesso do usuário. Retorna false se não existir ou não houver acesso.
   * Chamadas simultâneas para o mesmo time (guards em paralelo) compartilham a mesma leitura.
   */
  entrar(timeId: string): Promise<boolean> {
    if (this._time()?.id === timeId) return Promise.resolve(true);
    if (this.entrando?.timeId !== timeId) {
      const promessa = this.carregar(timeId).finally(() => {
        if (this.entrando?.promessa === promessa) this.entrando = null;
      });
      this.entrando = { timeId, promessa };
    }
    return this.entrando.promessa;
  }

  private async carregar(timeId: string): Promise<boolean> {
    const uid = this.auth.usuario()?.uid;
    if (!uid) return false;

    try {
      // Só membros entram (o adminGeral não tem passe livre no conteúdo dos times; DIRETRIZES 2.12).
      const acessoSnap = await getDoc(doc(this.firestore, 'times', timeId, 'acessos', uid).withConverter(conversor<Acesso>()));
      if (!acessoSnap.exists()) return false;

      const timeSnap = await getDoc(doc(this.firestore, 'times', timeId).withConverter(conversor<TimeGravado>()));
      const gravado = timeSnap.data();
      if (!gravado) return false;

      this._time.set({ ...gravado, financeiro: normalizarFinanceiro(gravado.financeiro), id: timeSnap.id });
      this._acesso.set(acessoSnap.data() ?? null);
      aplicarTemaDoTime(gravado.cor);
      return true;
    } catch {
      return false;
    }
  }

  /** Relê o acesso do usuário no time atual (ex.: depois de alterar os próprios papéis). */
  async recarregarAcesso(): Promise<void> {
    const uid = this.auth.usuario()?.uid;
    const timeId = this.timeId();
    if (!uid || !timeId) return;
    const snap = await getDoc(doc(this.firestore, 'times', timeId, 'acessos', uid).withConverter(conversor<Acesso>()));
    this._acesso.set(snap.data() ?? null);
  }

  /** Reflete no contexto a configuração financeira recém-gravada (evita reler o time). */
  definirFinanceiro(financeiro: ConfigFinanceira): void {
    this._time.update((time) => (time ? { ...time, financeiro } : time));
  }

  /** Reflete no contexto nome, cor (tema) e escudo recém-gravados. */
  definirIdentidade(identidade: Pick<Time, 'nome' | 'cor' | 'escudo'>): void {
    this._time.update((time) => (time ? { ...time, ...identidade } : time));
    aplicarTemaDoTime(identidade.cor);
  }

  /** Reflete no contexto os esportes recém-gravados. */
  definirEsportes(esportes: Esporte[]): void {
    this._time.update((time) => (time ? { ...time, esportes } : time));
  }

  sair(): void {
    this._time.set(null);
    this._acesso.set(null);
    aplicarTemaDoTime(null);
  }
}

/** Nome da modalidade para exibição; plano removido (id sem plano) mostra o nome antigo ou o aviso. */
export function nomeDaModalidade(nomes: ReadonlyMap<string, string>, modalidade: string): string {
  return nomes.get(modalidade) ?? LEGADO[modalidade] ?? 'Plano removido';
}

const LEGADO: Record<string, string | undefined> = { ...ROTULO_TIPO_COBRANCA };
