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
/* Meta v20 rejeita mídia < 500px (erro 2875006) — usamos 600 com folga. */
export const MIN_IMAGE_PX = 600;
/* Alvo pro upscale quando mídia chega abaixo do mínimo. 1080 é o recomendado
   oficial do Meta pro Instagram (Feed 1080×1080, Stories/Reels 1080×1920). */
export const TARGET_UPSCALE_PX = 1080;
export const IMAGE_JPEG_QUALITY = 0.85;
export const MAX_VIDEO_MB_AFTER = 4.0; /* Vercel limita body em 4.5MB — 500KB de margem pro overhead multipart */
export const VIDEO_COMPRESS_THRESHOLD_MB = 3.5; /* acima disso, comprime sempre */
export const MAX_IMAGE_MB_AFTER = 2;

/* Converte File de imagem em Blob comprimido + sempre ≥ MIN_IMAGE_PX em ambas
   dimensões. Se chegar menor, faz upscale via canvas (bilinear) pra TARGET.
   Resultado: Meta sempre recebe mídia dentro dos limites mínimos. */
export async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      /* 1) Se muito grande, reduz mantendo aspect ratio */
      if (width > MAX_IMAGE_PX || height > MAX_IMAGE_PX) {
        const scale = MAX_IMAGE_PX / Math.max(width, height);
        width  = Math.round(width  * scale);
        height = Math.round(height * scale);
      }

      /* 2) Se abaixo do mínimo Meta, upscale pra TARGET na menor dimensão.
         Qualidade sofre, mas é melhor que Meta rejeitar. Usuário ideal sobe
         em alta resolução — isto é a rede de segurança final. */
      if (width < MIN_IMAGE_PX || height < MIN_IMAGE_PX) {
        const upscale = TARGET_UPSCALE_PX / Math.min(width, height);
        width  = Math.round(width  * upscale);
        height = Math.round(height * upscale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      /* imageSmoothingQuality=high → melhora levemente o upscale */
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
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

/* Lê dimensões do vídeo via metadata. Necessário pra detectar quando
   o vídeo precisa de upscale (ex: 480×848 do iPhone vertical, abaixo
   do mínimo Meta 500×500). */
async function readVideoDims(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.src = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(v.src);
    v.onloadedmetadata = () => { cleanup(); resolve({ w: v.videoWidth || 0, h: v.videoHeight || 0 }); };
    v.onerror = () => { cleanup(); resolve({ w: 0, h: 0 }); };
    setTimeout(() => { cleanup(); resolve({ w: 0, h: 0 }); }, 5000);
  });
}

/* Comprime vídeo automaticamente via FFmpeg.wasm se acima do threshold OU
   se dimensão estiver abaixo do mínimo Meta (precisa upscale).
   Retorna { ok: true, file, wasCompressed } ou { ok: false, reason }. */
