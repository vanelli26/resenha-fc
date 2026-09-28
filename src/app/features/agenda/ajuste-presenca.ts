import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { Participante } from './encerrar-evento';
import { ListaPessoas } from './lista-pessoas';

/** Ajuste de presença do evento encerrado (diretoria): listas Foram / Não foram; tocar numa pessoa a move. */
@Component({
  selector: 'app-ajuste-presenca',
  imports: [FormsModule, ButtonModule, SelectButtonModule, ListaPessoas],
  template: `
    <p-selectbutton
      [options]="opcoes()"
      optionLabel="label"
      optionValue="value"
      [allowEmpty]="false"
      [ngModel]="aba()"
      (ngModelChange)="aba.set($event)"
      size="small"
      ariaLabel="Quem foi e quem não foi"
    />
    <small class="texto-suave">Toque em alguém para mover para "{{ aba() === 'foram' ? 'Não foram' : 'Foram' }}".</small>
    <app-lista-pessoas [pessoas]="lista()" [tocavel]="true" (tocar)="mover($event)" />
    <div class="acoes">
      <p-button label="Cancelar" [text]="true" [disabled]="salvando()" (onClick)="cancelar.emit()" />
      <p-button label="Salvar presença" [loading]="salvando()" (onClick)="salvar.emit(presentes())" />
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AjustePresenca {
  readonly participantes = input.required<Participante[]>();
  /** Quem consta como presente ao abrir o ajuste. */
  readonly presentesIniciais = input.required<ReadonlySet<string>>();
  readonly salvando = input(false);

  readonly salvar = output<ReadonlySet<string>>();
  readonly cancelar = output<void>();

  protected readonly presentes = linkedSignal(() => this.presentesIniciais());
  protected readonly aba = signal<'foram' | 'nao_foram'>('foram');

  protected readonly opcoes = computed(() => {
    const presentes = this.presentes();
    const foram = this.participantes().filter((p) => presentes.has(p.atleta.id)).length;
    return [
      { value: 'foram', label: `Foram ${foram}` },
      { value: 'nao_foram', label: `Não foram ${this.participantes().length - foram}` },
    ];
  });

  protected readonly lista = computed(() => {
    const presentes = this.presentes();
    const foram = this.aba() === 'foram';
    return this.participantes()
      .filter((p) => presentes.has(p.atleta.id) === foram)
      .map((p) => p.atleta);
  });

  protected mover(atletaId: string): void {
    this.presentes.update((atual) => {
      const novo = new Set(atual);
      if (novo.has(atletaId)) novo.delete(atletaId);
      else novo.add(atletaId);
      return novo;
    });
  }
}
