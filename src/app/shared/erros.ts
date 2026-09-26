import { FirebaseError } from 'firebase/app';

/** Mensagem amigável para falhas de escrita/leitura exibidas em toast. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') return 'Você não tem permissão para esta ação.';
    if (e.code === 'unavailable') return 'Sem conexão com o servidor. Tente de novo.';
  }
  if (e instanceof Error && e.message) return e.message;
  return 'Algo deu errado. Tente de novo.';
}
