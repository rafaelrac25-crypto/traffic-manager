/**
 * Upload de vídeo em chunks pro Meta via backend (Resumable Upload Protocol).
 *
 * Por que existe: Vercel Functions têm body limit de 4.5 MB. O fluxo antigo
 * (mediaProcessor.compressVideo + /api/upload/media) destrói qualidade pra
 * caber em 4 MB. Aqui o vídeo vai em chunks de 3.5 MB sem compressão —
 * cada chunk passa pelo backend (que cabe no limite Vercel) e o backend
 * repassa pro Meta usando o token guardado no DB. Token NUNCA sai do server.
 *
 * Uso:
 *   const { video_id } = await uploadVideoChunked(file, {
 *     onProgress: (pct, label) => setProgress(pct),
 *   });
 *
 * Vídeos de qualquer tamanho que o Meta aceita (até 4 GB).
 */

import apiClient from '../services/api';

/* 3.5 MB por chunk → cabe folgado no limite Vercel (4.5 MB) considerando
   overhead multipart (boundary + headers ≈ 200 bytes). Chunks maiores
   reduzem round-trips mas aumentam risco de timeout em rede ruim. */
const CHUNK_SIZE = 3.5 * 1024 * 1024;

/* Wrapper sobre o axios global do projeto (mesma baseURL/interceptors). */
async function postJson(url, body) {
  const { data } = await apiClient.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
  });
  return data;
}

async function postChunk(url, formData) {
  const { data } = await apiClient.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000, /* 3min — chunk + Meta processing */
  });
  return data;
}

/**
 * @param {File} file - vídeo (qualquer tamanho)
 * @param {Object} opts
 * @param {(percent: number, label: string) => void} [opts.onProgress]
 * @returns {Promise<{ video_id: string }>}
 */
export async function uploadVideoChunked(file, { onProgress } = {}) {
  if (!file || !(file instanceof Blob)) {
    throw new Error('uploadVideoChunked: file inválido');
  }
  const fileSize = file.size;
  if (fileSize <= 0) throw new Error('Arquivo vazio');

  const emit = (pct, label) => { try { onProgress?.(pct, label); } catch {} };

  emit(0, 'Iniciando envio…');
  const startData = await postJson('/api/upload/video/start', { file_size: fileSize });
  const { upload_session_id, video_id } = startData;
  if (!upload_session_id || !video_id) {
    throw new Error('Meta não retornou sessão de upload');
  }

  let offset = Number(startData.start_offset || 0);
  const total = fileSize;

  /* Loop de chunks: Meta retorna a cada transfer { start_offset, end_offset }
     que indicam o RANGE do PRÓXIMO chunk esperado. Quando start_offset === total,
     terminou. */
  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total);
    const chunkBlob = file.slice(offset, end);

    const form = new FormData();
    form.append('upload_session_id', upload_session_id);
    form.append('start_offset', String(offset));
    form.append('chunk', chunkBlob, 'chunk.bin');

    const pct = Math.round((offset / total) * 95); /* 0-95% durante transfer; finish vira 100% */
    const sentMB = (offset / 1024 / 1024).toFixed(1);
    const totalMB = (total / 1024 / 1024).toFixed(1);
    emit(pct, `Enviando vídeo (${sentMB}/${totalMB} MB)…`);

    const out = await postChunk('/api/upload/video/chunk', form);
    const next = Number(out.start_offset);
    if (!Number.isFinite(next) || next <= offset) {
      throw new Error(`Meta não avançou offset (atual ${offset}, retornado ${out.start_offset})`);
    }
    offset = next;
  }

  emit(97, 'Finalizando…');
  await postJson('/api/upload/video/finish', {
    upload_session_id,
    title: file.name?.replace(/\.[^.]+$/, '') || undefined,
  });

  emit(100, 'Pronto');
  return { video_id };
}
