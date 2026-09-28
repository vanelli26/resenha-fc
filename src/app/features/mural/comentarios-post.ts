import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Send } from '@primeicons/angular/send';
import { Trash } from '@primeicons/angular/trash';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Comentario, MAX_COMENTARIO } from '../../models/recado.model';
import { mensagemDeErro } from '../../shared/erros';
import { FotoPessoa } from '../../shared/foto-pessoa';
import { InteracoesService } from './data/interacoes.service';

/** Comentários de uma postagem, em tempo real, com campo para comentar. Exclui o autor ou a diretoria. */
@Component({
  selector: 'app-comentarios-post',
  imports: [DatePipe, FormsModule, ButtonModule, TextareaModule, Send, Trash, FotoPessoa],
  templateUrl: './comentarios-post.html',
  styleUrl: './comentarios-post.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComentariosPost {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly service = inject(InteracoesService);

  readonly recadoId = input.required<string>();
  /** Quantidade mudou (comentou ou excluiu): o mural atualiza o número do post. */
  readonly quantidadeMudou = output<number>();

  protected readonly comentarios = signal<ComId<Comentario>[] | null>(null);
  protected readonly texto = signal('');
  protected readonly enviando = signal(false);
  /** Comentário sendo excluído (carregando no botão dele). */
  protected readonly excluindo = signal<string | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly maximo = MAX_COMENTARIO;
  protected readonly meuUid = computed(() => this.auth.usuario()?.uid ?? null);
  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly podeEnviar = computed(() => {
    const t = this.texto().trim();
    return t.length > 0 && t.length <= MAX_COMENTARIO && !this.enviando();
  });

  private pararDeOuvir: (() => void) | null = null;

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const recadoId = this.recadoId();
      untracked(() => {
        this.pararDeOuvir?.();
        this.comentarios.set(null);
        if (!timeId) return;
        this.pararDeOuvir = this.service.ouvirComentarios(
          timeId,
          recadoId,
          (lista) => {
            this.comentarios.set(lista);
            this.quantidadeMudou.emit(lista.length);
          },
          (e) => {
            this.comentarios.set([]);
            this.erro.set(mensagemDeErro(e));
          },
        );
      });
    });
    inject(DestroyRef).onDestroy(() => this.pararDeOuvir?.());
  }

  protected async enviar(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const usuario = this.auth.usuario();
    if (!timeId || !usuario || !this.podeEnviar()) return;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.service.comentar(timeId, this.recadoId(), this.texto().trim(), {
        uid: usuario.uid,
        nome: this.timeAtual.acesso()?.nome || usuario.nome,
        fotoUrl: usuario.fotoUrl,
      });
      this.texto.set('');
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.enviando.set(false);
    }
  }

  protected async excluir(comentarioId: string): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    this.excluindo.set(comentarioId);
    try {
      await this.service.excluirComentario(timeId, this.recadoId(), comentarioId);
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.excluindo.set(null);
    }
  }

  /** Enter envia; Shift+Enter quebra a linha. */
  protected aoTeclar(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      void this.enviar();
    }
  }
}
