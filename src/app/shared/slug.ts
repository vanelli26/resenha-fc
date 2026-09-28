/** Formato do endereço do time (`/t/:timeId`), igual ao das Rules. */
export const PADRAO_SLUG = /^[a-z0-9-]{2,40}$/;

/** "Amigos da Várzea FC" → "amigos-da-varzea-fc" (sem acentos, minúsculas, hífens, até 40). */
export function slugDe(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}
