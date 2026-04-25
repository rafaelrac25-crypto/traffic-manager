import React, { useEffect, useMemo, useState } from 'react';

/**
 * RingRecommendation — sugere e aplica nova distribuição % de orçamento
 * entre os anéis (primário/médio/externo) com base no CPR real reportado pelo
 * endpoint /api/campaigns/analytics/rings.
 *
 * Estratégia (didática, pra Cris entender o "porquê"):
 *  1) Considera só anéis com CPR > 0 (anel sem dado não recebe sugestão).
 *  2) Distribui o orçamento INVERSAMENTE proporcional ao CPR — anel com menor
 *     custo por resultado ganha a maior fatia.
 *  3) Aplica piso de 10% por anel ativo (nunca zera nenhum, ainda pode haver
 *     aprendizado lá).
 *  4) Arredonda pra múltiplos de 5 e ajusta o melhor anel pra fechar 100%.
 *
 * Props:
 *  - rings: array {ring_key, ring_label, spend, conversions, cpr, ad_set_count}
 *  - activeCampaigns: array {id, name, budget, ...} — campanhas que receberão o PUT
 *  - onApplied?: callback() chamado após aplicar com sucesso (ex: refetch dashboard)
 */

const fmtBRL = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const RING_ORDER = ['primario', 'medio', 'externo'];
const RING_LABEL = {
  primario: 'Primário',
  medio:    'Médio',
  externo:  'Externo',
};
const RING_COLOR = {
  primario: '#16A34A',
  medio:    '#CA8A04',
  externo:  '#DC2626',
};

/* ── Cálculo da distribuição sugerida ──────────────────────────────────────
   Recebe um array de rings com cpr > 0, devolve {primario, medio, externo}
   somando 100. Anéis sem cpr ficam de fora (caller decide o que mostrar).   */
function calcSuggested(ringsWithCpr) {
  if (!ringsWithCpr || ringsWithCpr.length < 2) return null;

  /* Inversamente proporcional ao CPR: peso = 1/cpr */
  const weights = ringsWithCpr.map(r => ({
    key: r.ring_key,
    weight: 1 / Number(r.cpr),
  }));
  const sumW = weights.reduce((s, w) => s + w.weight, 0);
  let raw = weights.map(w => ({ key: w.key, pct: (w.weight / sumW) * 100 }));

  /* Piso de 10% por anel — se algum ficou abaixo, "puxa" do(s) maior(es) */
  const FLOOR = 10;
  let deficit = 0;
  raw = raw.map(r => {
    if (r.pct < FLOOR) {
      deficit += (FLOOR - r.pct);
      return { ...r, pct: FLOOR };
    }
    return r;
  });
  if (deficit > 0) {
    /* Tira o déficit proporcionalmente dos anéis acima do piso */
    const above = raw.filter(r => r.pct > FLOOR);
    const sumAbove = above.reduce((s, r) => s + (r.pct - FLOOR), 0);
    if (sumAbove > 0) {
      raw = raw.map(r => {
        if (r.pct <= FLOOR) return r;
        const share = (r.pct - FLOOR) / sumAbove;
        return { ...r, pct: r.pct - deficit * share };
      });
    }
  }

  /* Arredonda pra múltiplos de 5 */
  let rounded = raw.map(r => ({ ...r, pct: Math.round(r.pct / 5) * 5 }));

  /* Garante piso depois do arredondamento */
  rounded = rounded.map(r => r.pct < FLOOR ? { ...r, pct: FLOOR } : r);

  /* Ajusta o melhor anel (menor cpr → maior peso) pra fechar 100 */
  const total = rounded.reduce((s, r) => s + r.pct, 0);
  const diff = 100 - total;
  if (diff !== 0) {
    /* Identifica o anel com maior peso (1/cpr) — o "campeão" leva o ajuste */
    const bestKey = weights.reduce((best, w) => w.weight > best.weight ? w : best).key;
    rounded = rounded.map(r => r.key === bestKey ? { ...r, pct: r.pct + diff } : r);
    /* Garante que o ajuste não jogou ninguém abaixo do piso (raro, mas seguro) */
    rounded = rounded.map(r => r.pct < FLOOR ? { ...r, pct: FLOOR } : r);
  }

  /* Devolve em formato {primario, medio, externo} — anéis ausentes ficam undefined */
  const out = {};
  rounded.forEach(r => { out[r.key] = r.pct; });
  return out;
}

