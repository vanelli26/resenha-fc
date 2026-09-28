import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth/auth.service';
import { SessaoService } from '../../core/sessao/sessao.service';
import { PedidoTime } from '../../models/pedido-time.model';
import { Avisos } from '../../shared/avisos';
import { Escudo } from '../../shared/escudo';
import { ROTULO_PAPEL } from '../../shared/rotulos';
import { ComId } from '../../core/firebase/conversor';
import { Evento } from '../../models/evento.model';
import { EventosService } from '../agenda/data/eventos.service';
import { CobrancasService } from '../financeiro/data/cobrancas.service';
import { NovoPedidoTime, PedidosTimeService } from '../times/data/pedidos-time.service';
import { PedidoTimeForm } from '../times/pedido-time-form';

@Component({
  selector: 'app-inicio-page',
  imports: [DatePipe, RouterLink, ButtonModule, DialogModule, SkeletonModule, TagModule, Escudo, ChevronRight, PedidoTimeForm],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage {
  private readonly sessao = inject(SessaoService);
  private readonly cobrancasService = inject(CobrancasService);
  private readonly eventosService = inject(EventosService);
  private readonly auth = inject(AuthService);
  private readonly pedidosService = inject(PedidosTimeService);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);

  protected readonly meusTimes = this.sessao.meusTimes;
  protected readonly carregando = this.sessao.carregandoTimes;
  protected readonly adminGeral = this.sessao.adminGeral;
  protected readonly rotuloPapel = ROTULO_PAPEL;
  /** Cobranças pendentes do meu atleta, por time (só times em que estou no elenco). */
  protected readonly pendentes = signal<ReadonlyMap<string, number>>(new Map());
  /** Próximo evento agendado de cada time (uma consulta por time, limit 1). */
  protected readonly proximos = signal<ReadonlyMap<string, ComId<Evento>>>(new Map());

  /** Pedidos de time da própria pessoa (DIRETRIZES 2.12); aprovado e já criado some (o time aparece acima). */
  private readonly pedidos = signal<ComId<PedidoTime>[]>([]);
  protected readonly pedidosVisiveis = computed(() => {
    const meus = new Set(this.meusTimes().map((t) => t.timeId));
    return this.pedidos().filter((p) => !(p.status === 'aprovado' && meus.has(p.id)));
  });
  protected readonly dialogPedido = signal(false);
  protected readonly enviandoPedido = signal(false);
  /** Pedido com ação em andamento (criar time, dispensar). */
  protected readonly pedidoOcupado = signal<string | null>(null);
  private readonly processandoPedido = signal(false);

  constructor() {
    effect(() => {
      const uid = this.auth.usuario()?.uid;
      untracked(() => {
        this.pedidos.set([]);
        if (uid) void this.carregarPedidos(uid);
      });
    });
    effect(() => {
      const times = this.sessao.meusTimes().filter((t) => t.atletaId !== null);
      untracked(() => void this.contarPendentes(times));
    });
    effect(() => {
      const ids = this.sessao.meusTimes().map((t) => t.timeId);
      untracked(() => void this.carregarProximos(ids));
    });
  }

  protected async pedir(pedido: NovoPedidoTime): Promise<void> {
    const usuario = this.auth.usuario();
    if (!usuario) return;
    this.enviandoPedido.set(true);
    try {
      await this.pedidosService.pedir(pedido, usuario);
      this.dialogPedido.set(false);
      this.avisos.sucesso('Pedido enviado', 'Você será avisado aqui quando for aprovado.');
      await this.carregarPedidos(usuario.uid);
    } catch (e) {
      // Endereço de time existente ou de outro pedido: as Rules negam a criação.
      if (e instanceof FirebaseError && e.code === 'permission-denied') {
        this.avisos.atencao('Esse endereço já está em uso. Escolha outro.', 'Endereço indisponível');
      } else {
        this.avisos.erro('Não foi possível enviar o pedido', e);
      }
    } finally {
      this.enviandoPedido.set(false);
    }
  }

  /** Pedido aprovado: cria o time e abre a Gestão dele. */
  protected async criarTime(pedido: ComId<PedidoTime>): Promise<void> {
    const usuario = this.auth.usuario();
    if (!usuario) return;
    this.pedidoOcupado.set(pedido.id);
    const ok = await this.avisos.executar(
      this.processandoPedido,
      () => this.pedidosService.criarTime(pedido, usuario),
      `${pedido.nome} criado`,
      'Não foi possível criar o time',
    );
    this.pedidoOcupado.set(null);
    if (!ok) return;
    await this.sessao.carregarMeusTimes();
    await this.router.navigate(['/t', pedido.id, 'gestao']);
  }

  protected async dispensar(pedido: ComId<PedidoTime>): Promise<void> {
    const uid = this.auth.usuario()?.uid;
    if (!uid) return;
    this.pedidoOcupado.set(pedido.id);
    const ok = await this.avisos.executar(this.processandoPedido, () => this.pedidosService.dispensar(pedido.id), null);
    this.pedidoOcupado.set(null);
    if (ok) this.pedidos.update((lista) => lista.filter((p) => p.id !== pedido.id));
  }

  /** Complemento da tela: falha não impede ver os times. */
  private async carregarPedidos(uid: string): Promise<void> {
    try {
      const lista = await this.pedidosService.meus(uid);
      if (this.auth.usuario()?.uid === uid) this.pedidos.set(lista);
    } catch {
      this.pedidos.set([]);
    }
  }

  /** Falha em um time (ex.: índice ainda sendo criado) não impede os outros. */
  private async carregarProximos(timeIds: string[]): Promise<void> {
    const agora = new Date();
    const pares = await Promise.all(
      timeIds.map(async (timeId): Promise<[string, ComId<Evento> | null]> => {
        try {
          return [timeId, await this.eventosService.proximoAgendado(timeId, agora)];
        } catch {
          return [timeId, null];
        }
      }),
    );
    const mapa = new Map<string, ComId<Evento>>();
    for (const [timeId, evento] of pares) if (evento) mapa.set(timeId, evento);
    this.proximos.set(mapa);
  }

  /** Uma contagem no servidor por time; falha em um time não impede os outros. */
  private async contarPendentes(times: { timeId: string; atletaId: string | null }[]): Promise<void> {
    const contagens = await Promise.all(
      times.map(async ({ timeId, atletaId }): Promise<[string, number]> => {
        if (!atletaId) return [timeId, 0];
        try {
          return [timeId, await this.cobrancasService.contarPendentesDoAtleta(timeId, atletaId)];
        } catch {
          return [timeId, 0];
        }
      }),
    );
    this.pendentes.set(new Map(contagens));
  }
}
