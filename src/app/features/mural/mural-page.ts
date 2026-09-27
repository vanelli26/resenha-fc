import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Recado } from '../../models/recado.model';
import { mensagemDeErro } from '../../shared/erros';
import { FaixaPatrocinadores } from '../patrocinadores/faixa-patrocinadores';
import { ComentariosPost } from './comentarios-post';
import { InteracoesService } from './data/interacoes.service';
import { NovoPost, RecadosService, TAMANHO_PAGINA_MURAL } from './data/recados.service';
import { NovaPostagem } from './nova-postagem';
import { PostCard } from './post-card';

/** Mural do time: feed de postagens com fotos, em tempo real (DIRETRIZES 2.8 e 7). Qualquer membro publica. */
@Component({
  selector: 'app-mural-page',
  imports: [
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    SkeletonModule,
    TextareaModule,
    ComentariosPost,
    FaixaPatrocinadores,
    NovaPostagem,
    PostCard,
  ],
  providers: [ConfirmationService],
  templateUrl: './mural-page.html',
  styleUrl: './mural-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MuralPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly auth = inject(AuthService);
  private readonly recadosService = inject(RecadosService);
  private readonly interacoes = inject(InteracoesService);
  private readonly mensagens = inject(MessageService);
  private readonly confirmacao = inject(ConfirmationService);

  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly meuUid = computed(() => this.auth.usuario()?.uid ?? null);
  protected readonly recados = signal<ComId<Recado>[] | null>(null);
  /** Limite do listener; "Ver mais" soma uma página. */
  private readonly quantidade = signal(TAMANHO_PAGINA_MURAL);
  protected readonly haMais = computed(() => (this.recados()?.length ?? 0) >= this.quantidade());

  protected readonly novaAberta = signal(false);
  protected readonly enviando = signal(false);
  protected readonly enviadas = signal(0);

  protected readonly emEdicao = signal<ComId<Recado> | null>(null);
  protected readonly textoEdicao = signal('');
  protected readonly salvando = signal(false);

  /** Posts que eu curti e contagem de comentários; carregados só para posts ainda não vistos. */
  protected readonly curtidos = signal<ReadonlySet<string>>(new Set());
  protected readonly qtdComentarios = signal<ReadonlyMap<string, number>>(new Map());
  private verificados = new Set<string>();
  /** Post com os comentários abertos. */
  protected readonly comentariosDe = signal<string | null>(null);

  private pararDeOuvir: (() => void) | null = null;

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      const quantidade = this.quantidade();
      untracked(() => {
        this.pararDeOuvir?.();
        this.pararDeOuvir = null;
        if (!timeId) return;
        this.pararDeOuvir = this.recadosService.ouvir(
          timeId,
          quantidade,
          (recados) => this.recados.set(recados),
          (e) => {
            this.recados.set([]);
            this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar o mural', detail: mensagemDeErro(e) });
          },
        );
      });
    });
    // Troca de time: volta à primeira página.
    effect(() => {
      this.timeAtual.timeId();
      untracked(() => {
        this.recados.set(null);
        this.quantidade.set(TAMANHO_PAGINA_MURAL);
        this.novaAberta.set(false);
        this.emEdicao.set(null);
        this.comentariosDe.set(null);
        this.curtidos.set(new Set());
        this.qtdComentarios.set(new Map());
        this.verificados = new Set();
      });
    });
    // Posts novos no feed: minha curtida e nº de comentários (uma leitura + uma contagem por post).
    effect(() => {
      const ids = (this.recados() ?? []).map((r) => r.id).filter((id) => !this.verificados.has(id));
      untracked(() => void this.carregarInteracoes(ids));
    });
    inject(DestroyRef).onDestroy(() => this.pararDeOuvir?.());
  }

  protected async curtir(recadoId: string, curtir: boolean): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const uid = this.meuUid();
    if (!timeId || !uid) return;
    const antes = this.curtidos();
    const depois = new Set(antes);
    if (curtir) depois.add(recadoId);
    else depois.delete(recadoId);
    this.curtidos.set(depois);
    try {
      // O contador do post chega pelo listener do feed.
      await this.interacoes.definirCurtida(timeId, recadoId, uid, curtir);
    } catch (e) {
      this.curtidos.set(antes);
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível curtir', detail: mensagemDeErro(e) });
    }
  }

  protected atualizarQtdComentarios(recadoId: string, quantidade: number): void {
    this.qtdComentarios.update((mapa) => new Map(mapa).set(recadoId, quantidade));
  }

  private async carregarInteracoes(ids: string[]): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const uid = this.meuUid();
    if (!timeId || !uid || ids.length === 0) return;
    ids.forEach((id) => this.verificados.add(id));
    try {
      const [curtidos, contagens] = await Promise.all([
        this.interacoes.minhasCurtidas(timeId, ids, uid),
        this.interacoes.contarComentarios(timeId, ids),
      ]);
      if (this.timeAtual.timeId() !== timeId) return;
      this.curtidos.update((atual) => new Set([...atual, ...curtidos]));
      this.qtdComentarios.update((atual) => new Map([...atual, ...contagens]));
    } catch {
      // Complementos do feed: falha não impede ver as postagens; tenta de novo na próxima carga.
      ids.forEach((id) => this.verificados.delete(id));
    }
  }

  protected verMais(): void {
    this.quantidade.update((q) => q + TAMANHO_PAGINA_MURAL);
  }

  protected async publicar(post: NovoPost): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const usuario = this.auth.usuario();
    if (!timeId || !usuario) return;
    this.enviando.set(true);
    this.enviadas.set(0);
    try {
      await this.recadosService.publicar(
        timeId,
        post,
        { uid: usuario.uid, nome: this.timeAtual.acesso()?.nome || usuario.nome, fotoUrl: usuario.fotoUrl },
        (n) => this.enviadas.set(n),
      );
      this.novaAberta.set(false);
      this.mensagens.add({ severity: 'success', summary: 'Publicado' });
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível publicar', detail: mensagemDeErro(e) });
    } finally {
      this.enviando.set(false);
    }
  }

  protected editar(recado: ComId<Recado>): void {
    this.textoEdicao.set(recado.texto);
    this.emEdicao.set(recado);
  }

  protected async salvarEdicao(): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const recado = this.emEdicao();
    const texto = this.textoEdicao().trim();
    if (!timeId || !recado) return;
    if (!texto && !recado.fotos?.length && !recado.titulo) {
      this.mensagens.add({ severity: 'warn', summary: 'Escreva algo', detail: 'Post sem foto precisa de texto.' });
      return;
    }
    this.salvando.set(true);
    try {
      await this.recadosService.editarTexto(timeId, recado.id, texto);
      this.emEdicao.set(null);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível salvar', detail: mensagemDeErro(e) });
    } finally {
      this.salvando.set(false);
    }
  }

  protected async fixar(recado: ComId<Recado>, fixado: boolean): Promise<void> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    try {
      await this.recadosService.fixar(timeId, recado.id, fixado);
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível concluir', detail: mensagemDeErro(e) });
    }
  }

  protected excluir(recado: ComId<Recado>): void {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return;
    this.confirmacao.confirm({
      header: 'Excluir postagem',
      message: 'Excluir esta postagem e as fotos dela?',
      acceptLabel: 'Excluir',
      rejectLabel: 'Voltar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { text: true },
      accept: async () => {
        try {
          await this.recadosService.excluir(timeId, recado);
          this.mensagens.add({ severity: 'success', summary: 'Postagem excluída' });
        } catch (e) {
          this.mensagens.add({ severity: 'error', summary: 'Não foi possível excluir', detail: mensagemDeErro(e) });
        }
      },
    });
  }
}
