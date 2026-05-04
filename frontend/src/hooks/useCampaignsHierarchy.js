import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * useCampaignsHierarchy
 *
 * Busca em paralelo a hierarquia (campaign → adsets → ads + insights por ad)
 * de todas as campanhas Meta publicadas. Mantém cache em memória com TTL,
 * cancela requests antigas em refresh, expõe loading global e por campanha.
 *
 * Argumentos:
 *   metaCampaignIds: array de IDs locais das campanhas (campaign.id no banco)
 *   options:
 *     ttlMs   — tempo de cache antes de refetch automático (default 60s)
 *     enabled — se false, não busca nada (default true)
 *
 * Retorno:
 *   {
 *     hierarchies: { [campLocalId]: { hier, error, loading, fetchedAt } },
 *     loading: boolean (true se algum ainda carregando),
 *     refresh: (campLocalId?) => Promise — refaz tudo ou só uma
 *   }
 *
 * O hook é defensivo: se o endpoint falhar pra uma campanha, as outras
 * continuam disponíveis. O consumer pode fallback pra dados do AppState.
 */
export function useCampaignsHierarchy(metaCampaignIds, options = {}) {
  const { ttlMs = 60_000, enabled = true } = options;
  const [hierarchies, setHierarchies] = useState({});
  const abortRef = useRef(new Map()); // campId -> AbortController

  const idsKey = (metaCampaignIds || []).join(',');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchOne = useCallback(async (campLocalId) => {
    const prev = abortRef.current.get(campLocalId);
    if (prev) prev.abort();
    const ctrl = new AbortController();
    abortRef.current.set(campLocalId, ctrl);

    setHierarchies(h => ({
      ...h,
      [campLocalId]: { ...(h[campLocalId] || {}), loading: true, error: null },
    }));

    try {
      const r = await fetch(`/api/campaigns/${campLocalId}/hierarchy`, { signal: ctrl.signal });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      if (!mountedRef.current) return;
      setHierarchies(h => ({
        ...h,
        [campLocalId]: { hier: data, loading: false, error: null, fetchedAt: Date.now() },
      }));
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (!mountedRef.current) return;
      setHierarchies(h => ({
        ...h,
        [campLocalId]: { ...(h[campLocalId] || {}), loading: false, error: e.message },
      }));
    } finally {
      if (abortRef.current.get(campLocalId) === ctrl) {
        abortRef.current.delete(campLocalId);
      }
    }
  }, []);

  const refresh = useCallback(async (campLocalId) => {
    if (!enabled) return;
    if (campLocalId) {
      await fetchOne(campLocalId);
      return;
    }
    const ids = (metaCampaignIds || []).filter(Boolean);
    await Promise.all(ids.map(id => fetchOne(id)));
  }, [enabled, idsKey, fetchOne]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Fetch inicial + dispara quando lista de IDs muda. Cache TTL evita refetch
     em re-renders curtos. */
  useEffect(() => {
    let mounted = true;
    if (!enabled) return () => { mounted = false; };
    const ids = (metaCampaignIds || []).filter(Boolean);

    // Purga entradas de IDs que não estão mais na lista (evita memory leak gradual)
    setHierarchies(h => {
      const next = {};
      ids.forEach(id => { if (h[id]) next[id] = h[id]; });
      return next;
    });

    const now = Date.now();
    ids.forEach(id => {
      const cur = hierarchies[id];
      const stale = !cur || !cur.fetchedAt || (now - cur.fetchedAt) > ttlMs;
      if (stale && !cur?.loading) {
        fetchOne(id).then(() => {}).catch(() => {});
      }
    });

    return () => {
      mounted = false;
      // Cancela em desmontagem
      abortRef.current.forEach(c => c.abort());
      abortRef.current.clear();
    };
  }, [idsKey, enabled, ttlMs, fetchOne]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = Object.values(hierarchies).some(h => h?.loading);

  return { hierarchies, loading, refresh };
}
