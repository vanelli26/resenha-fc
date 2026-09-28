import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { ISENTO, PERIODICIDADES, Periodicidade } from '../../models/modalidade.model';
import { PlanoCobranca } from '../../models/time.model';
import { Avisos, confirmacaoPadrao } from '../../shared/avisos';
import { ReaisPipe, centavosParaReais, reaisParaCentavos } from '../../shared/dinheiro';
import { ROTULO_PERIODICIDADE, opcoes } from '../../shared/rotulos';
import { ConfigFinanceiraService, MAX_PLANOS, novoIdConfiguracao } from './data/config-financeira.service';

interface FormPlano {
  nome: string;
  periodicidade: Periodicidade;
  valor: number;
}

const VAZIO: FormPlano = { nome: '', periodicidade: 'mensal', valor: 0 };

/** Planos de cobrança do time (ex.: Atleta semestral, Sócio semestral, Torcedor mensal). */
@Component({
  selector: 'app-planos-cobranca',
  imports: [
    FormField,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    ReaisPipe,
  ],
  providers: [ConfirmationService],
  templateUrl: './planos-cobranca.html',
  styleUrl: './despesas-recorrentes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanosCobranca {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly service = inject(ConfigFinanceiraService);
  private readonly avisos = inject(Avisos);
  private readonly confirmacao = inject(ConfirmationService);

  /** Quantas pessoas usam cada plano (id → total); null enquanto carrega. */
  readonly usoPorPlano = input<ReadonlyMap<string, number> | null>(null);

  protected readonly planos = computed(() => this.timeAtual.planos());
  protected readonly podeAdicionar = computed(() => this.planos().length < MAX_PLANOS);
  protected readonly maximo = MAX_PLANOS;
  protected readonly rotuloPeriodicidade = ROTULO_PERIODICIDADE;
  protected readonly opcoesPeriodicidade = opcoes(PERIODICIDADES, ROTULO_PERIODICIDADE);

  protected readonly dialogAberto = signal(false);
  protected readonly emEdicao = signal<PlanoCobranca | null>(null);
  protected readonly salvando = signal(false);
  /** Remoção em andamento (carregando no botão Remover; Salvar fica desabilitado). */
  protected readonly removendo = signal(false);
  /** Pessoas no plano em edição (bloqueia a remoção). */
  protected readonly usoDoEmEdicao = computed(() => {
    const id = this.emEdicao()?.id;
    return id ? (this.usoPorPlano()?.get(id) ?? 0) : 0;
  });

  protected readonly modelo = signal<FormPlano>({ ...VAZIO });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.nome, { message: 'Informe o nome.' });
    maxLength(p.nome, 40, { message: 'Máximo de 40 caracteres.' });
    // O nome vira categoria no caixa: não pode repetir (nem "isento").
    validate(p.nome, ({ value }) => {
      const nome = value().trim();
      const idAtual = this.emEdicao()?.id;
      const repetido =
        nome.localeCompare(ISENTO, 'pt-BR', { sensitivity: 'base' }) === 0 ||
        this.planos().some(
          (pl) => pl.id !== idAtual && pl.nome.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0,
        );
      return repetido ? { kind: 'repetido', message: 'Já existe um plano com esse nome.' } : undefined;
    });
    validate(p.valor, ({ value }) => ((value() ?? 0) > 0 ? undefined : { kind: 'valor', message: 'Informe o valor.' }));
  });

  protected adicionar(): void {
    this.emEdicao.set(null);
    this.modelo.set({ ...VAZIO });
    this.dialogAberto.set(true);
  }

  protected editar(plano: PlanoCobranca): void {
    this.emEdicao.set(plano);
    this.modelo.set({ nome: plano.nome, periodicidade: plano.periodicidade, valor: centavosParaReais(plano.valorCentavos) });
    this.dialogAberto.set(true);
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const f = this.modelo();
      const atual = this.emEdicao();
      const plano: PlanoCobranca = {
        id: atual?.id ?? novoIdConfiguracao(),
        nome: f.nome.trim(),
        periodicidade: f.periodicidade,
        valorCentavos: reaisParaCentavos(f.valor),
      };
      const lista = atual ? this.planos().map((p) => (p.id === atual.id ? plano : p)) : [...this.planos(), plano];
      if (await this.gravar(lista, atual ? 'Plano atualizado' : 'Plano criado')) this.dialogAberto.set(false);
    });
  }

  protected remover(): void {
    const atual = this.emEdicao();
    if (!atual || this.usoDoEmEdicao() > 0) return;
    this.confirmacao.confirm(
      confirmacaoPadrao({
        titulo: 'Remover plano',
        mensagem: `Remover "${atual.nome}"? Cobranças já geradas continuam como estão.`,
        rotulo: 'Remover',
        aoConfirmar: async () => {
          const lista = this.planos().filter((p) => p.id !== atual.id);
          if (await this.gravar(lista, 'Plano removido', this.removendo)) this.dialogAberto.set(false);
        },
      }),
    );
  }

  private gravar(planos: PlanoCobranca[], sucesso: string, ocupado = this.salvando): Promise<boolean> {
    return this.avisos.executar(
      ocupado,
      () => this.service.atualizar({ planos }),
      sucesso,
      'Não foi possível salvar',
    );
  }
}
