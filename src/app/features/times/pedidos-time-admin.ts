import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ComId } from '../../core/firebase/conversor';
import { MAX_MOTIVO_PEDIDO, PedidoTime } from '../../models/pedido-time.model';

export interface DecisaoPedido {
  pedido: ComId<PedidoTime>;
  aprovado: boolean;
  motivo: string;
}

/** Pedidos de time novo para o adminGeral (DIRETRIZES 2.12): pendentes com aprovar/reprovar e os já decididos. */
@Component({
  selector: 'app-pedidos-time-admin',
  imports: [DatePipe, FormsModule, ButtonModule, DialogModule, TagModule, TextareaModule],
  template: `
    <section class="secao">
      <h3>Pedidos de time</h3>
      <ul class="lista">
        @for (p of pendentes(); track p.id) {
          <li class="cartao pedido">
            <span class="pedido__texto">
              <strong>{{ p.nome }}</strong>
              <small class="texto-suave">/t/{{ p.id }} · {{ p.solicitanteNome }} ({{ p.solicitanteEmail }})</small>
              @if (p.criadoEm) {
                <small class="texto-suave">Pedido em {{ p.criadoEm.toDate() | date: "dd/MM/yyyy 'às' HH:mm" }}</small>
              }
            </span>
            <div class="pedido__acoes">
              <p-button
                label="Reprovar"
                size="small"
                [text]="true"
                severity="danger"
                [disabled]="ocupado() !== null"
                (onClick)="emReprovacao.set(p)"
              />
              <p-button
                label="Aprovar"
                size="small"
                [loading]="ocupado() === p.id"
                [disabled]="ocupado() !== null"
                (onClick)="decidir.emit({ pedido: p, aprovado: true, motivo: '' })"
              />
            </div>
          </li>
        } @empty {
          <li class="texto-suave">Nenhum pedido aguardando.</li>
        }
      </ul>

      @if (decididos().length > 0) {
        <details class="decididos">
          <summary class="texto-suave">Já decididos ({{ decididos().length }})</summary>
          <ul class="lista">
            @for (p of decididos(); track p.id) {
              <li class="decidido">
                <span class="pedido__texto">
                  <span>{{ p.nome }} <small class="texto-suave">· {{ p.solicitanteNome }}</small></span>
                  @if (p.motivo) {
                    <small class="texto-suave">{{ p.motivo }}</small>
                  }
                </span>
                <p-tag
                  [value]="p.status === 'aprovado' ? 'Aprovado' : 'Reprovado'"
                  [severity]="p.status === 'aprovado' ? 'success' : 'danger'"
                />
              </li>
            }
          </ul>
        </details>
      }
    </section>

    <p-dialog
      header="Reprovar pedido"
      [visible]="emReprovacao() !== null"
      (visibleChange)="$event || fecharReprovacao()"
      [modal]="true"
      [style]="{ width: 'min(26rem, 100vw - 2rem)' }"
    >
      @if (emReprovacao(); as p) {
        <div class="formulario">
          <span>Reprovar <strong>{{ p.nome }}</strong>? {{ p.solicitanteNome }} verá o aviso e o motivo.</span>
          <label class="campo">
            <span>Motivo (opcional)</span>
            <textarea
              pTextarea
              rows="3"
              [autoResize]="true"
              [maxlength]="maxMotivo"
              [ngModel]="motivo()"
              (ngModelChange)="motivo.set($event)"
            ></textarea>
          </label>
          <div class="acoes">
            <p-button label="Voltar" [text]="true" [disabled]="ocupado() !== null" (onClick)="fecharReprovacao()" />
            <p-button
              label="Reprovar"
              severity="danger"
              [loading]="ocupado() === p.id"
              (onClick)="decidir.emit({ pedido: p, aprovado: false, motivo: motivo().trim() })"
            />
          </div>
        </div>
      }
    </p-dialog>
  `,
  styles: `
    .secao {
      margin-bottom: 1.5rem;

      h3 {
        margin: 0 0 0.75rem;
        font-size: 1.125rem;
      }
    }
    .pedido {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
    }
    .pedido__texto {
      flex: 1 1 14rem;
      min-width: 0;
      display: grid;
      gap: 0.125rem;
    }
    .pedido__acoes {
      display: flex;
      gap: 0.25rem;
    }
    .decididos {
      margin-top: 0.75rem;

      summary {
        cursor: pointer;
        margin-bottom: 0.5rem;
      }
    }
    .decidido {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PedidosTimeAdmin {
  readonly pedidos = input.required<ComId<PedidoTime>[]>();
  /** Pedido sendo decidido (carregando no botão). */
  readonly ocupado = input<string | null>(null);
  readonly decidir = output<DecisaoPedido>();

  protected readonly maxMotivo = MAX_MOTIVO_PEDIDO;
  protected readonly emReprovacao = signal<ComId<PedidoTime> | null>(null);
  protected readonly motivo = signal('');

  protected readonly pendentes = computed(() => this.pedidos().filter((p) => p.status === 'pendente'));
  protected readonly decididos = computed(() => this.pedidos().filter((p) => p.status !== 'pendente'));

  /** Chamado por quem usa depois de gravar a reprovação. */
  fecharReprovacao(): void {
    this.emReprovacao.set(null);
    this.motivo.set('');
  }
}
