import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, pattern, readonly, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ComId } from '../../core/firebase/conversor';
import { SessaoService } from '../../core/sessao/sessao.service';
import { amostraDaCor } from '../../core/theme/app-theme';
import { CORES_TIME, CorTime, TAMANHO_MAX_ESCUDO, Time } from '../../models/time.model';
import { Escudo } from '../../shared/escudo';
import { mensagemDeErro } from '../../shared/erros';
import { imagemParaDataUrl } from '../../shared/imagem';
import { ROTULO_COR } from '../../shared/rotulos';
import { TimesService } from './data/times.service';

interface FormTime {
  slug: string;
  nome: string;
  cor: CorTime;
}

const FORM_VAZIO: FormTime = { slug: '', nome: '', cor: 'emerald' };

/** Cadastro de times — só adminGeral (rota e Rules). */
@Component({
  selector: 'app-times-admin-page',
  imports: [FormField, RouterLink, ButtonModule, InputTextModule, Escudo],
  templateUrl: './times-admin-page.html',
  styleUrl: './times-admin-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesAdminPage {
  private readonly timesService = inject(TimesService);
  private readonly sessao = inject(SessaoService);
  private readonly mensagens = inject(MessageService);

  protected readonly times = signal<ComId<Time>[]>([]);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly cores = CORES_TIME.map((cor) => ({ cor, rotulo: ROTULO_COR[cor], amostra: amostraDaCor(cor) }));
  protected readonly rotuloCor = ROTULO_COR;

  // Escudo fica fora do formulário: vem de upload, não de digitação.
  protected readonly escudo = signal<string | null>(null);
  protected readonly processandoImagem = signal(false);

  protected readonly modelo = signal<FormTime>({ ...FORM_VAZIO });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.nome, { message: 'Informe o nome.' });
    maxLength(p.nome, 60, { message: 'Máximo de 60 caracteres.' });
    required(p.slug, { message: 'Informe o identificador.' });
    pattern(p.slug, /^[a-z0-9-]{2,40}$/, { message: 'Use 2 a 40 letras minúsculas, números ou hífen.' });
    // Slug é o ID do documento: imutável depois de criado.
    readonly(p.slug, { when: () => this.editandoId() !== null });
  });

  constructor() {
    void this.carregar();
  }

  protected editar(time: ComId<Time>): void {
    this.editandoId.set(time.id);
    // Times antigos (campo `tema`) não têm `cor`: começa na cor base até salvar.
    this.modelo.set({ slug: time.slug, nome: time.nome, cor: time.cor ?? FORM_VAZIO.cor });
    this.escudo.set(time.escudo?.startsWith('data:') ? time.escudo : null);
  }

  protected cancelar(): void {
    this.editandoId.set(null);
    this.modelo.set({ ...FORM_VAZIO });
    this.escudo.set(null);
    this.formulario().reset();
  }

  protected async escolherEscudo(evento: Event): Promise<void> {
    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement)) return;
    const arquivo = campo.files?.[0];
    campo.value = '';
    if (!arquivo) return;
    this.processandoImagem.set(true);
    try {
      this.escudo.set(await imagemParaDataUrl(arquivo, TAMANHO_MAX_ESCUDO));
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Imagem não aceita', detail: mensagemDeErro(e) });
    } finally {
      this.processandoImagem.set(false);
    }
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const { slug, nome, cor } = this.modelo();
      const dados = { nome, cor, escudo: this.escudo() };
      const id = this.editandoId();
      try {
        if (id) {
          await this.timesService.atualizar(id, dados);
        } else {
          await this.timesService.criar(slug, dados);
        }
        this.mensagens.add({ severity: 'success', summary: id ? 'Time atualizado' : 'Time criado' });
        this.cancelar();
        await Promise.all([this.carregar(), this.sessao.carregarMeusTimes()]);
      } catch (e) {
        this.mensagens.add({ severity: 'error', summary: 'Não foi possível salvar', detail: mensagemDeErro(e) });
      }
    });
  }

  private async carregar(): Promise<void> {
    try {
      this.times.set(await this.timesService.listar());
    } catch (e) {
      this.mensagens.add({ severity: 'error', summary: 'Erro ao carregar times', detail: mensagemDeErro(e) });
    }
  }
}
