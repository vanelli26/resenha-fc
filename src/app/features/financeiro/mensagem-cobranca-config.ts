import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, submit } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Avisos } from '../../shared/avisos';
import { NOMES_MESES } from '../../shared/competencia';
import { ConfigFinanceiraService, MAX_CHAVE_PIX, MAX_MENSAGEM_COBRANCA } from './data/config-financeira.service';
import { CAMPOS_MENSAGEM, MENSAGEM_COBRANCA_PADRAO, mensagemDeCobranca } from './mensagem-cobranca';

interface FormMensagem {
  chavePix: string;
  mensagem: string;
}

/**
 * Chave Pix e modelo da mensagem de cobrança do WhatsApp (tesouraria, DIRETRIZES 2.5), com prévia.
 * Mensagem igual ao padrão não é gravada: o time segue recebendo melhorias do modelo padrão.
 */
@Component({
  selector: 'app-mensagem-cobranca-config',
  imports: [FormField, ButtonModule, InputTextModule, TextareaModule],
  templateUrl: './mensagem-cobranca-config.html',
  styleUrl: './mensagem-cobranca-config.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MensagemCobrancaConfig {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly service = inject(ConfigFinanceiraService);
  private readonly avisos = inject(Avisos);
  private readonly locale = inject(LOCALE_ID);

  protected readonly campos = CAMPOS_MENSAGEM;
  protected readonly salvando = signal(false);

  protected readonly modelo = signal<FormMensagem>({ chavePix: '', mensagem: MENSAGEM_COBRANCA_PADRAO });
  protected readonly formulario = form(this.modelo, (p) => {
    maxLength(p.chavePix, MAX_CHAVE_PIX, { message: `Máximo de ${MAX_CHAVE_PIX} caracteres.` });
    maxLength(p.mensagem, MAX_MENSAGEM_COBRANCA, { message: `Máximo de ${MAX_MENSAGEM_COBRANCA} caracteres.` });
  });

  private readonly chaveSalva = computed(() => this.timeAtual.time()?.financeiro.chavePix ?? '');
  private readonly mensagemSalva = computed(
    () => this.timeAtual.time()?.financeiro.mensagemCobranca ?? MENSAGEM_COBRANCA_PADRAO,
  );

  protected readonly ehPadrao = computed(() => this.modelo().mensagem.trim() === MENSAGEM_COBRANCA_PADRAO);

  /** Mensagem de exemplo com os dados digitados (antes de salvar). */
  protected readonly previa = computed(() => {
    const hoje = new Date();
    const timeId = this.timeAtual.timeId() ?? '';
    const { chavePix, mensagem } = this.modelo();
    return mensagemDeCobranca({
      timeNome: this.timeAtual.time()?.nome ?? '',
      nome: 'João',
      itens: [
        {
          rotulo: `Mensalidade · ${NOMES_MESES[hoje.getMonth()]}/${hoje.getFullYear()}`,
          valorCentavos: 5000,
          vencimento: new Date(hoje.getFullYear(), hoje.getMonth(), 10),
          atrasada: hoje.getDate() > 10,
        },
      ],
      link: `${location.origin}/t/${timeId}/financeiro/minhas`,
      locale: this.locale,
      modelo: mensagem,
      chavePix,
    });
  });

  constructor() {
    // Recarrega só quando a chave ou a mensagem gravadas mudam (troca de time ou depois de salvar);
    // salvar outra parte da configuração não apaga o que está sendo digitado aqui.
    effect(() => {
      const chavePix = this.chaveSalva();
      const mensagem = this.mensagemSalva();
      untracked(() => this.modelo.set({ chavePix, mensagem }));
    });
  }

  /** Acrescenta o campo ao fim da mensagem. */
  protected inserir(campo: string): void {
    this.modelo.update((m) => ({ ...m, mensagem: `${m.mensagem.trimEnd()} ${campo}` }));
  }

  protected restaurarPadrao(): void {
    this.modelo.update((m) => ({ ...m, mensagem: MENSAGEM_COBRANCA_PADRAO }));
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const { chavePix, mensagem } = this.modelo();
      const texto = mensagem.trim();
      await this.avisos.executar(
        this.salvando,
        () =>
          this.service.atualizar({
            chavePix: chavePix.trim() || undefined,
            mensagemCobranca: !texto || texto === MENSAGEM_COBRANCA_PADRAO ? undefined : texto,
          }),
        'Mensagem de cobrança salva',
        'Não foi possível salvar',
      );
    });
  }
}
