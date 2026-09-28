import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormField, form, maxLength, pattern, readonly, required, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { SessaoService } from '../../core/sessao/sessao.service';
import { ESPORTES, ESPORTES_PADRAO, Esporte } from '../../models/posicao.model';
import { PedidoTime } from '../../models/pedido-time.model';
import { CorTime, TimeGravado } from '../../models/time.model';
import { Avisos } from '../../shared/avisos';
import { Escudo } from '../../shared/escudo';
import { EscolhaEscudo, SeletorEscudo } from '../../shared/seletor-escudo';
import { ROTULO_ESPORTE, opcoes } from '../../shared/rotulos';
import { SeletorCor } from '../../shared/seletor-cor';
import { PADRAO_SLUG } from '../../shared/slug';
import { PedidosTimeService } from './data/pedidos-time.service';
import { TimesService } from './data/times.service';
import { DecisaoPedido, PedidosTimeAdmin } from './pedidos-time-admin';

interface FormTime {
  slug: string;
  nome: string;
  cor: CorTime;
  esportes: Esporte[];
}

const FORM_VAZIO: FormTime = { slug: '', nome: '', cor: 'emerald', esportes: [...ESPORTES_PADRAO] };

/** Cadastro de times — só adminGeral (rota e Rules). */
@Component({
  selector: 'app-times-admin-page',
  imports: [
    FormField,
    RouterLink,
    ButtonModule,
    InputTextModule,
    SelectButtonModule,
    Escudo,
    PedidosTimeAdmin,
    SeletorCor,
    SeletorEscudo,
  ],
  templateUrl: './times-admin-page.html',
  styleUrl: './times-admin-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesAdminPage {
  private readonly timesService = inject(TimesService);
  private readonly sessao = inject(SessaoService);
  private readonly avisos = inject(Avisos);
  private readonly auth = inject(AuthService);
  private readonly pedidosService = inject(PedidosTimeService);
  private readonly listaPedidos = viewChild(PedidosTimeAdmin);

  protected readonly pedidos = signal<ComId<PedidoTime>[]>([]);
  /** Pedido sendo decidido (carregando no botão dele). */
  protected readonly decidindo = signal<string | null>(null);
  private readonly processandoPedido = signal(false);

  protected readonly times = signal<ComId<TimeGravado>[]>([]);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly opcoesEsporte = opcoes(ESPORTES, ROTULO_ESPORTE);

  // Escudo fica fora do formulário: vem de upload, não de digitação.
  /** Escudo gravado do time em edição (null = sem escudo ou time novo). */
  protected readonly escudoOriginal = signal<string | null>(null);
  protected readonly escolhaEscudo = signal<EscolhaEscudo>({ tipo: 'manter' });
  private readonly seletorEscudo = viewChild(SeletorEscudo);
  protected readonly processandoImagem = computed(() => this.seletorEscudo()?.processando() ?? false);

  protected readonly modelo = signal<FormTime>({ ...FORM_VAZIO });
  protected readonly formulario = form(this.modelo, (p) => {
    required(p.nome, { message: 'Informe o nome.' });
    maxLength(p.nome, 60, { message: 'Máximo de 60 caracteres.' });
    required(p.slug, { message: 'Informe o identificador.' });
    pattern(p.slug, PADRAO_SLUG, { message: 'Use 2 a 40 letras minúsculas, números ou hífen.' });
    // Slug é o ID do documento: imutável depois de criado.
    readonly(p.slug, { when: () => this.editandoId() !== null });
    validate(p.esportes, ({ value }) =>
      value().length > 0 ? undefined : { kind: 'esportes', message: 'Escolha ao menos um esporte.' },
    );
  });

  constructor() {
    void this.carregar();
  }

  protected editar(time: ComId<TimeGravado>): void {
    this.editandoId.set(time.id);
    // Times antigos (campo `tema`) não têm `cor`: começa na cor base até salvar.
    this.modelo.set({
      slug: time.slug,
      nome: time.nome,
      cor: time.cor ?? FORM_VAZIO.cor,
      esportes: [...(time.esportes ?? ESPORTES_PADRAO)],
    });
    this.escudoOriginal.set(time.escudo);
    this.escolhaEscudo.set({ tipo: 'manter' });
  }

  protected cancelar(): void {
    this.editandoId.set(null);
    this.modelo.set({ ...FORM_VAZIO, esportes: [...FORM_VAZIO.esportes] });
    this.escudoOriginal.set(null);
    this.escolhaEscudo.set({ tipo: 'manter' });
    this.formulario().reset();
  }

  protected salvar(): void {
    void submit(this.formulario, async () => {
      const { slug, nome, cor, esportes } = this.modelo();
      const id = this.editandoId();
      try {
        await this.timesService.gravarComEscudo(id ?? slug, this.escudoOriginal(), this.escolhaEscudo(), (escudo) =>
          id
            ? this.timesService.atualizar(id, { nome, cor, esportes, escudo })
            : this.timesService.criar(slug, { nome, cor, esportes, escudo }),
        );
        this.avisos.sucesso(id ? 'Time atualizado' : 'Time criado');
        this.cancelar();
        await Promise.all([this.carregar(), this.sessao.carregarMeusTimes()]);
      } catch (e) {
        this.avisos.erro('Não foi possível salvar', e);
      }
    });
  }

  protected async decidir({ pedido, aprovado, motivo }: DecisaoPedido): Promise<void> {
    const uid = this.auth.usuario()?.uid;
    if (!uid) return;
    this.decidindo.set(pedido.id);
    const ok = await this.avisos.executar(
      this.processandoPedido,
      () => this.pedidosService.decidir(pedido.id, aprovado, motivo, uid),
      aprovado ? `${pedido.nome} aprovado` : `${pedido.nome} reprovado`,
    );
    this.decidindo.set(null);
    if (!ok) return;
    this.listaPedidos()?.fecharReprovacao();
    await this.carregarPedidos();
  }

  private async carregar(): Promise<void> {
    try {
      this.times.set(await this.timesService.listar());
    } catch (e) {
      this.avisos.erro('Erro ao carregar times', e);
    }
    await this.carregarPedidos();
  }

  private async carregarPedidos(): Promise<void> {
    try {
      this.pedidos.set(await this.pedidosService.listar());
    } catch (e) {
      this.avisos.erro('Erro ao carregar pedidos', e);
    }
  }
}
