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

/** Foto de postagem: lado maior até 1600px, JPEG/WebP comprimido para o Storage. */
export interface FotoProcessada {
  blob: Blob;
  tipo: 'image/webp' | 'image/jpeg' | 'image/png';
  largura: number;
  altura: number;
}

/**
 * Reduz a foto no navegador antes do envio (economiza dados do celular e armazenamento).
 * WebP quando o navegador codifica; senão o formato alternativo: JPEG para fotos, PNG para imagens com
 * transparência (escudo).
 */
export async function fotoParaEnvio(
  arquivo: File,
  ladoMaximo = 1600,
  alternativo: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<FotoProcessada> {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem.');
  }
  const bitmap = await carregar(arquivo);
  try {
    const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('Seu navegador não permite processar imagens.');
    contexto.imageSmoothingQuality = 'high';
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const webp = await paraBlob(canvas, 'image/webp', 0.82);
    const blob = webp?.type === 'image/webp' ? webp : await paraBlob(canvas, alternativo, 0.85);
    if (!blob) throw new Error('Não foi possível processar esta imagem.');
    return {
      blob,
      tipo: blob.type === 'image/webp' ? 'image/webp' : alternativo,
      largura: canvas.width,
      altura: canvas.height,
    };
  } finally {
    bitmap.close();
  }
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade));
}
