import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { ComId } from '../../core/firebase/conversor';
import { TimeAtualService } from '../../core/time/time-atual.service';
import { Atleta, vinculoDe } from '../../models/atleta.model';
import { Avisos } from '../../shared/avisos';
import { deDataInput, paraDataInput, referenciaMensal } from '../../shared/competencia';
import { ReaisPipe, ratearCentavos, reaisParaCentavos } from '../../shared/dinheiro';
import { ROTULO_VINCULO } from '../../shared/rotulos';
import { Voltar } from '../../shared/voltar';
import { AtletasService } from '../elenco/data/atletas.service';
import { CobrancasService, NovaCobranca, referenciaDeRateio } from './data/cobrancas.service';

type ModoValor = 'total' | 'pessoa';

interface FormRateio {
  descricao: string;
  modo: ModoValor;
  valor: number;
  vencimento: string;
}

/**
 * Cobrança rateada (tesouraria, DIRETRIZES 2.5): despesa dividida entre os cadastros ativos escolhidos
 * (ex.: janta). Valor total dividido igualmente ou valor por pessoa; a descrição vira o nome da cobrança.
 */
@Component({
  selector: 'app-rateio-page',
  imports: [
    FormsModule,
    FormField,
    ButtonModule,
    CheckboxModule,
    InputNumberModule,
    InputTextModule,
    SelectButtonModule,
    SkeletonModule,
    ReaisPipe,
    Voltar,
  ],
  templateUrl: './rateio-page.html',
  styleUrl: './rateio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RateioPage {
  private readonly timeAtual = inject(TimeAtualService);
  private readonly atletasService = inject(AtletasService);
  private readonly cobrancasService = inject(CobrancasService);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);

  protected readonly opcoesModo: { label: string; value: ModoValor }[] = [
    { label: 'Total a dividir', value: 'total' },
    { label: 'Valor por pessoa', value: 'pessoa' },
  ];
  protected readonly rotuloVinculo = ROTULO_VINCULO;

  protected readonly modelo = signal<FormRateio>({
    descricao: '',
    modo: 'total',
    valor: 0,
    vencimento: paraDataInput(new Date()),
  });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.descricao, { message: 'Informe a descrição (ex.: Janta 08/11).' });
    // Vai para planoNome da cobrança e categoria da receita (limite das Rules).
    maxLength(p.descricao, 40, { message: 'Máximo de 40 caracteres.' });
    validate(p.valor, ({ value }) => ((value() ?? 0) > 0 ? undefined : { kind: 'valor', message: 'Informe o valor.' }));
    required(p.vencimento, { message: 'Informe o vencimento.' });
  });

  private readonly cadastros = signal<ComId<Atleta>[]>([]);
  protected readonly carregando = signal(true);
  protected readonly gerando = signal(false);
  protected readonly busca = signal('');
  protected readonly selecionados = signal<ReadonlySet<string>>(new Set());

  /** Cadastro ativo (atletas, sócios e colaboradores), por nome. */
  protected readonly ativos = computed(() =>
    this.cadastros()
      .filter((a) => a.status === 'ativo')
      .sort((a, b) => this.nome(a).localeCompare(this.nome(b), 'pt-BR')),
  );
  protected readonly visiveis = computed(() => {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    return termo
      ? this.ativos().filter((a) => `${a.nome} ${a.apelido}`.toLocaleLowerCase('pt-BR').includes(termo))
      : this.ativos();
  });

  /** Valor de cada selecionado, na ordem da lista (centavos que sobram do rateio vão para os primeiros). */
  protected readonly valores = computed<ReadonlyMap<string, number>>(() => {
    const ids = this.ativos()
      .filter((a) => this.selecionados().has(a.id))
      .map((a) => a.id);
    const { modo, valor } = this.modelo();
    const centavos = reaisParaCentavos(valor);
    const partes = modo === 'total' ? ratearCentavos(centavos, ids.length) : ids.map(() => centavos);
    return new Map(ids.map((id, i) => [id, partes[i]]));
  });
  protected readonly total = computed(() => [...this.valores().values()].reduce((s, v) => s + v, 0));
  /** Total menor que um centavo por pessoa: alguém ficaria com cobrança zerada. */
  protected readonly valorInsuficiente = computed(() => [...this.valores().values()].some((v) => v <= 0));

  constructor() {
    effect(() => {
      const timeId = this.timeAtual.timeId();
      untracked(() => {
        this.cadastros.set([]);
        this.selecionados.set(new Set());
        if (timeId) void this.carregar(timeId);
      });
    });
  }

  protected nome(a: Atleta): string {
    return a.apelido || a.nome;
  }

  protected vinculo(a: Atleta) {
    return vinculoDe(a);
  }

  protected alternar(atletaId: string, marcado: boolean): void {
    this.selecionados.update((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(atletaId);
      else novo.delete(atletaId);
      return novo;
    });
  }

  /** Marca todos os visíveis (respeita a busca) ou limpa tudo. */
  protected marcarTodos(marcar: boolean): void {
    this.selecionados.set(marcar ? new Set([...this.selecionados(), ...this.visiveis().map((a) => a.id)]) : new Set());
  }

  protected gerar(): void {
    void submit(this.formulario, async () => {
      const timeId = this.timeAtual.timeId();
      if (!timeId || this.selecionados().size === 0 || this.valorInsuficiente()) return;
      const { descricao, vencimento } = this.modelo();
      const data = deDataInput(vencimento);
      const referencia = referenciaDeRateio();
      const valores = this.valores();
      const novas: NovaCobranca[] = this.ativos()
        .filter((a) => valores.has(a.id))
        .map((a) => ({
          atletaId: a.id,
          atletaNome: a.nome,
          tipo: 'avulso',
          referencia,
          valorCentavos: valores.get(a.id) ?? 0,
          vencimento: data,
          planoNome: descricao.trim(),
        }));

      this.gerando.set(true);
      try {
        await this.cobrancasService.gerar(timeId, novas);
        this.avisos.sucesso(`${novas.length} cobrança(s) gerada(s)`);
        // Abre Cobranças no mês do vencimento, onde as novas aparecem.
        await this.router.navigate(['/t', timeId, 'financeiro', 'cobrancas'], {
          queryParams: { periodo: referenciaMensal(data) },
        });
      } catch (e) {
        this.avisos.erro('Não foi possível gerar', e);
      } finally {
        this.gerando.set(false);
      }
    });
  }

  private async carregar(timeId: string): Promise<void> {
    this.carregando.set(true);
    try {
      const dados = await this.atletasService.listar(timeId);
      if (this.timeAtual.timeId() === timeId) this.cadastros.set(dados);
    } catch (e) {
      this.avisos.erro('Erro ao carregar o cadastro', e);
    } finally {
      this.carregando.set(false);
    }
  }
}
