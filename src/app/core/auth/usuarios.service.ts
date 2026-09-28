import { Injectable, inject } from '@angular/core';
import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firestore.token';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly firestore = inject(FIRESTORE);

  /**
   * Cria usuarios/{uid} no primeiro login; nos seguintes, atualiza nome/email/foto só se mudaram.
   * Nunca escreve adminGeral (DIRETRIZES 4).
   */
  async registrarLogin(user: User): Promise<void> {
    const ref = doc(this.firestore, 'usuarios', user.uid);
    const perfil = {
      nome: user.displayName ?? '',
      email: user.email ?? '',
      fotoUrl: user.photoURL,
    };

    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { ...perfil, criadoEm: serverTimestamp() });
      return;
    }

    const atual = snap.data();
    const mudou =
      atual['nome'] !== perfil.nome || atual['email'] !== perfil.email || atual['fotoUrl'] !== perfil.fotoUrl;
    if (mudou) {
      await updateDoc(ref, perfil);
    }
  }
}
