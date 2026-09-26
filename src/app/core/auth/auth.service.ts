import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { AuthProvider, GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { FIREBASE_AUTH } from '../firebase/firebase.providers';

export interface UsuarioAutenticado {
  uid: string;
  nome: string;
  email: string;
  fotoUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly _usuario = signal<UsuarioAutenticado | null>(null);

  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);

  constructor() {
    const cancelar = onAuthStateChanged(this.auth, (user) => this._usuario.set(user ? mapearUsuario(user) : null));
    inject(DestroyRef).onDestroy(cancelar);
  }

  /** Resolve quando o Firebase termina de restaurar a sessão salva (usado pelos guards). */
  async aguardarEstadoInicial(): Promise<void> {
    await this.auth.authStateReady();
    // Garante o signal sincronizado mesmo se o listener ainda não tiver disparado.
    const user = this.auth.currentUser;
    this._usuario.set(user ? mapearUsuario(user) : null);
  }

  /** Retorna o usuário do Firebase para quem chamou registrar o login (UsuariosService). */
  entrarComGoogle(): Promise<User> {
    return this.entrar(new GoogleAuthProvider());
  }

  sair(): Promise<void> {
    return signOut(this.auth);
  }

  // Ponto único para novos provedores (ex.: Apple, DIRETRIZES seção 10).
  private async entrar(provider: AuthProvider): Promise<User> {
    const credencial = await signInWithPopup(this.auth, provider);
    return credencial.user;
  }
}

function mapearUsuario(user: User): UsuarioAutenticado {
  return {
    uid: user.uid,
    nome: user.displayName ?? user.email ?? 'Usuário',
    email: user.email ?? '',
    fotoUrl: user.photoURL,
  };
}
