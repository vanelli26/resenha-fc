import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthService } from '../../core/auth/auth.service';
import { SessaoService } from '../../core/sessao/sessao.service';
import { mensagemDeErro } from '../../shared/erros';
import { SolicitacoesService } from '../solicitacoes/data/solicitacoes.service';
import { ConvitesService, conviteValido } from './data/convites.service';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'invalido' }
  | { tipo: 'membro'; timeNome: string }
  | { tipo: 'pedir'; timeNome: string; expiraEm: Date }
  | { tipo: 'pendente'; timeNome: string }
  | { tipo: 'recusada'; timeNome: string };

/** /convite/:timeId/:codigo — quem recebeu o link pede para entrar no time (DIRETRIZES 2.11). */
@Component({
  selector: 'app-entrar-convite-page',
  imports: [DatePipe, RouterLink, ButtonModule, MessageModule, ProgressSpinnerModule],
  templateUrl: './entrar-convite-page.html',
  styleUrl: './entrar-convite-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrarConvitePage implements OnInit {
  // Parâmetros da rota (withComponentInputBinding).
  readonly timeId = input.required<string>();
  readonly codigo = input.required<string>();

  private readonly auth = inject(AuthService);
  private readonly sessao = inject(SessaoService);
  private readonly convitesService = inject(ConvitesService);
  private readonly solicitacoesService = inject(SolicitacoesService);

  protected readonly estado = signal<Estado>({ tipo: 'carregando' });
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  ngOnInit(): void {
    void this.carregar();
  }

  protected async pedirEntrada(): Promise<void> {
    const usuario = this.auth.usuario();
    const estado = this.estado();
    if (!usuario || estado.tipo !== 'pedir') return;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.solicitacoesService.criar(this.timeId(), this.codigo(), usuario);
      this.estado.set({ tipo: 'pendente', timeNome: estado.timeNome });
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.enviando.set(false);
    }
  }

  private async carregar(): Promise<void> {
    const uid = this.auth.usuario()?.uid;
    if (!uid) return;
    try {
      const convite = await this.convitesService.obter(this.timeId(), this.codigo());
      if (!convite) {
        this.estado.set({ tipo: 'invalido' });
        return;
      }
      await this.sessao.carregarMeusTimes();
      if (this.sessao.meusTimes().some((t) => t.timeId === this.timeId() && t.papeis.length > 0)) {
        this.estado.set({ tipo: 'membro', timeNome: convite.timeNome });
        return;
      }
      const solicitacao = await this.solicitacoesService.obterMinha(this.timeId(), uid);
      if (solicitacao?.status === 'pendente') {
        this.estado.set({ tipo: 'pendente', timeNome: convite.timeNome });
      } else if (solicitacao?.status === 'recusada') {
        this.estado.set({ tipo: 'recusada', timeNome: convite.timeNome });
      } else {
        this.estado.set(
          conviteValido(convite)
            ? { tipo: 'pedir', timeNome: convite.timeNome, expiraEm: convite.expiraEm.toDate() }
            : { tipo: 'invalido' },
        );
      }
    } catch {
      this.estado.set({ tipo: 'invalido' });
    }
  }
}