/* ── Distribuição ATUAL: derivada do spend de cada anel ────────────────── */
function calcCurrent(rings) {
  const totalSpend = rings.reduce((s, r) => s + Number(r.spend || 0), 0);
  if (totalSpend <= 0) return null;
  const out = {};
  rings.forEach(r => {
    out[r.ring_key] = Math.round((Number(r.spend || 0) / totalSpend) * 100);
  });
  return out;
}

/* ── Componente principal ──────────────────────────────────────────────── */
export default function RingRecommendation({ rings, activeCampaigns, onApplied }) {
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null); /* {ok: true, count} | {ok: false, errors: [...]} */

  const safeRings = Array.isArray(rings) ? rings : [];
  const ringsWithCpr = useMemo(
    () => safeRings.filter(r => r && Number(r.cpr) > 0),
    [safeRings],
  );

  const suggested = useMemo(() => calcSuggested(ringsWithCpr), [ringsWithCpr]);
  const current = useMemo(() => calcCurrent(safeRings), [safeRings]);

  /* Empty: sem dado real, ou só 1 anel com CPR → sem recomendação */
  if (!suggested || !current) return null;

  /* Identifica o melhor anel (menor cpr) pra texto explicativo */
  const best = ringsWithCpr.reduce((b, r) => (Number(r.cpr) < Number(b.cpr) ? r : b));
  const bestLabel = best.ring_label || RING_LABEL[best.ring_key] || best.ring_key;
  const bestCprStr = fmtBRL(best.cpr);

  /* Detecta se a sugestão é "praticamente igual" à atual (todas as diferenças <5pp) */
  const noChangeNeeded = RING_ORDER.every(k => {
    const c = current[k] ?? 0;
    const s = suggested[k] ?? 0;
    return Math.abs(c - s) < 5;
  });

  const activeCount = Array.isArray(activeCampaigns) ? activeCampaigns.length : 0;
  const canApply = activeCount > 0 && !applying && !noChangeNeeded;

  const handleApply = async () => {
    if (!canApply) return;
    setApplying(true);
    setResult(null);
    const errors = [];
    let okCount = 0;

    for (const camp of activeCampaigns) {
      try {
        const res = await fetch(`/api/campaigns/${camp.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ringSplit: suggested }),
        });
        if (!res.ok) {
          let reason = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            reason = body?.error?.pt || body?.error?.message || body?.error || body?.message || reason;
            if (typeof reason === 'object') reason = JSON.stringify(reason);
          } catch { /* ignore */ }
          errors.push({ id: camp.id, name: camp.name || `#${camp.id}`, reason });
        } else {
          okCount++;
        }
      } catch (err) {
        errors.push({
          id: camp.id,
          name: camp.name || `#${camp.id}`,
          reason: err?.message || 'falha de rede',
        });
      }
    }

    setApplying(false);
    setResult({ ok: errors.length === 0, count: okCount, errors });
    if (okCount > 0 && typeof onApplied === 'function') {
      try { onApplied(); } catch { /* defensivo */ }
    }
  };

  return (
    <section
      aria-label="Sugestão de redistribuição entre anéis"
      className="ccb-card"
      style={{
        background: 'var(--c-card-bg)',
        borderRadius: '16px',
        border: '1px solid var(--c-border)',
        padding: '18px 22px',
        boxShadow: '0 2px 8px var(--c-shadow)',
        marginBottom: '20px',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{
          fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)',
          marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span aria-hidden="true">💡</span> Sugestão de ajuste
        </div>
        <div style={{ fontSize: '12px', color: 'var(--c-text-3)', lineHeight: 1.5 }}>
          {noChangeNeeded ? (
            <>Sua distribuição atual já está bem próxima do ideal pelo desempenho recente. Nenhum ajuste necessário agora.</>
          ) : (
            <>
              Anel <strong>{bestLabel}</strong> está trazendo o melhor retorno
              ({bestCprStr} por resultado). Considere aumentar a fatia dele.
            </>
          )}
        </div>
      </div>

      {/* Tabela atual → sugerida */}
      <div
        role="table"
        aria-label="Comparativo distribuição atual e sugerida"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(110px, 1.4fr) 1fr 24px 1fr',
          gap: '8px 10px',
          alignItems: 'center',
          padding: '12px 14px',
          background: 'var(--c-surface, #FAFAFA)',
          borderRadius: '10px',
          border: '1px solid var(--c-border)',
          marginBottom: '14px',
        }}
      >
        {/* Linha de cabeçalho */}
        <div role="rowheader" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Anel</div>
        <div role="columnheader" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', textAlign: 'center' }}>Atual</div>
        <div aria-hidden="true" />
        <div role="columnheader" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', textAlign: 'center' }}>Sugerido</div>

        {RING_ORDER.map(key => {
          const cur = current[key];
          const sug = suggested[key];
          const hasSug = typeof sug === 'number';
          const hasCur = typeof cur === 'number';
          const delta = hasSug && hasCur ? sug - cur : 0;
          const color = RING_COLOR[key];
          return (
            <React.Fragment key={key}>
              <div role="rowheader" style={{
                fontSize: '12px', fontWeight: 600, color: 'var(--c-text-1)',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span aria-hidden="true" style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: color, display: 'inline-block',
                }} />
                {RING_LABEL[key] || key}
              </div>
              <div role="cell" style={{
                fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)',
                textAlign: 'center', fontVariantNumeric: 'tabular-nums',
              }}>
                {hasCur ? `${cur}%` : '—'}
              </div>
              <div aria-hidden="true" style={{ textAlign: 'center', color: 'var(--c-text-4)', fontSize: '14px' }}>
                →
              </div>
              <div role="cell" style={{
                fontSize: '13px', fontWeight: 700,
                color: hasSug ? color : 'var(--c-text-4)',
                textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px',
              }}>
                {hasSug ? `${sug}%` : '—'}
                {hasSug && hasCur && delta !== 0 && (
                  <span style={{
                    fontSize: '10px', fontWeight: 600,
                    color: delta > 0 ? '#16A34A' : '#DC2626',
                  }}>
                    ({delta > 0 ? '+' : ''}{delta})
                  </span>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Resultado da aplicação (se houver) */}
      {result && (
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: '12px', fontWeight: 600,
            padding: '10px 12px', borderRadius: '8px',
            marginBottom: '12px', lineHeight: 1.4,
            background: result.ok ? '#DCFCE7' : '#FEF2F2',
            color: result.ok ? '#166534' : '#991B1B',
            border: result.ok ? '1px solid #86EFAC' : '1px solid #FCA5A5',
          }}
        >
          {result.ok ? (
            <>✅ Distribuição aplicada em {result.count} {result.count === 1 ? 'campanha' : 'campanhas'}.</>
          ) : (
            <>
              {result.count > 0 && <>✅ Aplicada em {result.count}. </>}
              ⚠️ Falha em {result.errors.length} {result.errors.length === 1 ? 'campanha' : 'campanhas'}:
              <ul style={{ margin: '6px 0 0 16px', padding: 0, fontWeight: 500 }}>
                {result.errors.slice(0, 3).map(e => (
                  <li key={e.id}>{e.name}: {String(e.reason).slice(0, 120)}</li>
                ))}
                {result.errors.length > 3 && <li>… e mais {result.errors.length - 3}.</li>}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Botão de aplicar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleApply}
          disabled={!canApply}
          aria-busy={applying}
          aria-label={
            activeCount === 0
              ? 'Nenhuma campanha ativa para aplicar'
              : `Aplicar nova distribuição em ${activeCount} ${activeCount === 1 ? 'campanha ativa' : 'campanhas ativas'}`
          }
          style={{
            background: canApply ? 'var(--c-accent)' : 'var(--c-border)',
            color: canApply ? '#fff' : 'var(--c-text-4)',
            border: 'none', borderRadius: '10px',
            padding: '9px 16px', fontSize: '12px', fontWeight: 700,
            cursor: canApply ? 'pointer' : 'not-allowed',
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            transition: 'opacity .15s',
            opacity: applying ? 0.7 : 1,
          }}
        >
          {applying && (
            <span
              aria-hidden="true"
              style={{
                width: '12px', height: '12px',
                border: '2px solid rgba(255,255,255,.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'ccb-spin .7s linear infinite',
              }}
            />
          )}
          {applying
            ? 'Aplicando…'
            : noChangeNeeded
              ? 'Distribuição já está boa'
              : `Aplicar nas campanhas ativas (${activeCount})`}
        </button>
        {activeCount === 0 && (
          <span style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
            Sem campanhas ativas no momento.
          </span>
        )}
      </div>

      {/* Spinner keyframes inline (não polui o CSS global) */}
      <style>{`@keyframes ccb-spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
