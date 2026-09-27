import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { Pencil } from '@primeicons/angular/pencil';
import { Thumbtack } from '@primeicons/angular/thumbtack';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Recado } from '../../models/recado.model';
import { mensagemDeErro } from '../../shared/erros';
import { DadosRecado, RecadosService } from './data/recados.service';

const VAZIO: DadosRecado = { titulo: '', texto: '', fixado: false };

/** Mural do time: recados da diretoria, em tempo real (DIRETRIZES 2.8 e 7). */
@Component({
  selector: 'app-mural-page',
  imports: [
    DatePipe,
    FormField,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    SkeletonModule,
    TextareaModule,
    ToggleSwitchModule,
    Pencil,
    Thumbtack,
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
  private readonly mensagens = inject(MessageService);
  private readonly confirmacao = inject(ConfirmationService);

  protected readonly ehDiretoria = this.timeAtual.ehDiretoria;
  protected readonly recados = signal<ComId<Recado>[] | null>(null);

  protected readonly dialogAberto = signal(false);
  protected readonly emEdicao = signal<ComId<Recado> | null>(null);
  protected readonly salvando = signal(false);
  protected readonly modelo = signal<DadosRecado>({ ...VAZIO });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.titulo, { message: 'Informe o título.' });
    maxLength(p.titulo, 100, { message: 'Máximo de 100 caracteres.' });
    required(p.texto, { message: 'Escreva o recado.' });
    maxLength(p.texto, 2000, { message: 'Máximo de 2000 caracteres.' });
  });

  private pararDeOuvir: (() => void) | null = null;

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.pararDeOuvir?.();
        this.recados.set(null);
        this.dialogAberto.set(false);
        if (timeId) {
          this.pararDeOuvir = this.recadosService.ouvir(
            timeId,
            (recados) => this.recados.set(recados),
            (e) => {
              this.recados.set([]);
              this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar o mural', detail: mensagemDeErro(e) });
            },
          );
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.pararDeOuvir?.());
  }

  protected novo(): void {
    this.emEdicao.set(null);
    this.modelo.set({ ...VAZIO });
    this.dialogAberto.set(true);
  }

  protected editar(recado: ComId<Recado>): void {
    this.emEdicao.set(recado);
    this.modelo.set({ titulo: recado.titulo, texto: recado.texto, fixado: recado.fixado });
    this.dialogAberto.set(true);
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const timeId = this.timeAtual.timeId();
      const usuario = this.auth.usuario();
      if (!timeId || !usuario) return;
      const f = this.modelo();
      const dados: DadosRecado = { titulo: f.titulo.trim(), texto: f.texto.trim(), fixado: f.fixado };
      const atual = this.emEdicao();
      const autor = { uid: usuario.uid, nome: this.timeAtual.acesso()?.nome || usuario.nome };
      await this.executar(
        () =>
          atual
            ? this.recadosService.atualizar(timeId, atual.id, dados)
            : this.recadosService.criar(timeId, dados, autor),
        atual ? 'Recado atualizado' : 'Recado publicado',
      );
    });
  }

  protected excluir(): void {
    const timeId = this.timeAtual.timeId();
    const atual = this.emEdicao();
    if (!timeId || !atual) return;
    this.confirmacao.confirm({
      header: 'Excluir recado',
      message: `Excluir "${atual.titulo}" do mural?`,
      acceptLabel: 'Excluir',
      rejectLabel: 'Voltar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { text: true },
      accept: () => void this.executar(() => this.recadosService.excluir(timeId, atual.id), 'Recado excluído'),
    });
  }

  /** O listener atualiza a lista; aqui só fecha o diálogo e avisa. */
  private async executar(acao: () => Promise<void>, sucesso: string): Promise<void> {
    this.salvando.set(true);
    try {
      await acao();
      this.dialogAberto.set(false);
      this.mensagens.add({ severity: 'success', summary: sucesso });
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Não foi possível concluir', detail: mensagemDeErro(e) });
    } finally {
      this.salvando.set(false);
    }
  }
}
