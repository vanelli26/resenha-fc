import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { ComId } from '../../core/firebase/conversor';
import { PedidoTime } from '../../models/pedido-time.model';
import { TimeGravado } from '../../models/time.model';
import { Avisos } from '../../shared/avisos';
import { Escudo } from '../../shared/escudo';
import { PedidosTimeService } from './data/pedidos-time.service';
import { TimesService } from './data/times.service';
import { DecisaoPedido, PedidosTimeAdmin } from './pedidos-time-admin';

/**
 * Gerenciar times (adminGeral; DIRETRIZES 2.12): aprova ou reprova pedidos de time novo e vê a lista dos times
 * (nome, escudo, endereço, quem pediu). Não entra nos times nem vê caixa e cobranças.
 */
@Component({
  selector: 'app-times-admin-page',
  imports: [DatePipe, SkeletonModule, Escudo, PedidosTimeAdmin],
  templateUrl: './times-admin-page.html',
  styleUrl: './times-admin-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesAdminPage {
  private readonly timesService = inject(TimesService);
  private readonly pedidosService = inject(PedidosTimeService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly listaPedidos = viewChild(PedidosTimeAdmin);

  protected readonly times = signal<ComId<TimeGravado>[]>([]);
  protected readonly carregando = signal(true);
  protected readonly pedidos = signal<ComId<PedidoTime>[]>([]);
  /** Pedido sendo decidido (carregando no botão dele). */
  protected readonly decidindo = signal<string | null>(null);
  private readonly processandoPedido = signal(false);

  /** Quem pediu cada time (times anteriores aos pedidos não têm). */
  protected readonly solicitantes = computed(
    () => new Map(this.pedidos().filter((p) => p.status === 'aprovado').map((p) => [p.id, p.solicitanteNome])),
  );

  constructor() {
    void this.carregar();
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
    this.carregando.set(true);
    try {
      const [times] = await Promise.all([this.timesService.listar(), this.carregarPedidos()]);
      this.times.set(times);
    } catch (e) {
      this.avisos.erro('Erro ao carregar times', e);
    } finally {
      this.carregando.set(false);
    }
  }

  private async carregarPedidos(): Promise<void> {
    try {
      this.pedidos.set(await this.pedidosService.listar());
    } catch (e) {
      this.avisos.erro('Erro ao carregar pedidos', e);
    }
  }
}
