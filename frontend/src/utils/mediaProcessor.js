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

/* Detecta codec do vídeo lendo FourCC nos primeiros bytes do container.
   Não decodifica — só procura strings do tipo 'avc1' (H.264), 'hvc1'/'hev1'
   (HEVC) no header. Suficiente pra distinguir formatos antes de tentar
   processamento pesado e dar mensagem certa em caso de falha. */
async function detectVideoCodec(file) {
  try {
    const slice = file.slice(0, 200000);
    const buf = new Uint8Array(await slice.arrayBuffer());
    /* Busca direta por bytes ASCII dos FourCCs */
    const findStr = (s) => {
      const bytes = Array.from(s).map(c => c.charCodeAt(0));
      for (let i = 0; i < buf.length - bytes.length; i++) {
        let match = true;
        for (let j = 0; j < bytes.length; j++) {
          if (buf[i + j] !== bytes[j]) { match = false; break; }
        }
        if (match) return true;
      }
      return false;
    };
    if (findStr('hvc1') || findStr('hev1')) return 'hevc';
    if (findStr('avc1')) return 'h264';
    return 'unknown';
  } catch {
    return 'unknown';
  }
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
  const codec = await detectVideoCodec(file);
  console.log('[processVideo]', { sizeMB: originalMB.toFixed(2), dims, codec });
  /* Vídeo com algum lado < 600px precisa upscale (folga sobre 500 do Meta).
     Mesmo que size esteja OK, força passagem pelo FFmpeg pra ampliar. */
  const needsUpscale = dims.w > 0 && dims.h > 0 && (dims.w < 600 || dims.h < 600);
  /* Abaixo do threshold E dimensões OK → passa direto (não vale a pena tocar) */
  if (originalMB < VIDEO_COMPRESS_THRESHOLD_MB && !needsUpscale) {
    return { ok: true, file, wasCompressed: false };
  }

  /* HEVC detectado direto no header → não tenta FFmpeg.wasm (sem decoder
     HEVC no build single-threaded). Vai direto pra mensagem com botões. */
  if (codec === 'hevc') {
    return {
      ok: false,
      kind: 'hevc',
      reason: `Esse vídeo está em formato HEVC/H.265 (comum em iPhones com config padrão), que o navegador não consegue processar. Você pode: (1) regravar com "Mais Compatível" nos Ajustes do iPhone, ou (2) converter o arquivo num site gratuito abaixo.`,
    };
  }

  /* Tentativa 1: FFmpeg.wasm (decodifica H.264 nativamente) */
  let lastFfmpegError = null;
  try {
    const { compressVideo } = await import('./videoCompressor');
    const compressed = await compressVideo(file, onProgress);
    const compressedMB = compressed.size / (1024 * 1024);
    if (compressedMB <= MAX_VIDEO_MB_AFTER) {
      return { ok: true, file: compressed, wasCompressed: true };
    }
    lastFfmpegError = `output ${compressedMB.toFixed(1)} MB ainda > ${MAX_VIDEO_MB_AFTER} MB`;
    console.warn('[compress] FFmpeg produziu', compressedMB.toFixed(1), 'MB — tentando alternativa');
  } catch (e) {
    lastFfmpegError = e?.message || String(e);
    console.warn('[compress] FFmpeg falhou:', lastFfmpegError);
  }

  /* Tentativa 1.5: canvas + MediaRecorder com upscale via redesenho.
     Contorna falha do FFmpeg.wasm por memória. Só vale se precisa upscale
     (caso contrário Tentativa 2 do MediaRecorder direto basta). */
  if (needsUpscale && dims.w > 0 && dims.h > 0) {
    try {
      onProgress?.('Ajustando vídeo (modo alternativo)…');
      /* Calcula dimensão alvo: garante menor lado >= 600 com aspect ratio preservado */
      const MIN_SIDE = 600;
      const MAX_W = 720;
      let tW = dims.w, tH = dims.h;
      if (tW > MAX_W) { const s = MAX_W / tW; tW = Math.round(tW * s); tH = Math.round(tH * s); }
      const minSide = Math.min(tW, tH);
      if (minSide < MIN_SIDE) { const s = MIN_SIDE / minSide; tW = Math.round(tW * s); tH = Math.round(tH * s); }
      tW = Math.max(2, Math.floor(tW / 2) * 2);
      tH = Math.max(2, Math.floor(tH / 2) * 2);
      const compressed = await compressWithCanvasUpscale(file, tW, tH, onProgress);
      const compressedMB = compressed.size / (1024 * 1024);
      console.log('[canvas upscale] saída:', compressedMB.toFixed(2), 'MB', tW + 'x' + tH);
      if (compressedMB <= MAX_VIDEO_MB_AFTER) {
        return { ok: true, file: compressed, wasCompressed: true };
      }
      console.warn('[canvas upscale] output ainda muito grande:', compressedMB.toFixed(1), 'MB');
    } catch (e) {
      console.warn('[canvas upscale] falhou:', e?.message || e);
    }
  }

  /* Tentativa 2: MediaRecorder nativo. Pulada quando precisa upscale
     (MediaRecorder não amplia, só captura no tamanho original). */
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

  /* Tentativa 3: se original já cabe E não precisa upscale, manda sem mexer. */
  if (originalMB <= MAX_VIDEO_MB_AFTER && !needsUpscale) {
    return { ok: true, file, wasCompressed: false };
  }

  /* Falha confirmada após tentativa real. 3 mensagens distintas pra cada
     causa raiz (em vez do antigo "tudo é HEVC"). Todas oferecem o caminho
     do conversor online (kind:'hevc' ativa os botões na UI). */
  if (codec === 'h264') {
    return {
      ok: false,
      kind: 'hevc', /* reusa o flag pra mostrar os botões de conversão */
      reason: `O compressor de vídeo do navegador travou processando esse arquivo (codec H.264, ${originalMB.toFixed(1)} MB${dims.w ? `, ${dims.w}×${dims.h}` : ''}). Pode ser limite de memória do navegador. Resolve convertendo num site gratuito abaixo:`,
    };
  }

  return {
    ok: false,
    kind: 'hevc',
    reason: `Não consegui processar esse vídeo no navegador (formato/codec não reconhecido${lastFfmpegError ? `: ${lastFfmpegError}` : ''}). Resolve convertendo num site gratuito abaixo:`,
  };
}

