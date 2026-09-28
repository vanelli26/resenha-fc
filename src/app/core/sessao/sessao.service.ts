import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Acesso } from '../../models/acesso.model';
import { PapelTime } from '../../models/papel.model';
import { TimeGravado } from '../../models/time.model';
import { AuthService } from '../auth/auth.service';
import { conversor } from '../firebase/conversor';
import { FIRESTORE } from '../firebase/firestore.token';

export interface MeuTime {
  timeId: string;
  timeNome: string;
  papeis: PapelTime[];
  escudo: string | null;
  /** Atleta vinculado à conta neste time (null se não estiver no elenco). */
  atletaId: string | null;
}

/** Dados da sessão logada: adminGeral e times do usuário. Leitura única, recarregável. */
@Injectable({ providedIn: 'root' })
export class SessaoService {
  private readonly firestore = inject(FIRESTORE);
  private readonly auth = inject(AuthService);

  private perfilCache: { uid: string; promessa: Promise<boolean> } | null = null;
  private readonly _adminGeral = signal(false);
  private readonly _meusTimes = signal<MeuTime[]>([]);
  private readonly _carregandoTimes = signal(false);

  readonly adminGeral = this._adminGeral.asReadonly();
  readonly meusTimes = this._meusTimes.asReadonly();
  readonly carregandoTimes = this._carregandoTimes.asReadonly();
  readonly temTimes = computed(() => this._meusTimes().length > 0);

  constructor() {
    // Troca de usuário (logout/login) descarta o que foi carregado. Compara uid para não
    // limpar na primeira execução do effect, que pode rodar depois de uma carga já iniciada.
    let uidAnterior = this.auth.usuario()?.uid;
    effect(() => {
      const uid = this.auth.usuario()?.uid;
      if (uid === uidAnterior) return;
      uidAnterior = uid;
      this.perfilCache = null;
      this._adminGeral.set(false);
      this._meusTimes.set([]);
    });
  }

  ehAdminGeral(): Promise<boolean> {
    const uid = this.auth.usuario()?.uid;
    if (!uid) return Promise.resolve(false);
    if (this.perfilCache?.uid !== uid) {
      const promessa = getDoc(doc(this.firestore, 'usuarios', uid)).then(
        (snap) => snap.get('adminGeral') === true,
      );
      promessa.then((admin) => this._adminGeral.set(admin)).catch(() => this._adminGeral.set(false));
      this.perfilCache = { uid, promessa };
    }
    return this.perfilCache.promessa;
  }

  async carregarMeusTimes(): Promise<void> {
    const uid = this.auth.usuario()?.uid;
    if (!uid) return;
    this._carregandoTimes.set(true);
    try {
      // Mesmo filtro que a regra de collection group exige (uid == request.auth.uid).
      const acessos = await getDocs(
        query(collectionGroup(this.firestore, 'acessos').withConverter(conversor<Acesso>()), where('uid', '==', uid)),
      );
      const acessoPorTime = new Map(acessos.docs.map((d) => [d.data().timeId, d.data()]));

      // Documentos dos times (nome atual e escudo). Só os times de que a pessoa participa, inclusive para o
      // adminGeral, que vê os demais apenas em Gerenciar times (DIRETRIZES 2.12).
      const colecaoTimes = collection(this.firestore, 'times').withConverter(conversor<TimeGravado>());
      const times = await Promise.all([...acessoPorTime.keys()].map((id) => getDoc(doc(colecaoTimes, id))));

      const meus: MeuTime[] = [];
      for (const t of times) {
        const dados = t.data();
        if (!dados) continue;
        meus.push({
          timeId: t.id,
          timeNome: dados.nome,
          papeis: acessoPorTime.get(t.id)?.papeis ?? [],
          escudo: dados.escudo ?? null,
          atletaId: acessoPorTime.get(t.id)?.atletaId ?? null,
        });
      }
      this._meusTimes.set(meus.sort((a, b) => a.timeNome.localeCompare(b.timeNome, 'pt-BR')));
    } finally {
      this._carregandoTimes.set(false);
    }
  }
}
