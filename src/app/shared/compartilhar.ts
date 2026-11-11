/**
 * Abre o WhatsApp (app ou web) com o texto pronto. Sem número, a pessoa escolhe o contato ou grupo;
 * com número (só dígitos, com DDI; ver `numeroWhatsApp`), abre a conversa direto com ele.
 */
export function abrirWhatsApp(texto: string, numero?: string): void {
  window.open(`https://wa.me/${numero ?? ''}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
}

/**
 * Telefone digitado no cadastro ("(49) 99999-0000", "+55 49 …") → número do wa.me ("5549999990000").
 * Sem DDI, assume Brasil (DDD + 8 ou 9 dígitos). Retorna null se não parecer um celular válido.
 */
export function numeroWhatsApp(telefone: string | undefined): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return digitos;
  return null;
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
