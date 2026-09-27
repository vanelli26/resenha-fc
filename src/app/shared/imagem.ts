const TAMANHOS_PX = [256, 192, 128] as const;

/**
 * Redimensiona a imagem no navegador (lado maior = 256px, mantendo proporção) e devolve
 * um data URL WebP; navegadores sem encoder WebP (Safari) devolvem PNG. Se passar do limite,
 * tenta tamanhos menores. Falha se nem 128px couber.
 */
export async function imagemParaDataUrl(arquivo: File, limiteCaracteres: number): Promise<string> {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem (PNG, JPG, WebP ou SVG).');
  }
  const bitmap = await carregar(arquivo);
  try {
    for (const tamanho of TAMANHOS_PX) {
      const dataUrl = desenhar(bitmap, tamanho);
      if (dataUrl.length <= limiteCaracteres) return dataUrl;
    }
  } finally {
    bitmap.close();
  }
  throw new Error('Imagem muito detalhada para o limite. Tente outra imagem ou recorte-a.');
}

async function carregar(arquivo: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(arquivo);
  } catch {
    throw new Error('Não foi possível ler esta imagem.');
  }
}

function desenhar(bitmap: ImageBitmap, tamanho: number): string {
  const escala = Math.min(1, tamanho / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('Seu navegador não permite processar imagens.');
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.85);
}
