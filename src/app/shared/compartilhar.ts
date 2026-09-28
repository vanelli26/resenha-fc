/** Abre o WhatsApp (app ou web) com o texto pronto para escolher o contato ou grupo. */
export function abrirWhatsApp(texto: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
}

/** Copia para a área de transferência. Retorna `false` se o navegador negar (quem chama mostra o texto). */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
