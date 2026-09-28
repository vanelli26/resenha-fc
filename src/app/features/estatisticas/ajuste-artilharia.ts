import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormField, form, max, min, required, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MAX_ESTATISTICA, NumerosAtleta } from '../../models/estatistica.model';

export interface OpcaoAtleta {
  value: string;
  label: string;
}

export interface TotaisAtleta extends NumerosAtleta {
  atletaId: string;
}

const ZERO: NumerosAtleta = { gols: 0, assistencias: 0 };

/**
 * Diretoria digita o total de gols e assistências de um atleta no ano; quem chama grava a diferença
 * sobre o automático. "Usar automático" zera o ajuste.
 */
@Component({
  selector: 'app-ajuste-artilharia',
  imports: [FormsModule, FormField, ButtonModule, InputNumberModule, SelectModule],
  template: `
    <form class="formulario" (submit)="$event.preventDefault(); enviar()">
      <label class="campo">
        <span>Atleta</span>
        <p-select
          [options]="atletas()"
          optionLabel="label"
          optionValue="value"
          [ngModel]="atletaId()"
          (ngModelChange)="atletaId.set($event)"
          [ngModelOptions]="{ standalone: true }"
          [filter]="true"
          placeholder="Escolha"
          [fluid]="true"
          appendTo="body"
        />
      </label>

      @if (atletaId()) {
        <div class="numeros">
          <label class="campo">
            <span>Gols</span>
            <p-inputnumber [formField]="formulario.gols" [showButtons]="true" [min]="0" [max]="maximo" [fluid]="true" />
          </label>
          <label class="campo">
            <span>Assistências</span>
            <p-inputnumber [formField]="formulario.assistencias" [showButtons]="true" [min]="0" [max]="maximo" [fluid]="true" />
          </label>
        </div>
        <small class="texto-suave">
          Automático (jogos encerrados): {{ automaticoDoAtleta().gols }} gols · {{ automaticoDoAtleta().assistencias }} assistências.
        </small>
      }

      <div class="acoes">
        @if (atletaId() && ajustado()) {
          <p-button label="Usar automático" [text]="true" severity="secondary" [disabled]="salvando()" (onClick)="usarAutomatico()" />
        }
        <p-button label="Cancelar" [text]="true" [disabled]="salvando()" (onClick)="cancelar.emit()" />
        <p-button label="Salvar" type="submit" [disabled]="!atletaId()" [loading]="salvando()" />
      </div>
    </form>
  `,
  styles: `
    .numeros {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AjusteArtilharia {
  readonly atletas = input.required<OpcaoAtleta[]>();
  /** Números automáticos e exibidos (automático + ajuste) por atletaId. */
  readonly automatico = input.required<ReadonlyMap<string, NumerosAtleta>>();
  readonly atuais = input.required<ReadonlyMap<string, NumerosAtleta>>();
  readonly atletaInicial = input<string | null>(null);
  readonly salvando = input(false);

  readonly salvar = output<TotaisAtleta>();
  readonly cancelar = output<void>();

  protected readonly maximo = MAX_ESTATISTICA;
  protected readonly atletaId = linkedSignal(() => this.atletaInicial());

  protected readonly automaticoDoAtleta = computed(() => this.automatico().get(this.atletaId() ?? '') ?? ZERO);
  /** Totais atuais do atleta escolhido; troca de atleta reinicia o formulário. */
  protected readonly modelo = linkedSignal<NumerosAtleta>(() => ({
    ...(this.atuais().get(this.atletaId() ?? '') ?? ZERO),
  }));
  protected readonly formulario = form(this.modelo, (p) => {
    for (const campo of [p.gols, p.assistencias]) {
      required(campo, { message: 'Informe o número.' });
      min(campo, 0, { message: `De 0 a ${MAX_ESTATISTICA}.` });
      max(campo, MAX_ESTATISTICA, { message: `De 0 a ${MAX_ESTATISTICA}.` });
    }
  });
  protected readonly ajustado = computed(() => {
    const auto = this.automaticoDoAtleta();
    const atual = this.atuais().get(this.atletaId() ?? '') ?? ZERO;
    return atual.gols !== auto.gols || atual.assistencias !== auto.assistencias;
  });

  protected enviar(): void {
    void submit(this.formulario, async () => {
      const atletaId = this.atletaId();
      if (atletaId) this.salvar.emit({ atletaId, ...this.modelo() });
    });
  }

  protected usarAutomatico(): void {
    const atletaId = this.atletaId();
    if (atletaId) this.salvar.emit({ atletaId, ...this.automaticoDoAtleta() });
  }
}
