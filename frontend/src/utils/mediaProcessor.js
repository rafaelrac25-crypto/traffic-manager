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
export const MAX_VIDEO_MB = 8;
export const MAX_IMAGE_MB_AFTER = 2; /* se comprimir e ainda ficar > 2MB, avisa */

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

/* Valida vídeo — retorna { ok: true, file } ou { ok: false, reason, suggestion } */
export function validateVideo(file) {
  const mb = file.size / (1024 * 1024);
  if (mb > MAX_VIDEO_MB) {
    return {
      ok: false,
      reason: `O vídeo tem ${mb.toFixed(1)} MB — limite para publicação direta é ${MAX_VIDEO_MB} MB.`,
      suggestion: 'Comprima gratuitamente em freeconvert.com/video-compressor (ajuste qualidade pra 70% e resolução 720p).',
    };
  }
  return { ok: true, file };
}

/* Processa 1 arquivo. Retorna { file, name, type, wasCompressed } ou { error } */
export async function processMediaFile(file) {
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
    const check = validateVideo(file);
    if (!check.ok) {
      return { error: `${check.reason} ${check.suggestion}` };
    }
    return {
      file,
      name: file.name,
      type: 'video',
      wasCompressed: false,
      originalSize: Number((file.size / (1024 * 1024)).toFixed(2)),
      finalSize: Number((file.size / (1024 * 1024)).toFixed(2)),
    };
  }

  return { error: `Tipo de arquivo não suportado: ${file.type}` };
}
