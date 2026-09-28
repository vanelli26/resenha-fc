import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { amostraDaCor } from '../core/theme/app-theme';
import { CORES_TIME, CorTime } from '../models/time.model';
import { ROTULO_COR } from './rotulos';

/**
 * Cor predominante do time (lista fechada, DIRETRIZES 6.1) em bolinhas. Controle de Signal Forms:
 * `<app-seletor-cor [formField]="formulario.cor" />`.
 */
@Component({
  selector: 'app-seletor-cor',
  template: `
    <fieldset class="cores">
      <legend>Cor predominante</legend>
      <div class="cores__grade">
        @for (c of cores; track c.cor) {
          <label class="cores__opcao" [title]="c.rotulo">
            <input type="radio" name="cor-time" [value]="c.cor" [checked]="value() === c.cor" (change)="value.set(c.cor)" />
            <span class="cores__amostra" [style.background]="c.amostra"></span>
            <span class="visualmente-oculto">{{ c.rotulo }}</span>
          </label>
        }
      </div>
      <small class="campo__dica">{{ rotulo[value()] }}</small>
    </fieldset>
  `,
  styles: `
    .cores {
      display: grid;
      gap: 0.375rem;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .cores__grade {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr));
      gap: 0.5rem;
    }
    .cores__opcao {
      position: relative;
      cursor: pointer;

      input {
        position: absolute;
        opacity: 0;
        inset: 0;
        margin: 0;
        cursor: pointer;
      }
    }
    .cores__amostra {
      display: block;
      aspect-ratio: 1;
      border-radius: 50%;
      border: 2px solid var(--p-content-border-color);
    }
    input:checked + .cores__amostra {
      outline: 3px solid var(--p-text-color);
      outline-offset: 2px;
    }
    input:focus-visible + .cores__amostra {
      outline: 3px solid var(--p-primary-color);
      outline-offset: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorCor implements FormValueControl<CorTime> {
  readonly value = model.required<CorTime>();

  protected readonly rotulo = ROTULO_COR;
  protected readonly cores = CORES_TIME.map((cor) => ({ cor, rotulo: ROTULO_COR[cor], amostra: amostraDaCor(cor) }));
}
