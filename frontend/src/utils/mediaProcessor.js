/**
 * Processador de mídia no cliente — otimiza antes do upload pro Meta.
 *
 * - Imagem: reduz pra max 1080px no lado maior + qualidade 0.85 (normalmente
 *   <300KB). Usa canvas nativo do browser, sem dependências.
 * - Vídeo: valida peso; rejeita se > MAX_VIDEO_MB porque compressão no browser
 *   exigiria FFmpeg.wasm (pesado). Mensagem clara com link pra ferramenta.
 */

/* Limites adequados pro pipeline Vercel + Meta (ad account criscosta.beauty) */
export const MAX_IMAGE_PX = 1080;
export const IMAGE_JPEG_QUALITY = 0.85;
export const MAX_VIDEO_MB_AFTER = 4.0; /* Vercel limita body em 4.5MB — 500KB de margem pro overhead multipart */
export const VIDEO_COMPRESS_THRESHOLD_MB = 3.5; /* acima disso, comprime sempre */
export const MAX_IMAGE_MB_AFTER = 2;

/* Converte File de imagem em Blob comprimido via canvas. */
export async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      /* Calcula novo tamanho respeitando aspect ratio */
      let { width, height } = img;
      if (width > MAX_IMAGE_PX || height > MAX_IMAGE_PX) {
        const scale = MAX_IMAGE_PX / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      /* JPEG com qualidade 0.85 — bom equilíbrio tamanho/qualidade */
      canvas.toBlob(
        blob => {
          if (!blob) return reject(new Error('Falha na compressão'));
          resolve(blob);
        },
        'image/jpeg',
        IMAGE_JPEG_QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem'));
    };
    img.src = url;
  });
}

/* Comprime vídeo automaticamente via FFmpeg.wasm se acima do threshold.
   Retorna { ok: true, file, wasCompressed } ou { ok: false, reason }. */
export async function processVideoAuto(file, onProgress) {
  const originalMB = file.size / (1024 * 1024);
  /* Abaixo do threshold → passa direto (não vale a pena comprimir) */
  if (originalMB < VIDEO_COMPRESS_THRESHOLD_MB) {
    return { ok: true, file, wasCompressed: false };
  }
  try {
    const { compressVideo } = await import('./videoCompressor');
    const compressed = await compressVideo(file, onProgress);
    const compressedMB = compressed.size / (1024 * 1024);
    if (compressedMB > MAX_VIDEO_MB_AFTER) {
      return {
        ok: false,
        reason: `Vídeo ficou com ${compressedMB.toFixed(1)} MB mesmo após compressão (limite ${MAX_VIDEO_MB_AFTER} MB). Use um vídeo mais curto (<30s) ou em resolução menor.`,
      };
    }
    return { ok: true, file: compressed, wasCompressed: true };
  } catch (e) {
    /* Se FFmpeg falhar (navegador antigo, memória), aceita vídeo original
       SE ainda couber no limite do multer (15MB). */
    if (originalMB <= MAX_VIDEO_MB_AFTER) {
      return { ok: true, file, wasCompressed: false };
    }
    return {
      ok: false,
      reason: `Compressão automática falhou (${e.message}). Vídeo tem ${originalMB.toFixed(1)} MB — precisa ser ≤${MAX_VIDEO_MB_AFTER} MB.`,
    };
  }
}

/* Processa 1 arquivo. Retorna { file, name, type, wasCompressed } ou { error } */
export async function processMediaFile(file, onProgress) {
  if (file.type.startsWith('image/')) {
    try {
      const originalMB = file.size / (1024 * 1024);
      const blob = await compressImage(file);
      const compressedMB = blob.size / (1024 * 1024);
      /* Se compressão não ajudou o suficiente, tenta reduzir mais */
      let finalBlob = blob;
      if (compressedMB > MAX_IMAGE_MB_AFTER) {
        /* Aceita mesmo assim — Meta suporta até 30MB; só avisa. */
      }
      const compressedFile = new File([finalBlob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
      return {
        file: compressedFile,
        name: compressedFile.name,
        type: 'image',
        wasCompressed: originalMB > compressedMB * 1.1,
        originalSize: Number(originalMB.toFixed(2)),
        finalSize: Number(compressedMB.toFixed(2)),
      };
    } catch (e) {
      return { error: `Falha ao processar imagem: ${e.message}` };
    }
  }

  if (file.type.startsWith('video/')) {
    const originalMB = Number((file.size / (1024 * 1024)).toFixed(2));
    const result = await processVideoAuto(file, onProgress);
    if (!result.ok) return { error: result.reason };
    const finalMB = Number((result.file.size / (1024 * 1024)).toFixed(2));
    return {
      file: result.file,
      name: result.file.name,
      type: 'video',
      wasCompressed: result.wasCompressed,
      originalSize: originalMB,
      finalSize: finalMB,
    };
  }

  return { error: `Tipo de arquivo não suportado: ${file.type}` };
}
