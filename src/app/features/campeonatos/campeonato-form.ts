import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Campeonato, STATUS_CAMPEONATO } from '../../models/campeonato.model';
import { ROTULO_STATUS_CAMPEONATO, opcoes } from '../../shared/rotulos';
import { DadosCampeonato } from './data/campeonatos.service';

function paraFormulario(c: Campeonato | null): DadosCampeonato {
  return {
    nome: c?.nome ?? '',
    temporada: c?.temporada ?? String(new Date().getFullYear()),
    status: c?.status ?? 'andamento',
  };
}

/** Criar ou editar campeonato (diretoria). */
@Component({
  selector: 'app-campeonato-form',
  imports: [FormField, ButtonModule, InputTextModule, SelectModule],
  template: `
    <form class="formulario" (submit)="$event.preventDefault(); enviar()">
      <label class="campo">
        <span>Nome</span>
        <input pInputText [formField]="formulario.nome" placeholder="Ex.: Copa da Liga" autocomplete="off" />
        @if (formulario.nome().touched() && formulario.nome().invalid()) {
          <small class="campo__erro">{{ formulario.nome().errors()[0].message }}</small>
        }
      </label>
      <div class="grade">
        <label class="campo">
          <span>Temporada</span>
          <input pInputText [formField]="formulario.temporada" placeholder="2026" autocomplete="off" />
          @if (formulario.temporada().touched() && formulario.temporada().invalid()) {
            <small class="campo__erro">{{ formulario.temporada().errors()[0].message }}</small>
          }
        </label>
        <label class="campo">
          <span>Situação</span>
          <p-select
            [formField]="formulario.status"
            [options]="opcoesStatus"
            optionLabel="label"
            optionValue="value"
            [fluid]="true"
            appendTo="body"
          />
        </label>
      </div>
      <div class="acoes">
        <p-button label="Cancelar" [text]="true" type="button" (onClick)="cancelar.emit()" />
        <p-button label="Salvar" type="submit" [loading]="salvando()" />
      </div>
    </form>
  `,
  styles: `
    .grade {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampeonatoForm {
  readonly campeonato = input<Campeonato | null>(null);
  readonly salvando = input(false);
  readonly salvar = output<DadosCampeonato>();
  readonly cancelar = output<void>();

  protected readonly opcoesStatus = opcoes(STATUS_CAMPEONATO, ROTULO_STATUS_CAMPEONATO);
  protected readonly modelo = linkedSignal(() => paraFormulario(this.campeonato()));
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.nome, { message: 'Informe o nome.' });
    maxLength(p.nome, 60, { message: 'Máximo de 60 caracteres.' });
    required(p.temporada, { message: 'Informe a temporada.' });
    maxLength(p.temporada, 20, { message: 'Máximo de 20 caracteres.' });
  });

  protected enviar(): void {
    void submit(this.formulario, async () => {
      const f = this.modelo();
      this.salvar.emit({ nome: f.nome.trim(), temporada: f.temporada.trim(), status: f.status });
    });
  }
}
