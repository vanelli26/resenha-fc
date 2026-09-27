import { Injectable, computed, inject, signal } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { Acesso } from '../../models/acesso.model';
import { MODALIDADES, Modalidade } from '../../models/modalidade.model';
import { PapelTime } from '../../models/papel.model';
import { ConfigFinanceira, Time } from '../../models/time.model';
import { AuthService } from '../auth/auth.service';
import { ComId, conversor } from '../firebase/conversor';
import { FIRESTORE } from '../firebase/firestore.token';
import { SessaoService } from '../sessao/sessao.service';
import { aplicarTemaDoTime } from '../theme/app-theme';

/** Contexto do time selecionado (URL /t/:timeId). Autorização aqui é UX; a segurança está nas Rules. */
@Injectable({ providedIn: 'root' })
export class TimeAtualService {
  private readonly firestore = inject(FIRESTORE);
  private readonly auth = inject(AuthService);
  private readonly sessao = inject(SessaoService);

  private readonly _time = signal<ComId<Time> | null>(null);
  private readonly _acesso = signal<Acesso | null>(null);

  readonly time = this._time.asReadonly();
  readonly acesso = this._acesso.asReadonly();
  readonly timeId = computed(() => this._time()?.id ?? null);
  readonly papeis = computed<PapelTime[]>(() => this._acesso()?.papeis ?? []);
  readonly ehDiretoria = computed(() => this.sessao.adminGeral() || this.papeis().includes('diretoria'));
  readonly ehTesouraria = computed(() => this.sessao.adminGeral() || this.papeis().includes('tesouraria'));
  /** Diretoria ou tesouraria: veem caixa e cobranças (DIRETRIZES 2.3). */
  readonly ehGestao = computed(() => this.ehDiretoria() || this.ehTesouraria());

  /** Modalidades que o time aceita (DIRETRIZES 2.4). `isento` é sempre permitido. */
  readonly modalidadesHabilitadas = computed<Modalidade[]>(() => {
    const financeiro = this._time()?.financeiro;
    return MODALIDADES.filter((m) => m === 'isento' || financeiro?.[m].ativo === true);
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
      const [admin, acessoSnap] = await Promise.all([
        this.sessao.ehAdminGeral(),
        getDoc(doc(this.firestore, 'times', timeId, 'acessos', uid).withConverter(conversor<Acesso>())),
      ]);
      if (!acessoSnap.exists() && !admin) return false;

      const timeSnap = await getDoc(doc(this.firestore, 'times', timeId).withConverter(conversor<Time>()));
      if (!timeSnap.exists()) return false;

      this._time.set({ ...timeSnap.data(), id: timeSnap.id });
      this._acesso.set(acessoSnap.data() ?? null);
      aplicarTemaDoTime(timeSnap.data().cor);
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

  sair(): void {
    this._time.set(null);
    this._acesso.set(null);
    aplicarTemaDoTime(null);
  }
}
