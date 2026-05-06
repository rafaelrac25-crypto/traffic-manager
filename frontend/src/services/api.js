import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '' });

api.interceptors.response.use(
  res => res,
  err => Promise.reject(err)
);

export default api;

/* ── Utilitários de publicação async ── */

/**
 * Consulta o status de um job de publicação.
 * GET /api/campaigns/jobs/:jobId
 * Retorna: { job_id, campaign_id_local, status, current_step, total_steps,
 *            message, error, updated_at }
 */
export const getPublishJob = (jobId) => api.get(`/api/campaigns/jobs/${jobId}`);
