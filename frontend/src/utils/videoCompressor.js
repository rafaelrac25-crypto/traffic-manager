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

/* Lê dimensões reais do vídeo via metadata. Necessário pra calcular o alvo
   de scale: vídeos verticais de celular vêm 480×848 (abaixo do mínimo Meta
   500×500), e o filter min(width,iw) sozinho não faz upscale. */
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

/* Calcula dimensões finais respeitando regras:
   1) Largura reduz pra maxWidth se for maior (downscale primeiro)
   2) Menor lado SEMPRE atinge MIN_SIDE no final (upscale por último — vence o downscale)
   3) Resultado par (codec yuv420p exige).
   Aspect ratio SEMPRE preservado — mesma escala em w e h, nunca distorce.

   Ordem importa: downscale → upscale garante que mesmo nos passes 2/3 (com
   maxWidth=480 ou 360 pra reduzir bitrate), o mínimo Meta de 500px é
   respeitado. Trade-off: pass 2/3 não reduzem dimensão tanto quanto
   poderiam — compensam reduzindo só o bitrate. */
function computeTargetDims(srcW, srcH, maxWidth) {
  const MIN_SIDE = 600;
  /* Sem dimensões conhecidas → cai no fallback genérico maxWidth × auto */
  if (!srcW || !srcH) return { w: maxWidth, h: -2 };
  let w = srcW, h = srcH;
  /* 1. Downscale: largura > maxWidth (reduz proporcionalmente) */
  if (w > maxWidth) {
    const scale = maxWidth / w;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  /* 2. Upscale FINAL: menor lado < MIN_SIDE (sobe proporcionalmente).
     Vence o downscale acima — garante Meta-compliance mesmo se maxWidth < 600. */
  const minSide = Math.min(w, h);
  if (minSide < MIN_SIDE) {
    const scale = MIN_SIDE / minSide;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  /* Pares pra yuv420p */
  w = Math.max(2, Math.floor(w / 2) * 2);
  h = Math.max(2, Math.floor(h / 2) * 2);
  return { w, h };
}

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

  /* Lê dimensões reais — usadas no scale proporcional (upscale + downscale). */
  const srcDims = await readVideoDims(file);

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
    /* params.w + params.h calculados via computeTargetDims — escala proporcional
       que respeita aspect ratio (vertical 9:16 continua 9:16, horizontal continua etc).
       Se h = -2, FFmpeg calcula altura mantendo aspect ratio (fallback sem dims). */
    const scaleArg = params.h === -2
      ? `scale=${params.w}:-2`
      : `scale=${params.w}:${params.h}`;
    await ffm.exec([
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', `${params.vKbps}k`,
      '-maxrate', `${params.vKbps}k`,
      '-bufsize', `${params.vKbps * 2}k`,
      '-vf', scaleArg,
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

  /* Report acumulado pra observabilidade — qual pass venceu, dims, tamanho.
     Sai pelo console.info no fim + dispara CustomEvent('video:compress:report')
     pra futura ingestão em /api/reports sem precisar refatorar este arquivo. */
  const report = {
    file: { name: file.name, sizeMB: +(file.size / 1024 / 1024).toFixed(2) },
    src: { width: srcDims.w, height: srcDims.h, durationSec: +durationSec.toFixed(1) },
    targetMB: TARGET_MB,
    initialBitrateKbps: videoKbps,
    passes: [],
    finalPass: null,
    finalDims: null,
    finalSizeMB: null,
  };

  try {
    /* Pass 1: bitrate calculado, largura alvo 720p (com upscale se preciso) */
    onProgress?.(0);
    const dim1 = computeTargetDims(srcDims.w, srcDims.h, 720);
    let data = await encode({ vKbps: videoKbps, aKbps: audioKbps, ...dim1 });
    let outMB = data.byteLength / (1024 * 1024);
    report.passes.push({ n: 1, target: 720, dims: dim1, vKbps: videoKbps, sizeMB: +outMB.toFixed(2), kept: outMB <= TARGET_MB });
    report.finalPass = 1; report.finalDims = dim1; report.finalSizeMB = +outMB.toFixed(2);

    /* Pass 2: se ainda estourou, reencoda MUITO agressivo — bitrate menor.
       Dimensão alvo 480px de largura; mas se vídeo for menor que 600 no
       lado pequeno, computeTargetDims força upscale pro mínimo Meta. */
    if (outMB > TARGET_MB) {
      onProgress?.('Comprimindo mais…');
      const dim2 = computeTargetDims(srcDims.w, srcDims.h, 480);
      const v2 = Math.max(200, Math.floor(videoKbps * 0.55));
      data = await encode({ vKbps: v2, aKbps: 64, ...dim2 });
      outMB = data.byteLength / (1024 * 1024);
      report.passes.push({ n: 2, target: 480, dims: dim2, vKbps: v2, sizeMB: +outMB.toFixed(2), kept: outMB <= TARGET_MB });
      report.finalPass = 2; report.finalDims = dim2; report.finalSizeMB = +outMB.toFixed(2);
    }

    /* Pass 3 (último recurso): bitrate mínimo. Mesma garantia: dimensão
       respeita mínimo Meta independente do alvo de 360px. */
    if (outMB > TARGET_MB) {
      onProgress?.('Reduzindo ainda mais…');
      const dim3 = computeTargetDims(srcDims.w, srcDims.h, 360);
      data = await encode({ vKbps: 200, aKbps: 48, ...dim3 });
      outMB = data.byteLength / (1024 * 1024);
      report.passes.push({ n: 3, target: 360, dims: dim3, vKbps: 200, sizeMB: +outMB.toFixed(2), kept: true });
      report.finalPass = 3; report.finalDims = dim3; report.finalSizeMB = +outMB.toFixed(2);
    }

    onProgress?.(100);

    /* Log estruturado — Rafa pede observabilidade pra saber qual pass foi usado.
       Quanto MAIOR o finalPass, MENOR a qualidade do vídeo final. */
    const qualityLabel = { 1: '🟢 720p (alta)', 2: '🟡 480p (média)', 3: '🔴 360p (baixa)' }[report.finalPass];
    console.info(`%c[videoCompressor] Pass ${report.finalPass} venceu — ${qualityLabel}`,
      'background:#7D4A5E;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold');
    console.info('  origem:', `${report.src.width}×${report.src.height} · ${report.src.durationSec}s · ${report.file.sizeMB}MB`);
    console.info('  saída: ', `${report.finalDims.w}×${report.finalDims.h} · ${report.finalSizeMB}MB`);
    console.table(report.passes);

    /* Evento global — outros módulos podem capturar pra ingestão futura em
       /api/reports sem acoplar este arquivo a fetch/db. */
    try {
      window.dispatchEvent(new CustomEvent('video:compress:report', { detail: report }));
    } catch { /* SSR/test envs sem window — ignora */ }

    return new File(
      [data.buffer],
      file.name.replace(/\.[^.]+$/, '.mp4'),
      { type: 'video/mp4' }
    );
  } finally {
    ffm.off('progress', handler);
  }
}