export async function processVideoAuto(file, onProgress) {
  const originalMB = file.size / (1024 * 1024);
  const dims = await readVideoDims(file);
  /* Vídeo com algum lado < 600px precisa upscale (folga sobre 500 do Meta).
     Mesmo que size esteja OK, força passagem pelo FFmpeg pra ampliar. */
  const needsUpscale = dims.w > 0 && dims.h > 0 && (dims.w < 600 || dims.h < 600);
  /* Abaixo do threshold E dimensões OK → passa direto (não vale a pena tocar) */
  if (originalMB < VIDEO_COMPRESS_THRESHOLD_MB && !needsUpscale) {
    return { ok: true, file, wasCompressed: false };
  }

  /* Tentativa 1: FFmpeg.wasm (melhor qualidade, suporta H.264 direto) */
  try {
    const { compressVideo } = await import('./videoCompressor');
    const compressed = await compressVideo(file, onProgress);
    const compressedMB = compressed.size / (1024 * 1024);
    if (compressedMB <= MAX_VIDEO_MB_AFTER) {
      return { ok: true, file: compressed, wasCompressed: true };
    }
    /* Se ainda estourou depois dos 3 passes, tenta fallback MediaRecorder */
    console.warn('[compress] FFmpeg produziu', compressedMB.toFixed(1), 'MB — tentando MediaRecorder');
  } catch (e) {
    console.warn('[compress] FFmpeg falhou:', e.message, '— tentando MediaRecorder');
  }

  /* Tentativa 2: MediaRecorder nativo (fallback — funciona se browser suporta).
     Pulada quando precisa upscale: MediaRecorder captura o que é renderizado,
     não amplia. Se chegasse aqui retornaria arquivo no tamanho original e o
     sanity check do CreateAd rejeitaria com mensagem genérica em vez da nova
     instrução do iPhone abaixo. */
  if (!needsUpscale) {
    try {
      onProgress?.('Comprimindo (modo alternativo)…');
      const compressed = await compressWithMediaRecorder(file, onProgress);
      const compressedMB = compressed.size / (1024 * 1024);
      if (compressedMB <= MAX_VIDEO_MB_AFTER) {
        return { ok: true, file: compressed, wasCompressed: true };
      }
    } catch (e) {
      console.warn('[compress] MediaRecorder falhou:', e.message);
    }
  }

  /* Tentativa 3: se original já cabe E não precisa upscale, manda sem mexer.
     Se PRECISAVA upscale e nem FFmpeg nem MediaRecorder produziram saída
     válida, NÃO devolver o original (Meta vai rejeitar mesmo). Sinaliza
     o motivo provável (HEVC do iPhone) com instrução prática. */
  if (originalMB <= MAX_VIDEO_MB_AFTER && !needsUpscale) {
    return { ok: true, file, wasCompressed: false };
  }

  if (needsUpscale) {
    return {
      ok: false,
      kind: 'hevc',
      reason: `Esse vídeo está em formato HEVC/H.265 (comum em iPhones), que o navegador não consegue redimensionar. Você pode: (1) regravar no iPhone com Ajustes → Câmera → Formatos → "Mais Compatível", ou (2) converter o arquivo num site gratuito abaixo e subir o MP4 resultante.`,
    };
  }

  /* Derrota total — vídeo muito grande e compressão não funcionou */
  return {
    ok: false,
    reason: `Não conseguimos comprimir o vídeo (${originalMB.toFixed(1)} MB). Tente um vídeo mais curto (≤30s).`,
  };
}

/* Fallback: comprime vídeo via MediaRecorder nativo do browser.
   Usa captureStream + bitrate controlado pra atingir ≤4MB. */
async function compressWithMediaRecorder(file, onProgress) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const duration = video.duration || 30;
      /* Bitrate pra atingir ~3.5MB total: (3.5MB * 8192) / duração */
      const totalKbps = Math.floor((3.5 * 8192) / duration);
      const videoBits = Math.max(200, totalKbps - 96) * 1000; /* reserva 96k pro áudio */

      const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream?.();
      if (!stream) return reject(new Error('Browser não suporta captureStream'));

      /* Prioridade: MP4 H.264 → WebM VP9 → WebM VP8 */
      const mimeOptions = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm',
      ];
      const mimeType = mimeOptions.find(m => MediaRecorder.isTypeSupported(m));
      if (!mimeType) return reject(new Error('Browser sem codec compatível'));

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: videoBits,
        audioBitsPerSecond: 96000,
      });

      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        URL.revokeObjectURL(video.src);
        const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
        const ext = mimeType.startsWith('video/mp4') ? '.mp4' : '.webm';
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ext), { type: blob.type }));
      };
      recorder.onerror = (e) => reject(new Error(`MediaRecorder erro: ${e.error?.message || 'unknown'}`));

      /* Progresso aproximado baseado no tempo de vídeo */
      let lastPct = 0;
      const progressInt = setInterval(() => {
        const pct = Math.min(99, Math.round((video.currentTime / duration) * 100));
        if (pct !== lastPct) { lastPct = pct; onProgress?.(pct); }
      }, 300);

      recorder.start();
      video.play();
      video.onended = () => {
        clearInterval(progressInt);
        recorder.stop();
      };
    };
    video.onerror = () => reject(new Error('Não consegui carregar o vídeo'));
  });
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
    if (!result.ok) return { error: result.reason, kind: result.kind };
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
