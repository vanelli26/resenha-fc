import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { ArrowDown } from '@primeicons/angular/arrow-down';
import { ArrowUp } from '@primeicons/angular/arrow-up';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { MAX_PATROCINADORES, Patrocinador, TAMANHO_MAX_LOGO } from '../../models/patrocinador.model';
import { Avisos, confirmacaoPadrao } from '../../shared/avisos';
import { imagemParaDataUrl } from '../../shared/imagem';
import { Voltar } from '../../shared/voltar';
import { PatrocinadoresService, normalizarLink } from './data/patrocinadores.service';
import { LogoPatrocinador } from './logo-patrocinador';

interface FormPatrocinador {
  nome: string;
  link: string;
}

/** Apoiadores e patrocinadores do time (diretoria). Aparecem na faixa do topo do mural. */
@Component({
  selector: 'app-patrocinadores-page',
  imports: [
    FormField,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    SkeletonModule,
    ArrowDown,
    ArrowUp,
    LogoPatrocinador,
    Voltar,
  ],
  providers: [ConfirmationService],
  templateUrl: './patrocinadores-page.html',
  styleUrl: './patrocinadores-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatrocinadoresPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly service = inject(PatrocinadoresService);
  private readonly avisos = inject(Avisos);
  private readonly confirmacao = inject(ConfirmationService);

  protected readonly lista = signal<ComId<Patrocinador>[] | null>(null);
  protected readonly podeAdicionar = computed(() => (this.lista()?.length ?? 0) < MAX_PATROCINADORES);
  protected readonly maximo = MAX_PATROCINADORES;
  protected readonly processando = signal(false);
  /** Remoção em andamento (carregando no botão Remover; Salvar fica desabilitado). */
  protected readonly removendo = signal(false);

  protected readonly dialogAberto = signal(false);
  protected readonly emEdicao = signal<ComId<Patrocinador> | null>(null);
  protected readonly logo = signal<string | null>(null);
  protected readonly processandoImagem = signal(false);
  protected readonly modelo = signal<FormPatrocinador>({ nome: '', link: '' });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.nome, { message: 'Informe o nome.' });
    maxLength(p.nome, 60, { message: 'Máximo de 60 caracteres.' });
    maxLength(p.link, 500, { message: 'Link muito longo.' });
    pattern(p.link, /^\S*$/, { message: 'O link não pode ter espaços.' });
  });

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.lista.set(null);
        this.dialogAberto.set(false);
        if (timeId) void this.carregar(timeId);
      });
    });
  }

  protected novo(): void {
    this.emEdicao.set(null);
    this.modelo.set({ nome: '', link: '' });
    this.logo.set(null);
    this.dialogAberto.set(true);
  }

  protected editar(p: ComId<Patrocinador>): void {
    this.emEdicao.set(p);
    this.modelo.set({ nome: p.nome, link: p.link ?? '' });
    this.logo.set(p.logo);
    this.dialogAberto.set(true);
  }

  protected async escolherLogo(evento: Event): Promise<void> {
    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement)) return;
    const arquivo = campo.files?.[0];
    campo.value = '';
    if (!arquivo) return;
    this.processandoImagem.set(true);
    try {
      this.logo.set(await imagemParaDataUrl(arquivo, TAMANHO_MAX_LOGO));
    } catch (e) {
      this.avisos.erro('Imagem não aceita', e);
    } finally {
      this.processandoImagem.set(false);
    }
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const timeId = this.timeAtual.timeId();
      if (!timeId) return;
      const f = this.modelo();
      const dados = { nome: f.nome.trim(), logo: this.logo(), link: normalizarLink(f.link) };
      const atual = this.emEdicao();
      const ok = await this.executar(
        () =>
          atual
            ? this.service.atualizar(timeId, atual.id, dados)
            : this.service.criar(timeId, dados, this.lista()?.length ?? 0),
        atual ? 'Apoiador atualizado' : 'Apoiador adicionado',
      );
      if (ok) this.dialogAberto.set(false);
    });
  }

  protected excluir(): void {
    const timeId = this.timeAtual.timeId();
    const atual = this.emEdicao();
    if (!timeId || !atual) return;
    this.confirmacao.confirm(
      confirmacaoPadrao({
        titulo: 'Remover apoiador',
        mensagem: `Remover "${atual.nome}" do mural?`,
        rotulo: 'Remover',
        aoConfirmar: async () => {
          if (await this.executar(() => this.service.excluir(timeId, atual.id), 'Apoiador removido', this.removendo)) {
            this.dialogAberto.set(false);
          }
        },
      }),
    );
  }

  /** Troca de lugar com o vizinho (−1 sobe, +1 desce) e regrava a ordem de todos. */
  protected async mover(indice: number, direcao: -1 | 1): Promise<void> {
    const timeId = this.timeAtual.timeId();
    const lista = [...(this.lista() ?? [])];
    const destino = indice + direcao;
    if (!timeId || destino < 0 || destino >= lista.length) return;
    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
    this.lista.set(lista);
    await this.executar(() => this.service.reordenar(timeId, lista.map((p) => p.id)), null);
  }

  /** Recarrega mesmo se falhar: a reordenação otimista precisa voltar ao que está gravado. */
  private async executar(acao: () => Promise<void>, sucesso: string | null, ocupado = this.processando): Promise<boolean> {
    const timeId = this.timeAtual.timeId();
    if (!timeId) return false;
    const ok = await this.avisos.executar(ocupado, acao, sucesso);
    await this.carregar(timeId);
    return ok;
  }

  private async carregar(timeId: string): Promise<void> {
    try {
      const lista = await this.service.listar(timeId);
      if (this.timeAtual.timeId() === timeId) this.lista.set(lista);
    } catch (e) {
      this.avisos.erro('Erro ao carregar apoiadores', e);
    }
  }
}
