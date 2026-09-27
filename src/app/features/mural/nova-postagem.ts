import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Camera } from '@primeicons/angular/camera';
import { Times } from '@primeicons/angular/times';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MAX_FOTOS_POST } from '../../models/recado.model';
import { mensagemDeErro } from '../../shared/erros';
import { FotoProcessada, fotoParaEnvio } from '../../shared/imagem';
import { NovoPost } from './data/recados.service';

const MAX_TEXTO = 2000;

interface FotoEscolhida {
  foto: FotoProcessada;
  /** URL local (blob:) só para a prévia. */
  previa: string;
}

/** Nova postagem: até 4 fotos (reduzidas no aparelho, com prévia) e legenda. */
@Component({
  selector: 'app-nova-postagem',
  imports: [FormsModule, ButtonModule, TextareaModule, ToggleSwitchModule, Camera, Times],
  templateUrl: './nova-postagem.html',
  styleUrl: './nova-postagem.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovaPostagem {
  /** Diretoria pode publicar já fixado. */
  readonly podeFixar = input(false);
  readonly enviando = input(false);
  /** Fotos já enviadas (progresso). */
  readonly enviadas = input(0);
  readonly publicar = output<NovoPost>();
  readonly cancelar = output<void>();

  protected readonly maxFotos = MAX_FOTOS_POST;
  protected readonly maxTexto = MAX_TEXTO;
  protected readonly fotos = signal<FotoEscolhida[]>([]);
  protected readonly texto = signal('');
  protected readonly fixado = signal(false);
  protected readonly processando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly podePublicar = computed(
    () =>
      !this.processando() &&
      !this.enviando() &&
      this.texto().length <= MAX_TEXTO &&
      (this.fotos().length > 0 || this.texto().trim().length > 0),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.fotos().forEach((f) => URL.revokeObjectURL(f.previa)));
  }

  protected async escolher(evento: Event): Promise<void> {
    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement)) return;
    const vagas = MAX_FOTOS_POST - this.fotos().length;
    const arquivos = Array.from(campo.files ?? []).slice(0, vagas);
    campo.value = '';
    if (arquivos.length === 0) return;
    this.erro.set(null);
    this.processando.set(true);
    try {
      for (const arquivo of arquivos) {
        const foto = await fotoParaEnvio(arquivo);
        this.fotos.update((lista) => [...lista, { foto, previa: URL.createObjectURL(foto.blob) }]);
      }
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.processando.set(false);
    }
  }

  protected remover(indice: number): void {
    const removida = this.fotos()[indice];
    if (removida) URL.revokeObjectURL(removida.previa);
    this.fotos.update((lista) => lista.filter((_, i) => i !== indice));
  }

  protected enviar(): void {
    if (!this.podePublicar()) return;
    this.publicar.emit({
      texto: this.texto().trim(),
      fixado: this.podeFixar() && this.fixado(),
      fotos: this.fotos().map((f) => f.foto),
    });
  }
}
