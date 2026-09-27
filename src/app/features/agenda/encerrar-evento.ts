import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Minus } from '@primeicons/angular/minus';
import { Plus } from '@primeicons/angular/plus';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta } from '../../models/atleta.model';
import { Evento, Gol, MAX_GOLS, RespostaPresenca, TIPOS_COM_ADVERSARIO } from '../../models/evento.model';
import { Escudo } from '../../shared/escudo';
import { Comparecimento, NovoGol, Placar } from './data/eventos.service';

/** Pessoa que participa do evento, com a marcação inicial de presença. */
export interface Participante {
  atleta: ComId<Atleta>;
  resposta: RespostaPresenca | null;
  compareceu: boolean;
  temPresenca: boolean;
}

export interface Encerramento {
  placar: Placar | null;
  gols: NovoGol[];
  /** Presença inicial (só no primeiro encerramento; depois, ajuste pela tela do evento). */
  presenca: Comparecimento[];
}

/** Valor do autor no select: atletaId, GOL_CONTRA ou '' (não informado). */
const GOL_CONTRA = '__contra__';

interface LinhaGol {
  autor: string;
  assistencia: string | null;
}

function paraLinha(g: Gol): LinhaGol {
  return { autor: g.autorId ?? GOL_CONTRA, assistencia: g.assistenciaId ?? null };
}

/** Ajusta a lista ao placar: completa com linhas vazias ou corta do fim. */
function redimensionar(linhas: LinhaGol[], total: number): LinhaGol[] {
  return linhas.length >= total
    ? linhas.slice(0, total)
    : [...linhas, ...Array.from({ length: total - linhas.length }, () => ({ autor: '', assistencia: null }))];
}

/**
 * Encerramento (diretoria): placar e gols (autor + assistência opcional). A presença inicial é
 * "quem disse Vou"; o ajuste de quem foi e quem não foi é feito depois, no evento encerrado.
 */
@Component({
  selector: 'app-encerrar-evento',
  imports: [FormsModule, ButtonModule, SelectModule, Escudo, Minus, Plus],
  templateUrl: './encerrar-evento.html',
  styleUrl: './encerrar-evento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EncerrarEvento {
  private readonly timeAtual = inject(TimeAtualService);

  readonly evento = input.required<Evento>();
  readonly participantes = input.required<Participante[]>();
  /** Gols já gravados (ao corrigir o encerramento). */
  readonly gols = input<ComId<Gol>[]>([]);
  readonly salvando = input(false);
  readonly confirmar = output<Encerramento>();
  readonly cancelar = output<void>();

  protected readonly time = this.timeAtual.time;
  protected readonly temPlacar = computed(() => TIPOS_COM_ADVERSARIO.includes(this.evento().tipo));
  protected readonly primeiroEncerramento = computed(() => this.evento().status !== 'realizado');
  protected readonly presentesIniciais = computed(() => this.participantes().filter((p) => p.compareceu).length);

  /** Placar começa vazio (sem placar) ou com o já informado; o primeiro toque em +/− o ativa em 0 x 0. */
  protected readonly placar = linkedSignal<Placar | null>(() => {
    const e = this.evento();
    return e.placarPro !== undefined && e.placarContra !== undefined ? { pro: e.placarPro, contra: e.placarContra } : null;
  });
  /** Uma linha por gol a favor. */
  protected readonly linhas = linkedSignal<LinhaGol[]>(() =>
    redimensionar(this.gols().map(paraLinha), this.evento().placarPro ?? 0),
  );

  /** Autores possíveis: gol contra + quem participa (presentes primeiro). */
  protected readonly opcoesAutor = computed(() => [
    { value: GOL_CONTRA, label: 'Gol contra (adversário)' },
    ...this.opcoesPessoas(),
  ]);
  protected readonly opcoesPessoas = computed(() =>
    [...this.participantes()]
      .sort((a, b) => Number(b.compareceu) - Number(a.compareceu))
      .map((p) => ({ value: p.atleta.id, label: p.atleta.apelido || p.atleta.nome })),
  );
  protected readonly golContra = GOL_CONTRA;

  protected somar(lado: keyof Placar, delta: number): void {
    const atual = this.placar() ?? { pro: 0, contra: 0 };
    const novo = { ...atual, [lado]: Math.min(MAX_GOLS, Math.max(0, atual[lado] + delta)) };
    this.placar.set(novo);
    if (lado === 'pro') this.linhas.update((l) => redimensionar(l, novo.pro));
  }

  protected semPlacar(): void {
    this.placar.set(null);
    this.linhas.set([]);
  }

  protected definirAutor(indice: number, autor: string | null): void {
    this.linhas.update((l) =>
      l.map((linha, i) =>
        i === indice
          ? // Gol contra não tem assistência; autor não pode ser o próprio assistente.
            { autor: autor ?? '', assistencia: autor === GOL_CONTRA || autor === linha.assistencia ? null : linha.assistencia }
          : linha,
      ),
    );
  }

  protected definirAssistencia(indice: number, assistencia: string | null): void {
    this.linhas.update((l) => l.map((linha, i) => (i === indice ? { ...linha, assistencia } : linha)));
  }

  protected enviar(): void {
    const placar = this.temPlacar() ? this.placar() : null;
    // Gols sem autor informado não são gravados (autor é opcional; a ordem se mantém entre os informados).
    const gols: NovoGol[] = placar
      ? this.linhas()
          .filter((l) => l.autor !== '')
          .map((l) => ({
            autorId: l.autor === GOL_CONTRA ? null : l.autor,
            ...(l.assistencia && l.autor !== GOL_CONTRA ? { assistenciaId: l.assistencia } : {}),
          }))
      : [];
    this.confirmar.emit({
      placar,
      gols,
      presenca: this.primeiroEncerramento()
        ? this.participantes().map((p) => ({
            atletaId: p.atleta.id,
            compareceu: p.compareceu,
            temPresenca: p.temPresenca,
          }))
        : [],
    });
  }
}
