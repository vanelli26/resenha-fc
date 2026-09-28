import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CorTime } from '../../models/time.model';
import { SeletorCor } from '../../shared/seletor-cor';
import { PADRAO_SLUG, slugDe } from '../../shared/slug';
import { NovoPedidoTime } from './data/pedidos-time.service';

interface FormPedido {
  nome: string;
  slug: string;
  cor: CorTime;
}

/** Pedido de time novo: nome, endereço (gerado do nome até a pessoa editar) e cor. */
@Component({
  selector: 'app-pedido-time-form',
  imports: [FormField, ButtonModule, InputTextModule, SeletorCor],
  template: `
    <form class="formulario" (submit)="$event.preventDefault(); enviar()">
      <p class="texto-suave dica">
        O pedido vai para aprovação. Aprovado, você cria o time e entra como diretoria e tesouraria.
      </p>
      <label class="campo">
        <span>Nome do time</span>
        <input pInputText [formField]="formulario.nome" (input)="nomeMudou()" placeholder="Ex.: Amigos FC" autocomplete="off" />
        @if (formulario.nome().touched() && formulario.nome().invalid()) {
          <small class="campo__erro">{{ formulario.nome().errors()[0].message }}</small>
        }
      </label>
      <label class="campo">
        <span>Endereço</span>
        <input pInputText [formField]="formulario.slug" (input)="slugEditado.set(true)" autocapitalize="off" autocomplete="off" />
        <small class="campo__dica">resenhafc…/t/{{ modelo().slug || 'seu-time' }} · não muda depois.</small>
        @if (formulario.slug().touched() && formulario.slug().invalid()) {
          <small class="campo__erro">{{ formulario.slug().errors()[0].message }}</small>
        }
      </label>
      <app-seletor-cor [formField]="formulario.cor" />
      <div class="acoes">
        <p-button label="Cancelar" [text]="true" type="button" [disabled]="enviando()" (onClick)="cancelar.emit()" />
        <p-button label="Enviar pedido" type="submit" [loading]="enviando()" />
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PedidoTimeForm {
  readonly enviando = input(false);
  readonly pedir = output<NovoPedidoTime>();
  readonly cancelar = output<void>();

  /** Depois que a pessoa mexe no endereço, o nome não o sobrescreve mais. */
  protected readonly slugEditado = signal(false);
  protected readonly modelo = signal<FormPedido>({ nome: '', slug: '', cor: 'emerald' });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.nome, { message: 'Informe o nome.' });
    maxLength(p.nome, 60, { message: 'Máximo de 60 caracteres.' });
    required(p.slug, { message: 'Informe o endereço.' });
    pattern(p.slug, PADRAO_SLUG, { message: 'Use 2 a 40 letras minúsculas, números ou hífen.' });
  });

  protected nomeMudou(): void {
    if (!this.slugEditado()) this.modelo.update((m) => ({ ...m, slug: slugDe(m.nome) }));
  }

  protected enviar(): void {
    void submit(this.formulario, async () => {
      const f = this.modelo();
      this.pedir.emit({ nome: f.nome.trim(), slug: f.slug, cor: f.cor });
    });
  }
}
