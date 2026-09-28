import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { Cog } from '@primeicons/angular/cog';
import { Mobile } from '@primeicons/angular/mobile';
import { Moon } from '@primeicons/angular/moon';
import { SignOut } from '@primeicons/angular/sign-out';
import { Sun } from '@primeicons/angular/sun';
import { AuthService } from '../auth/auth.service';
import { AtualizacaoApp } from '../pwa/atualizacao-app.service';
import { InstalacaoApp } from '../pwa/instalacao-app.service';
import { SessaoService } from '../sessao/sessao.service';
import { ModoTemaService } from '../theme/modo-tema.service';
import { TimeAtualService } from '../time/time-atual.service';
import { Escudo } from '../../shared/escudo';
import { FotoPessoa } from '../../shared/foto-pessoa';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    FormsModule,
    ButtonModule,
    DialogModule,
    MenuModule,
    SelectModule,
    ToastModule,
    Escudo,
    FotoPessoa,
    Logo,
    Cog,
    Mobile,
    Sun,
    Moon,
    SignOut,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly sessao = inject(SessaoService);
  private readonly timeAtual = inject(TimeAtualService);
  private readonly modoTema = inject(ModoTemaService);
  private readonly router = inject(Router);
  private readonly instalacao = inject(InstalacaoApp);
  protected readonly atualizacao = inject(AtualizacaoApp);

  protected readonly usuario = this.auth.usuario;
  protected readonly meusTimes = this.sessao.meusTimes;
  protected readonly timeId = this.timeAtual.timeId;
  /** Instruções de instalação no iPhone (Safari não tem pedido nativo). */
  protected readonly instrucoesIos = signal(false);

  // `icon` é só a chave do ícone SVG desenhado no template do menu.
  protected readonly menuUsuario = computed<MenuItem[]>(() => [
    {
      label: this.usuario()?.nome,
      items: [
        ...(this.sessao.adminGeral()
          ? [{ label: 'Gerenciar times', icon: 'times', command: () => void this.router.navigateByUrl('/admin/times') }]
          : []),
        {
          label: this.modoTema.escuro() ? 'Modo claro' : 'Modo escuro',
          icon: this.modoTema.escuro() ? 'claro' : 'escuro',
          command: () => this.modoTema.alternar(),
        },
        ...(this.instalacao.podePedir() || this.instalacao.ehIosNoNavegador()
          ? [{ label: 'Instalar app', icon: 'instalar', command: () => this.instalar() }]
          : []),
        { label: 'Sair', icon: 'sair', command: () => this.sair() },
      ],
    },
  ]);

  constructor() {
    void this.sessao.carregarMeusTimes();
  }

  protected trocarTime(timeId: string | null): void {
    if (timeId && timeId !== this.timeId()) void this.router.navigate(['/t', timeId]);
  }

  private instalar(): void {
    if (this.instalacao.podePedir()) void this.instalacao.instalar();
    else this.instrucoesIos.set(true);
  }

  private async sair(): Promise<void> {
    await this.auth.sair();
    await this.router.navigateByUrl('/login');
  }
}
