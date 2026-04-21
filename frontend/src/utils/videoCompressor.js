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

/* Comprime vídeo. onProgress recebe número 0..100 ou string de status. */
export async function compressVideo(file, onProgress) {
  onProgress?.('Preparando…');
  const ffm = await getFFmpeg(onProgress);

  const handler = ({ progress }) => {
    const pct = Math.min(99, Math.max(0, Math.round(progress * 100)));
    onProgress?.(pct);
  };
  ffm.on('progress', handler);

  try {
    const inputName = 'input' + (file.name.match(/\.[^.]+$/)?.[0] || '.mp4');
    const outputName = 'output.mp4';

    const buffer = new Uint8Array(await file.arrayBuffer());
    await ffm.writeFile(inputName, buffer);

    /* CRF 28 é bom balanço qualidade/tamanho. scale 720p (altura -2 mantém aspect).
       preset fast é razoável pra browser. AAC 128k áudio. +faststart coloca moov
       atom no início pro Meta processar rápido. */
    await ffm.exec([
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-vf', "scale='min(1280,iw)':'-2'",
      '-movflags', '+faststart',
      '-y',
      outputName,
    ]);

    const data = await ffm.readFile(outputName);
    await ffm.deleteFile(inputName).catch(() => {});
    await ffm.deleteFile(outputName).catch(() => {});

    onProgress?.(100);
    const compressed = new File(
      [data.buffer],
      file.name.replace(/\.[^.]+$/, '.mp4'),
      { type: 'video/mp4' }
    );
    return compressed;
  } finally {
    ffm.off('progress', handler);
  }
}
