/**
 * Cliente da API de anúncios (persistência no backend).
 *
 * O frontend usa esse módulo pra sincronizar ads com o banco. Em caso de falha
 * de rede, as escritas são logadas e o AppStateContext continua funcionando
 * no modo localStorage (não quebra a UI).
 *
 * Contrato com o backend (em `backend/src/routes/campaigns.js`):
 * - GET  /api/campaigns            → list
 * - POST /api/campaigns            → create (aceita { name, platform, budget, payload })
 * - PUT  /api/campaigns/:id        → update (aceita patch parcial + payload)
 * - PATCH /api/campaigns/:id/status → troca status
 * - DELETE /api/campaigns/:id      → remove
 */

import api from './api';

const BASE = '/api/campaigns';

function adToPayload(ad) {
  /* Campos "estruturados" que o backend entende nas colunas próprias */
  const { id, name, platform, budget, budgetValue, startDate, endDate, status,
          publishMode, scheduledFor, ...rest } = ad || {};
  return {
    name: name || 'Anúncio sem nome',
    platform: platform || 'instagram',
    budget: Number(budgetValue || budget || 0) || null,
    start_date: startDate || null,
    end_date: endDate || null,
    publish_mode: publishMode || 'immediate',
    scheduled_for: scheduledFor || null,
    status: status || 'review',
    /* Tudo o mais vai no JSON — locations, interests, criativo, meta IDs, split de anel, mídia */
    payload: { id, budgetValue, startDate, endDate, publishMode, scheduledFor, ...rest },
  };
}

export async function fetchAds() {
  try {
    const { data } = await api.get(BASE);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[adsApi] fetchAds falhou — usando cache local', err?.message);
    return null;
  }
}

export async function createAd(ad) {
  try {
    const { data } = await api.post(BASE, adToPayload(ad));
    return data;
  } catch (err) {
    console.warn('[adsApi] createAd falhou — mantido só em localStorage', err?.message);
    return null;
  }
}

export async function updateAd(id, patch) {
  if (id == null) return null;
  try {
    const { data } = await api.put(`${BASE}/${id}`, adToPayload(patch));
    return data;
  } catch (err) {
    /* 502 = Meta recusou → propaga pra quem chamou tratar (rollback).
       Outros erros (offline, 500) → retorna null pra manter local. */
    const status = err?.response?.status;
    const body = err?.response?.data;
    if (status === 502 || status === 400) {
      const e = new Error(body?.error || err.message || 'Meta recusou a edição');
      e.meta = body?.meta || null;
      throw e;
    }
    console.warn('[adsApi] updateAd falhou', err?.message);
    return null;
  }
}

export async function updateAdStatus(id, status) {
  if (id == null) return null;
  try {
    const { data } = await api.patch(`${BASE}/${id}/status`, { status });
    return data;
  } catch (err) {
    const s = err?.response?.status;
    const body = err?.response?.data;
    if (s === 502 || s === 400) {
      const e = new Error(body?.error || err.message || 'Meta recusou a mudança de status');
      e.meta = body?.meta || null;
      throw e;
    }
    console.warn('[adsApi] updateAdStatus falhou', err?.message);
    return null;
  }
}

/* Faz sync cirúrgico de status + métricas dos ads Meta já publicados.
   Retorna { updated: [{ id, platform_campaign_id, status, spent, clicks, ... }] }. */
export async function syncMetaStatus() {
  try {
    const { data } = await api.post(`${BASE}/sync-meta-status`);
    return data?.updated || [];
  } catch (err) {
    console.warn('[adsApi] syncMetaStatus falhou', err?.message);
    return [];
  }
}

export async function deleteAd(id) {
  if (id == null) return false;
  try {
    await api.delete(`${BASE}/${id}`);
    return true;
  } catch (err) {
    console.warn('[adsApi] deleteAd falhou', err?.message);
    return false;
  }
}
