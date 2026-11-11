import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { Atleta } from '../../models/atleta.model';
import { Modalidade } from '../../models/modalidade.model';
import { Opcao } from '../../shared/rotulos';

/** Tesouraria (sem diretoria) troca só o plano de cobrança do cadastro (DIRETRIZES 2.4). */
@Component({
  selector: 'app-plano-atleta-form',
  imports: [FormField, ButtonModule, SelectModule],
  template: `
    <form class="formulario" (submit)="$event.preventDefault(); enviar()">
      <p class="texto-suave">{{ atleta().nome }}</p>
      <label class="campo">
        <span>Plano de cobrança</span>
        <p-select
          [formField]="formulario.modalidade"
          [options]="opcoesComAtual()"
          optionLabel="label"
          optionValue="value"
          [fluid]="true"
          appendTo="body"
        />
        <small class="campo__dica">Isento nunca gera cobrança. Os demais dados do atleta ficam com a diretoria.</small>
      </label>
      <div class="acoes">
        <p-button label="Cancelar" [text]="true" type="button" (onClick)="cancelar.emit()" />
        <p-button label="Salvar" type="submit" [loading]="salvando()" />
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanoAtletaForm {
  readonly atleta = input.required<Atleta>();
  /** Planos do time + Isento. */
  readonly opcoesModalidade = input.required<Opcao<Modalidade>[]>();
  readonly salvando = input(false);
  readonly salvar = output<Modalidade>();
  readonly cancelar = output<void>();

  /** Mantém a opção atual mesmo se o plano foi removido (não força troca). */
  protected readonly opcoesComAtual = computed(() => {
    const atual = this.atleta().modalidade;
    const opcoes = this.opcoesModalidade();
    return opcoes.some((o) => o.value === atual) ? opcoes : [...opcoes, { value: atual, label: 'Plano removido' }];
  });

  protected readonly modelo = linkedSignal(() => ({ modalidade: this.atleta().modalidade }));
  protected readonly formulario = form(this.modelo);

  protected enviar(): void {
    void submit(this.formulario, async () => this.salvar.emit(this.modelo().modalidade));
  }
}
