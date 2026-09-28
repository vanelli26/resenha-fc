import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ComId } from '../../core/firebase/conversor';
import { Atleta } from '../../models/atleta.model';
import { Evento, Presenca, RespostaPresenca } from '../../models/evento.model';
import { participa } from './data/eventos.service';
import { ListaPessoas } from './lista-pessoas';

export interface GrupoPresenca {
  chave: RespostaPresenca | 'sem' | 'compareceu' | 'faltou';
  titulo: string;
  pessoas: ComId<Atleta>[];
}

/** Grupos esmaecidos na lista (quem não vai ou não foi). */
const GRUPOS_APAGADOS: ReadonlySet<GrupoPresenca['chave']> = new Set(['sem', 'nao_vou', 'faltou']);

export function ordenarPorNome(lista: ComId<Atleta>[]): ComId<Atleta>[] {
  return [...lista].sort((a, b) => (a.apelido || a.nome).localeCompare(b.apelido || b.nome, 'pt-BR'));
}

/**
 * Agendado: Vão · Talvez · Não vão · Sem resposta (quem participa e ainda não respondeu).
 * Realizado: Compareceram · Faltaram (disseram "Vou" ou "Talvez" e não foram).
 */
export function gruposDePresenca(
  evento: Evento,
  cadastros: ComId<Atleta>[],
  presencas: ComId<Presenca>[],
): GrupoPresenca[] {
  if (evento.status === 'realizado') {
    const foram = new Set(presencas.filter((p) => p.compareceu).map((p) => p.id));
    const faltaram = new Set(
      presencas.filter((p) => !p.compareceu && (p.resposta === 'vou' || p.resposta === 'talvez')).map((p) => p.id),
    );
    return [
      { chave: 'compareceu', titulo: 'Compareceram', pessoas: ordenarPorNome(cadastros.filter((a) => foram.has(a.id))) },
      { chave: 'faltou', titulo: 'Faltaram', pessoas: ordenarPorNome(cadastros.filter((a) => faltaram.has(a.id))) },
    ];
  }
  const respostas = new Map<string, RespostaPresenca>();
  for (const p of presencas) if (p.resposta) respostas.set(p.id, p.resposta);
  const doGrupo = (r: RespostaPresenca) => ordenarPorNome(cadastros.filter((a) => respostas.get(a.id) === r));
  const semResposta = cadastros.filter((a) => participa(evento.tipo, a) && !respostas.has(a.id));
  return [
    { chave: 'vou', titulo: 'Vão', pessoas: doGrupo('vou') },
    { chave: 'talvez', titulo: 'Talvez', pessoas: doGrupo('talvez') },
    { chave: 'nao_vou', titulo: 'Não vão', pessoas: doGrupo('nao_vou') },
    { chave: 'sem', titulo: 'Sem resposta', pessoas: ordenarPorNome(semResposta) },
  ];
}

/**
 * Lista de presença em abas (a lista pode ser longa: um grupo por vez, começando no primeiro).
 * Conteúdo projetado aparece ao lado das abas (ex.: botão "Ajustar presença").
 */
@Component({
  selector: 'app-lista-presenca',
  imports: [FormsModule, SelectButtonModule, ListaPessoas],
  template: `
    <div class="topo">
      <p-selectbutton
        class="abas"
        [options]="opcoes()"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        [ngModel]="ativo()"
        (ngModelChange)="ativo.set($event)"
        size="small"
        ariaLabel="Lista de presença"
      />
      <ng-content />
    </div>
    <app-lista-pessoas [pessoas]="pessoas()" [apagadas]="apagadas()" />
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.75rem;
    }

    .topo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    // Abas roláveis na horizontal se não couberem.
    .abas {
      display: block;
      max-width: 100%;
      overflow-x: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaPresenca {
  readonly grupos = input.required<GrupoPresenca[]>();

  /** Primeira aba (Vão / Compareceram): valor simples, então só volta a ela quando o evento muda de fase, não a cada resposta. */
  private readonly primeiro = computed<GrupoPresenca['chave']>(() => this.grupos()[0]?.chave ?? 'vou');
  protected readonly ativo = linkedSignal(() => this.primeiro());
  protected readonly opcoes = computed(() =>
    this.grupos().map((g) => ({ value: g.chave, label: `${g.titulo} ${g.pessoas.length}` })),
  );
  protected readonly pessoas = computed(() => this.grupos().find((g) => g.chave === this.ativo())?.pessoas ?? []);
  protected readonly apagadas = computed(() => GRUPOS_APAGADOS.has(this.ativo()));
}
