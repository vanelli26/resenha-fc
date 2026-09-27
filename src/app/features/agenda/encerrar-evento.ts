import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { ComId } from '../../core/firebase/conversor';
import { Atleta } from '../../models/atleta.model';
import { Evento, RespostaPresenca, TIPOS_COM_ADVERSARIO } from '../../models/evento.model';
import { ROTULO_RESPOSTA } from '../../shared/rotulos';
import { Comparecimento, Placar } from './data/eventos.service';

/** Pessoa na lista de encerramento, com a marcação inicial. */
export interface Participante {
  atleta: ComId<Atleta>;
  resposta: RespostaPresenca | null;
  compareceu: boolean;
  temPresenca: boolean;
}

export interface Encerramento {
  placar: Placar | null;
  lista: Comparecimento[];
}

/** Diretoria marca quem compareceu (quem disse "Vou" já vem marcado) e, se houver adversário, o placar. */
@Component({
  selector: 'app-encerrar-evento',
  imports: [FormsModule, ButtonModule, CheckboxModule, InputNumberModule],
  templateUrl: './encerrar-evento.html',
  styleUrl: './encerrar-evento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EncerrarEvento {
  readonly evento = input.required<Evento>();
  readonly participantes = input.required<Participante[]>();
  readonly salvando = input(false);
  readonly confirmar = output<Encerramento>();
  readonly cancelar = output<void>();

  protected readonly rotuloResposta = ROTULO_RESPOSTA;
  protected readonly estiloNumero = { width: '4rem', textAlign: 'center', fontSize: '1.25rem' };
  protected readonly temPlacar = computed(() => TIPOS_COM_ADVERSARIO.includes(this.evento().tipo));

  protected readonly marcados = linkedSignal<ReadonlySet<string>>(
    () => new Set(this.participantes().filter((p) => p.compareceu).map((p) => p.atleta.id)),
  );
  protected readonly placarPro = linkedSignal<number | null>(() => this.evento().placarPro ?? null);
  protected readonly placarContra = linkedSignal<number | null>(() => this.evento().placarContra ?? null);
  /** Placar é tudo ou nada: os dois números ou nenhum. */
  protected readonly placarIncompleto = computed(() => (this.placarPro() === null) !== (this.placarContra() === null));

  protected alternar(atletaId: string, marcado: boolean): void {
    this.marcados.update((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(atletaId);
      else novo.delete(atletaId);
      return novo;
    });
  }

  protected enviar(): void {
    if (this.placarIncompleto()) return;
    const pro = this.placarPro();
    const contra = this.placarContra();
    const marcados = this.marcados();
    this.confirmar.emit({
      placar: this.temPlacar() && pro !== null && contra !== null ? { pro, contra } : null,
      lista: this.participantes().map((p) => ({
        atletaId: p.atleta.id,
        compareceu: marcados.has(p.atleta.id),
        temPresenca: p.temPresenca,
      })),
    });
  }
}
