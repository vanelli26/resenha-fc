import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ComId } from '../../core/firebase/conversor';
import { Atleta } from '../../models/atleta.model';
import { LadoEscalacao, ocupacaoDoLado } from '../../models/escalacao.model';
import { Campinho, VagaCampinho, vagasComAtletas } from './campinho';

/** Um time da escalação: nome (só com dois times), vagas preenchidas e quantas estão ocupadas. */
export interface TimeEscalado {
  lado: LadoEscalacao;
  nome: string | null;
  vagas: VagaCampinho[];
  ocupadas: number;
}

/** Times para os campinhos: um (sem `nomes`) ou dois, com a mesma formação. */
export function timesDaEscalacao(
  formacao: string,
  ocupacao: ReadonlyMap<string, string>,
  nomes: readonly [string, string] | null,
  porId: ReadonlyMap<string, ComId<Atleta>>,
): TimeEscalado[] {
  if (!formacao) return [];
  const lados: LadoEscalacao[] = nomes ? ['a', 'b'] : ['a'];
  return lados.map((lado, i) => {
    const vagas = vagasComAtletas(formacao, ocupacaoDoLado(ocupacao, lado), porId);
    return { lado, nome: nomes?.[i] ?? null, vagas, ocupadas: vagas.filter((v) => v.atleta).length };
  });
}

export interface VagaTocada {
  lado: LadoEscalacao;
  vaga: number;
}

/**
 * Campinhos da escalação: um time, ou dois (jogo entre nós) com nome e contagem. Celular: um abaixo do outro;
 * a partir de 768px, lado a lado.
 */
@Component({
  selector: 'app-campinhos',
  imports: [Campinho],
  template: `
    <div class="campinhos" [class.campinhos--dois]="times().length > 1">
      @for (t of times(); track t.lado) {
        <section class="time">
          @if (t.nome) {
            <h3 class="time__nome">
              {{ t.nome }}
              <small class="texto-suave">{{ t.ocupadas }}/{{ t.vagas.length }}</small>
            </h3>
          }
          <app-campinho [vagas]="t.vagas" [editavel]="editavel()" (tocar)="tocar.emit({ lado: t.lado, vaga: $event })" />
        </section>
      }
    </div>
  `,
  styles: `
    .campinhos {
      display: grid;
      gap: 1.25rem;
    }
    @media (min-width: 768px) {
      .campinhos--dois {
        grid-template-columns: 1fr 1fr;
        align-items: start;
      }
    }
    .time {
      min-width: 0;
    }
    .time__nome {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 0.5rem;
      margin: 0 0 0.5rem;
      font-size: 1rem;

      small {
        font-size: 0.8125rem;
        font-weight: 400;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Campinhos {
  readonly times = input.required<TimeEscalado[]>();
  readonly editavel = input(false);
  readonly tocar = output<VagaTocada>();
}
