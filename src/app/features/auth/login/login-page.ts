import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Google } from '@primeicons/angular/google';
import { FirebaseError } from 'firebase/app';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../../core/auth/auth.service';
import { UsuariosService } from '../../../core/auth/usuarios.service';
import { Logo } from '../../../shared/logo';

// Fechar/cancelar o popup não é erro para o usuário.
const CODIGOS_IGNORADOS = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

@Component({
  selector: 'app-login-page',
  imports: [ButtonModule, MessageModule, Google, Logo],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  /** Query param ?voltar= (withComponentInputBinding). Só caminhos internos. */
  readonly voltar = input<string>();

  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuariosService);
  private readonly router = inject(Router);

  protected readonly entrando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected async entrarComGoogle(): Promise<void> {
    this.entrando.set(true);
    this.erro.set(null);
    try {
      const user = await this.auth.entrarComGoogle();
      await this.usuarios.registrarLogin(user);
      await this.router.navigateByUrl(destinoSeguro(this.voltar()));
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.entrando.set(false);
    }
  }
}

// Evita redirecionamento aberto: só aceita caminho interno ("/x", nunca "//host").
function destinoSeguro(voltar: string | undefined): string {
  return voltar?.startsWith('/') && !voltar.startsWith('//') ? voltar : '/';
}

function mensagemDeErro(e: unknown): string | null {
  if (e instanceof FirebaseError) {
    if (CODIGOS_IGNORADOS.has(e.code)) return null;
    if (e.code === 'auth/popup-blocked') return 'O navegador bloqueou a janela de login. Libere pop-ups e tente de novo.';
    if (e.code === 'auth/network-request-failed') return 'Sem conexão. Verifique a internet e tente de novo.';
  }
  return 'Não foi possível entrar. Tente de novo.';
}
