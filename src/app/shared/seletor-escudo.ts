import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, model, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Avisos } from './avisos';
import { Escudo } from './escudo';
import { FotoProcessada, fotoParaEnvio } from './imagem';

/** O que fazer com o escudo ao salvar: manter o gravado, remover ou enviar uma imagem nova. */
export type EscolhaEscudo = { tipo: 'manter' } | { tipo: 'remover' } | { tipo: 'novo'; foto: FotoProcessada };

/**
 * Escolha do escudo do time (DIRETRIZES 6.1): prévia, enviar/trocar e remover. A imagem é reduzida no aparelho
 * (512px, WebP; PNG onde não houver encoder, mantendo transparência); quem usa envia ao salvar.
 */
@Component({
  selector: 'app-seletor-escudo',
  imports: [ButtonModule, Escudo],
  template: `
    <div class="campo">
      <span>Escudo</span>
      <div class="escudo">
        <app-escudo class="escudo__previa" [src]="previa() ?? ''" [nome]="nome() || '?'" />
        <label class="escudo__enviar">
          <input type="file" accept="image/*" [disabled]="processando()" (change)="escolher($event)" />
          <span class="p-button p-button-outlined p-button-sm">
            {{ processando() ? 'Processando…' : previa() ? 'Trocar imagem' : 'Enviar imagem' }}
          </span>
        </label>
        @if (previa()) {
          <p-button label="Remover" size="small" [text]="true" severity="danger" type="button" (onClick)="remover()" />
        }
      </div>
      <small class="campo__dica">PNG, JPG, WebP ou SVG. A imagem é reduzida para 512px (fundo transparente é mantido).</small>
    </div>
  `,
  styles: `
    .escudo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    .escudo__previa {
      --escudo-tamanho: 4rem;
    }
    .escudo__enviar {
      cursor: pointer;

      input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
      }

      input:focus-visible + span {
        outline: 2px solid var(--p-primary-color);
        outline-offset: 2px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorEscudo {
  private readonly avisos = inject(Avisos);

  /** Escudo gravado (URL do Storage ou data URL antigo) ou null. */
  readonly atual = input<string | null>(null);
  /** Nome do time, para a inicial quando não há escudo. */
  readonly nome = input('');
  readonly escolha = model<EscolhaEscudo>({ tipo: 'manter' });
  /** Processando a imagem escolhida (quem usa desabilita o salvar). */
  readonly processando = signal(false);

  private readonly previaNova = signal<string | null>(null);
  protected readonly previa = computed(() => {
    const e = this.escolha();
    if (e.tipo === 'remover') return null;
    return e.tipo === 'novo' ? this.previaNova() : this.atual();
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.liberarPrevia());
  }

  protected async escolher(evento: Event): Promise<void> {
    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement)) return;
    const arquivo = campo.files?.[0];
    campo.value = '';
    if (!arquivo) return;
    this.processando.set(true);
    try {
      const foto = await fotoParaEnvio(arquivo, 512, 'image/png');
      this.liberarPrevia();
      this.previaNova.set(URL.createObjectURL(foto.blob));
      this.escolha.set({ tipo: 'novo', foto });
    } catch (e) {
      this.avisos.erro('Imagem não aceita', e);
    } finally {
      this.processando.set(false);
    }
  }

  protected remover(): void {
    this.liberarPrevia();
    this.escolha.set({ tipo: 'remover' });
  }

  private liberarPrevia(): void {
    const previa = this.previaNova();
    if (previa) URL.revokeObjectURL(previa);
    this.previaNova.set(null);
  }
}
