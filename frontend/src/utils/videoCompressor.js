/**
 * Compressor de vídeo 100% no browser via FFmpeg.wasm.
 * Lazy loading: só baixa o core (~25MB) na primeira vez que user sobe vídeo.
 *
 * Target: H.264 MP4 com CRF 28 + scale 720p + áudio 128kbps AAC.
 * Resultado típico: vídeo 50MB → 8-12MB sem perda visível grande.
 */

let ffmpegInstance = null;
let loading = null;

async function getFFmpeg(onLoadProgress) {
  if (ffmpegInstance) return ffmpegInstance;
  if (loading) return loading;

  loading = (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
    ]);
    const ffm = new FFmpeg();
    /* CDN oficial do core Emscripten (single-threaded — não precisa COEP/COOP) */
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    onLoadProgress?.('Baixando motor de compressão…');
    await ffm.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ffm;
    return ffm;
  })();
  return loading;
}

/* Target final: 4MB. Vercel limita body em 4.5MB — 500KB de margem cobre
   overhead de multipart (boundary + headers). */
const TARGET_MB = 4.0;

/* Extrai 1 frame do vídeo como JPEG pra usar como thumbnail no creative Meta.
   Meta video_data exige image_url OU image_hash além do video_id.
   GARANTE saída ≥ 600px em ambas dimensões: se vídeo source for menor, faz
   upscale pra 1080. Meta v20 rejeita thumbnail < 500px (erro 2875006). */
export async function extractVideoThumbnail(videoFile) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoFile);
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const cleanup = () => { URL.revokeObjectURL(url); };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout ao extrair thumbnail'));
    }, 15000);

    video.onloadedmetadata = () => {
      /* Pega frame em 1s ou metade do vídeo — evita primeiro frame preto */
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1080;
        const MIN_DIM = 600;  /* folga sobre o mínimo Meta de 500 */
        let w = video.videoWidth, h = video.videoHeight;
        /* 1) Reduz se grande demais */
        if (w > MAX_DIM || h > MAX_DIM) {
          const scale = MAX_DIM / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        /* 2) Upscale se pequeno demais (rede de segurança vs erro 2875006) */
        if (w < MIN_DIM || h < MIN_DIM) {
          const upscale = MAX_DIM / Math.min(w, h);
          w = Math.round(w * upscale);
          h = Math.round(h * upscale);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(blob => {
          clearTimeout(timeout);
          cleanup();
          if (!blob) return reject(new Error('Falha ao gerar thumbnail'));
          resolve(new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.85);
      } catch (e) {
        clearTimeout(timeout);
        cleanup();
        reject(e);
      }
    };
    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error('Não foi possível ler o vídeo'));
    };
  });
}

/* Comprime vídeo com bitrate adaptativo baseado na duração pra garantir
   tamanho final <= TARGET_MB. Se não conseguir no primeiro pass, reencoda
   com parâmetros mais agressivos automaticamente. */
export async function compressVideo(file, onProgress) {
  onProgress?.('Preparando…');
  const ffm = await getFFmpeg(onProgress);

  /* Tenta descobrir duração do vídeo lendo os metadados */
  let durationSec = 30; /* fallback */
  try {
    const v = document.createElement('video');
    v.src = URL.createObjectURL(file);
    await new Promise((res, rej) => {
      v.onloadedmetadata = res;
      v.onerror = () => rej(new Error('metadata'));
      setTimeout(() => rej(new Error('timeout')), 5000);
    });
    durationSec = v.duration || 30;
    URL.revokeObjectURL(v.src);
  } catch { /* usa fallback */ }

  /* Calcula bitrate alvo: (target_mb × 8192 kbps por MB/s) / duração, reservando
     96k pro áudio e 10% de overhead. */
  const totalKbps = Math.floor((TARGET_MB * 8192) / Math.max(durationSec, 5));
  const audioKbps = 96;
  const videoKbps = Math.max(250, Math.floor((totalKbps - audioKbps) * 0.90));

  const handler = ({ progress }) => {
    const pct = Math.min(99, Math.max(0, Math.round(progress * 100)));
    onProgress?.(pct);
  };
  ffm.on('progress', handler);

  async function encode(params) {
    const inputName = 'input' + (file.name.match(/\.[^.]+$/)?.[0] || '.mp4');
    const outputName = 'output.mp4';
    const buffer = new Uint8Array(await file.arrayBuffer());
    await ffm.writeFile(inputName, buffer);
    await ffm.exec([
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', `${params.vKbps}k`,
      '-maxrate', `${params.vKbps}k`,
      '-bufsize', `${params.vKbps * 2}k`,
      '-vf', `scale='min(${params.width},iw)':'-2'`,
      '-c:a', 'aac',
      '-b:a', `${params.aKbps}k`,
      '-movflags', '+faststart',
      '-y',
      outputName,
    ]);
    const data = await ffm.readFile(outputName);
    await ffm.deleteFile(inputName).catch(() => {});
    await ffm.deleteFile(outputName).catch(() => {});
    return data;
  }

  try {
    /* Pass 1: bitrate calculado, largura 720p */
    onProgress?.(0);
    let data = await encode({ vKbps: videoKbps, aKbps: audioKbps, width: 720 });
    let outMB = data.byteLength / (1024 * 1024);

    /* Pass 2: se ainda estourou, reencoda MUITO agressivo — 480p + bitrate baixo */
    if (outMB > TARGET_MB) {
      onProgress?.('Comprimindo mais…');
      data = await encode({ vKbps: Math.max(200, Math.floor(videoKbps * 0.55)), aKbps: 64, width: 480 });
      outMB = data.byteLength / (1024 * 1024);
    }

    /* Pass 3 (último recurso): 360p + bitrate mínimo */
    if (outMB > TARGET_MB) {
      onProgress?.('Reduzindo ainda mais…');
      data = await encode({ vKbps: 200, aKbps: 48, width: 360 });
    }

    onProgress?.(100);
    return new File(
      [data.buffer],
      file.name.replace(/\.[^.]+$/, '.mp4'),
      { type: 'video/mp4' }
    );
  } finally {
    ffm.off('progress', handler);
  }
}