/* Fallback: comprime vídeo via MediaRecorder nativo do browser.
   Usa captureStream + bitrate controlado pra atingir ≤4MB. */
/* Upscale + recompress via canvas + captureStream + MediaRecorder.
   Funciona quando FFmpeg.wasm falha (limite de memória do navegador) E
   precisa upscale (MediaRecorder direto não amplia). Estratégia: desenha
   cada frame do vídeo num canvas em dimensão alvo (ex: 600×1060), captura
   o canvas como stream de vídeo, mistura com áudio do vídeo original,
   grava com MediaRecorder. Resultado: vídeo na dimensão alvo. */
async function compressWithCanvasUpscale(file, targetW, targetH, onProgress) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => { try { URL.revokeObjectURL(video.src); } catch {} };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('canvas upscale timeout (90s)')); }, 90000);

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration || 30;
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        /* Stream do canvas (vídeo) + áudio do vídeo original */
        const canvasStream = canvas.captureStream(30);
        try {
          const vStream = video.captureStream ? video.captureStream() : video.mozCaptureStream?.();
          const audioTracks = vStream?.getAudioTracks?.() || [];
          audioTracks.forEach(t => canvasStream.addTrack(t));
        } catch { /* sem áudio é aceitável */ }

        /* Bitrate pra ficar < 4MB no resultado */
        const totalKbps = Math.floor((4 * 8192) / Math.max(duration, 5));
        const videoKbps = Math.max(500, totalKbps - 96);

        const mimeOptions = [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm',
        ];
        const mimeType = mimeOptions.find(m => MediaRecorder.isTypeSupported(m));
        if (!mimeType) { cleanup(); clearTimeout(timeout); return reject(new Error('Browser sem codec compatível')); }

        const recorder = new MediaRecorder(canvasStream, {
          mimeType,
          videoBitsPerSecond: videoKbps * 1000,
          audioBitsPerSecond: 96000,
        });

        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          cleanup();
          clearTimeout(timeout);
          const ext = mimeType.startsWith('video/mp4') ? '.mp4' : '.webm';
          const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ext), { type: blob.type }));
        };
        recorder.onerror = (e) => { cleanup(); clearTimeout(timeout); reject(new Error(`canvas recorder erro: ${e.error?.message || 'unknown'}`)); };

        /* Loop de desenho — copia o frame atual do vídeo pro canvas em
           dimensão alvo (faz upscale via interpolação bilinear do browser) */
        const drawLoop = () => {
          if (video.ended || video.paused) { recorder.stop(); return; }
          ctx.drawImage(video, 0, 0, targetW, targetH);
          const pct = Math.min(99, Math.round((video.currentTime / duration) * 100));
          onProgress?.(pct);
          requestAnimationFrame(drawLoop);
        };

        recorder.start();
        await video.play();
        drawLoop();
      } catch (e) {
        cleanup();
        clearTimeout(timeout);
        reject(e);
      }
    };

    video.onerror = () => { cleanup(); clearTimeout(timeout); reject(new Error('Não consegui carregar o vídeo pra canvas')); };
  });
}

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
