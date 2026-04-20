/**
 * IMPORTANTE:
 * Wizard de criação de anúncios Meta Ads.
 * Integração real com Meta Ads API será implementada na fase seguinte.
 * Os dados coletados são enviados via POST /api/campaigns.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppState } from '../contexts/AppStateContext';
import { getRejectionInfo } from '../data/rejectionRules';
import {
  DISTRICT_COORDS,
  analyzeDistrict,
  HOME_COORDS,
  HOME_RADIUS_KM,
  HOME_DISTRICT,
  distanceKm,
  ringByDistance,
} from '../data/joinvilleDistricts';
import { toMetaPayload, newMetaIds } from '../utils/metaNormalize';

// Geofence: aceita localizações até 60km da clínica (Joinville + região metropolitana)
const JOINVILLE_MAX_RADIUS_KM = 60;

function isWithinJoinville(lat, lng) {
  const d = distanceKm(HOME_COORDS, { lat, lng });
  return { ok: d <= JOINVILLE_MAX_RADIUS_KM, distance: d };
}

/* ── Fix Leaflet icons no Vite ── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/* ══════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════ */

const STEPS = ['Objetivo', 'Público', 'Orçamento', 'Criativo', 'Revisar'];

/* ── Coords Joinville/SC — fonte única em data/joinvilleDistricts.js ── */
const CITY_COORDS = DISTRICT_COORDS;

function normalizeAudienceLocations(locs) {
  if (!Array.isArray(locs)) return [];
  return locs
    .map((loc, i) => {
      if (loc && typeof loc === 'object' && loc.lat != null && loc.lng != null) {
        return loc;
      }
      const name = typeof loc === 'string' ? loc : loc?.name;
      if (!name) return null;
      const coords = CITY_COORDS[name];
      if (!coords) return null;
      return {
        id: `legacy-${Date.now()}-${i}`,
        name,
        lat: coords.lat,
        lng: coords.lng,
        radius: 5,
      };
    })
    .filter(Boolean);
}

function normalizeAudienceGender(g) {
  return ({ F: 'female', M: 'male', A: 'all' })[g] || (g || 'all');
}

const META_OBJECTIVES = [
  {
    category: 'Reconhecimento',
    color: '#3B82F6',
    items: [
      { id: 'brand_awareness', label: 'Reconhecimento de marca', icon: '⭐', desc: 'Alcance pessoas com maior probabilidade de lembrar do seu negócio.' },
      { id: 'reach',           label: 'Alcance',                 icon: '📡', desc: 'Exiba seu anúncio para o máximo de pessoas dentro do público.' },
    ],
  },
  {
    category: 'Consideração',
    color: '#8B5CF6',
    items: [
      { id: 'traffic',      label: 'Tráfego',             icon: '🔗', desc: 'Direcione pessoas para seu site, WhatsApp ou aplicativo.' },
      { id: 'engagement',   label: 'Engajamento',         icon: '💬', desc: 'Aumente curtidas, comentários e compartilhamentos.' },
      { id: 'leads',        label: 'Geração de leads',    icon: '📋', desc: 'Colete cadastros de clientes em potencial com formulário nativo.' },
      { id: 'messages',     label: 'Mensagens',           icon: '💌', desc: 'Incentive conversas no WhatsApp, Messenger ou Instagram Direct.' },
      { id: 'app_installs', label: 'Instalações do app',  icon: '📱', desc: 'Aumente os downloads do seu aplicativo.' },
    ],
  },
  {
    category: 'Conversão',
    color: '#d68d8f',
    items: [
      { id: 'sales',         label: 'Vendas',              icon: '🛍️', desc: 'Encontre pessoas com maior probabilidade de comprar.' },
      { id: 'store_traffic', label: 'Tráfego para loja',   icon: '🏪', desc: 'Atraia visitantes para seu estabelecimento físico.' },
    ],
  },
];



const CTA_OPTIONS = [
  'Saiba mais', 'Entrar em contato', 'Reservar agora', 'Enviar mensagem',
  'Inscrever-se', 'Chamar agora', 'Mande uma mensagem', 'WhatsApp',
];

const INTEREST_SUGGESTIONS = [
  /* Genéricos de beleza */
  'Beleza e cosméticos', 'Cuidados com a pele', 'Moda feminina', 'Bem-estar',
  'Saúde e fitness', 'Autoestima', 'Estética e spa', 'Autocuidado',
  /* Sobrancelhas */
  'Sobrancelhas', 'Maquiagem permanente', 'Brow lamination', 'Henna',
  /* Lábios */
  'Lábios',
  /* Cílios */
  'Cílios', 'Lash lifting', 'Extensão de cílios',
  /* Pele */
  'Skincare', 'Limpeza de pele', 'Dermatologia estética', 'Anti-idade',
  /* Cabelo / capilar */
  'Cabelo e penteados', 'Barba', 'Tratamentos capilares', 'Beleza masculina',
  /* Outros */
  'Maquiagem', 'Salão de beleza', 'Cuidados pessoais',
];

const RADIUS_KM = [1, 2, 3, 5, 8, 10];
const JOINVILLE_CENTER = [-26.304, -48.846];

const PT_ACCENT_CHECKS = [
  [/\bnao\b/i, 'não'], [/\bvoce\b/i, 'você'], [/\btambem\b/i, 'também'],
  [/\batencao\b/i, 'atenção'], [/\bpromocao\b/i, 'promoção'], [/\bpromocoes\b/i, 'promoções'],
  [/\binscricao\b/i, 'inscrição'], [/\binformacoes\b/i, 'informações'], [/\bsao\b/i, 'são'],
  [/\balem\b/i, 'além'], [/\bagendamento\b/i, null], [/\boferta\b/i, null],
];

function checkTextQuality(text, label) {
  if (!text) return [];
  const warns = [];
  if (/  /.test(text)) warns.push(`${label}: espaço duplo detectado`);
  if (text !== text.trim()) warns.push(`${label}: espaço no início ou fim do texto`);
  for (const [re, correct] of PT_ACCENT_CHECKS) {
    if (!correct) continue;
    const m = text.match(re);
    if (m) warns.push(`${label}: "${m[0]}" — correto: "${correct}"`);
  }
  return warns;
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

function RadioCard({ selected, onClick, children, style = {} }) {
  return (
    <div
      onClick={onClick}
      style={{
        border: `2px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
        background: selected ? 'rgba(214,141,143,.07)' : 'var(--c-card-bg)',
        borderRadius: '12px', padding: '14px', cursor: 'pointer',
        transition: 'all .15s', ...style,
      }}
    >{children}</div>
  );
}

function Pill({ selected, onClick, children }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
        fontSize: '12px', fontWeight: selected ? 600 : 400,
        border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
        background: selected ? 'rgba(214,141,143,.08)' : 'var(--c-surface)',
        color: selected ? 'var(--c-accent)' : 'var(--c-text-3)',
        transition: 'all .15s', userSelect: 'none',
      }}
    >{children}</div>
  );
}

function SectionLabel({ children, sub }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-2)' }}>{children}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════
   STEP INDICATOR
══════════════════════════════════════════ */

function StepIndicator({ steps, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px', overflowX: 'auto', paddingBottom: '4px' }}>
      {steps.map((s, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: done ? '#22C55E' : active ? 'var(--c-accent)' : 'var(--c-surface)',
                border: `2px solid ${done ? '#22C55E' : active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                color: done || active ? '#fff' : 'var(--c-text-4)',
                transition: 'background .2s, border-color .2s',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: '12px', whiteSpace: 'nowrap',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--c-text-1)' : done ? '#16A34A' : 'var(--c-text-4)',
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: '1px', minWidth: '10px', maxWidth: '36px', margin: '0 6px',
                background: i < current ? '#22C55E' : 'var(--c-border)',
                transition: 'background .2s',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════
   MAPA — sub-componentes internos
══════════════════════════════════════════ */

function MapClickHandler({ onAdd, radius, onReject }) {
  useMapEvents({
    click: async ({ latlng: { lat, lng } }) => {
      const geo = isWithinJoinville(lat, lng);
      if (!geo.ok) {
        onReject?.(geo.distance);
        return;
      }
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'TrafficManager/1.0' } }
        );
        const d = await r.json();
        const name = d.address?.city || d.address?.town || d.address?.village || d.address?.county
          || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        onAdd({ id: Date.now(), name, lat, lng, radius });
      } catch {
        onAdd({ id: Date.now(), name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, lat, lng, radius });
      }
    },
  });
  return null;
}

/* Recalcula tiles do Leaflet quando o container é redimensionado (CSS resize: vertical) */
function MapResizeObserver() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    const parent = container?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { map.invalidateSize(); });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function MapFlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    /* Pan suave até o novo ponto, mantendo o zoom atual
       (antes usava flyTo com zoom 11, que tirava o usuário do nível em que estava). */
    if (center) map.panTo(center, { animate: true, duration: 0.6 });
  }, [center?.[0], center?.[1]]);
  return null;
}

/* ══════════════════════════════════════════
   PASSO 1 — OBJETIVO
══════════════════════════════════════════ */

function Step1Objective({ objective, setObjective, errors = {} }) {
  const allItems = META_OBJECTIVES.flatMap((g) => g.items.map((i) => ({ ...i, category: g.category, color: g.color })));
  const selected = allItems.find((i) => i.id === objective);

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
        Qual é o objetivo da campanha?
      </h2>
      <p style={{ fontSize: '12.5px', color: 'var(--c-text-3)', marginBottom: '16px' }}>
        O Meta vai otimizar a entrega com base no que você escolher.
      </p>

      {META_OBJECTIVES.map(({ category, color, items }) => (
        <div key={category} style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--c-text-3)' }}>
              {category}
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--c-border-lt)' }} />
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
            gap: '6px',
          }}>
            {items.map((obj) => {
              const sel = objective === obj.id;
              const preferred = obj.id === 'messages';
              return (
                <div
                  key={obj.id}
                  onClick={() => setObjective(obj.id)}
                  title={preferred ? `${obj.desc}\n⭐ Preferido da Cris (leads via WhatsApp)` : obj.desc}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px',
                    border: `1.5px solid ${sel ? color : preferred ? '#F59E0B' : 'var(--c-border)'}`,
                    background: sel ? `${color}12` : preferred ? '#FEF3C711' : 'var(--c-card-bg)',
                    borderRadius: '9px', cursor: 'pointer',
                    transition: 'all .12s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.borderColor = color; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.borderColor = preferred ? '#F59E0B' : 'var(--c-border)'; }}
                >
                  <span style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>{obj.icon}</span>
                  <span style={{
                    fontSize: '12px', fontWeight: sel ? 700 : 600,
                    color: sel ? color : 'var(--c-text-1)',
                    lineHeight: 1.25,
                    flex: 1, minWidth: 0,
                  }}>
                    {obj.label}
                  </span>
                  {preferred && (
                    <span
                      title="Preferido da Cris"
                      style={{
                        fontSize: '10px', fontWeight: 800, color: '#A16207',
                        background: '#FEF3C7', padding: '1px 6px', borderRadius: '8px',
                        flexShrink: 0,
                      }}
                    >
                      ⭐
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Descrição do selecionado aparece abaixo, sem poluir os cards */}
      {selected && (
        <div style={{
          marginTop: '10px', padding: '10px 12px',
          background: `${selected.color}0d`,
          border: `1px solid ${selected.color}40`,
          borderLeft: `3px solid ${selected.color}`,
          borderRadius: '8px',
          fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.5,
        }}>
          <strong style={{ color: selected.color }}>{selected.icon} {selected.label}</strong> — {selected.desc}
        </div>
      )}

      {errors.objective && (
        <p style={{ fontSize: '13px', color: '#EF4444', fontWeight: 600, marginTop: '8px' }}>⚠ {errors.objective}</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   PASSO 2 — PÚBLICO
══════════════════════════════════════════ */

function Step2Audience({ locations, setLocations, ageRange, setAgeRange, gender, setGender, interests, setInterests }) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [radius, setRadius]         = useState(5);
  const [customRadius, setCustomRadius] = useState('');
  const [editingRadius, setEditingRadius] = useState(false);
  const [newInt, setNewInt]         = useState('');
  const [locationError, setLocationError] = useState('');
  const debounceRef                 = useRef(null);

  const activeRadius = editingRadius ? (Number(customRadius) || radius) : radius;

  const mapCenter = locations.length > 0
    ? [locations[locations.length - 1].lat, locations[locations.length - 1].lng]
    : null;

  async function search(q) {
    if (!q.trim()) { setResults([]); setHighlighted(0); return; }
    setSearching(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
        { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'TrafficManager/1.0' } }
      );
      const data = await r.json();
      setResults(data);
      setHighlighted(0);
    } catch { setResults([]); }
    setSearching(false);
  }

  function onQueryChange(e) {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 350);
  }

  function addFromResult(r) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    const geo = isWithinJoinville(lat, lng);
    if (!geo.ok) {
      setLocationError(`Essa localização está a ${geo.distance.toFixed(0)}km de Joinville. A Cris atende apenas Joinville e região (até ${JOINVILLE_MAX_RADIUS_KM}km).`);
      setTimeout(() => setLocationError(''), 5000);
      return;
    }
    setLocations(prev => [...prev, {
      id: Date.now(),
      name: r.display_name.split(',').slice(0, 2).join(',').trim(),
      lat,
      lng,
      radius: activeRadius,
    }]);
    setQuery(''); setResults([]); setHighlighted(0);
  }

  function rejectOutOfBounds(distance) {
    setLocationError(`Clique fora da área atendida (${distance.toFixed(0)}km de Joinville). Limite: ${JOINVILLE_MAX_RADIUS_KM}km.`);
    setTimeout(() => setLocationError(''), 5000);
  }

  function onKeyDown(e) {
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[highlighted]) addFromResult(results[highlighted]); }
    else if (e.key === 'Escape') { setResults([]); setHighlighted(0); }
  }

  function removeLocation(id) { setLocations(prev => prev.filter(l => l.id !== id)); }

  function updateLocRadius(id, r) {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, radius: r } : l));
  }

  function setCustomLocRadius(id, val) {
    const n = Number(val);
    if (n > 0) setLocations(prev => prev.map(l => l.id === id ? { ...l, radius: n, custom: true } : l));
  }

  function addInterest(v) {
    const t = v.trim();
    if (t && !interests.includes(t)) setInterests(prev => [...prev, t]);
    setNewInt('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-text-1)' }}>
        Quem vai ver seu anúncio?
      </h2>

      {/* ── Localização ── */}
      <div>
        <SectionLabel sub="Digite o nome do bairro ou cidade — pressione Enter ou ↑↓ para navegar e selecionar. Você também pode clicar diretamente no mapa.">
          Localização
        </SectionLabel>

        {locationError && (
          <div role="alert" style={{
            padding: '10px 12px', marginBottom: '10px', borderRadius: '10px',
            background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.3)',
            color: '#B91C1C', fontSize: '12px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            🚫 {locationError}
          </div>
        )}

        {/* Barra de busca + raio */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          {/* Campo de busca com teclado */}
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', padding: '8px 12px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--c-text-4)', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Bairro ou cidade... (Enter para adicionar)"
                value={query}
                onChange={onQueryChange}
                onKeyDown={onKeyDown}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--c-text-1)', fontFamily: 'inherit', width: '100%' }}
              />
              {searching && <span style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>…</span>}
            </div>

            {/* Dropdown com highlight por teclado */}
            {results.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '10px', zIndex: 9999, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                {results.map((r, i) => (
                  <div
                    key={r.place_id}
                    onMouseDown={() => addFromResult(r)}
                    onMouseEnter={() => setHighlighted(i)}
                    style={{
                      padding: '9px 14px', cursor: 'pointer', fontSize: '12px',
                      color: i === highlighted ? '#fff' : 'var(--c-text-1)',
                      background: i === highlighted ? 'var(--c-accent)' : 'transparent',
                      borderBottom: '1px solid var(--c-border-lt)',
                      transition: 'background .1s',
                    }}
                  >
                    📍 {r.display_name.split(',').slice(0, 3).join(',')}
                  </div>
                ))}
                <div style={{ padding: '6px 14px', fontSize: '10px', color: 'var(--c-text-4)', background: 'var(--c-surface)' }}>
                  ↑↓ navegar · Enter selecionar · Esc fechar
                </div>
              </div>
            )}
          </div>

          {/* Seletor de raio com opção de editar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {editingRadius ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={customRadius}
                  onChange={e => setCustomRadius(e.target.value)}
                  placeholder="km"
                  autoFocus
                  style={{ width: '70px', padding: '8px 10px', border: '1.5px solid var(--c-accent)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
                />
                <button
                  onClick={() => { if (Number(customRadius) > 0) setRadius(Number(customRadius)); setEditingRadius(false); }}
                  style={{ padding: '8px 10px', background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >✓</button>
                <button
                  onClick={() => { setEditingRadius(false); setCustomRadius(''); }}
                  style={{ padding: '8px 10px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', fontSize: '12px', color: 'var(--c-text-3)', cursor: 'pointer' }}
                >✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <select
                  value={radius}
                  onChange={e => setRadius(Number(e.target.value))}
                  style={{ padding: '8px 12px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  {RADIUS_KM.map(r => <option key={r} value={r}>{r} km de raio</option>)}
                </select>
                <button
                  onClick={() => { setCustomRadius(String(radius)); setEditingRadius(true); }}
                  title="Definir raio personalizado"
                  style={{ padding: '8px 10px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', fontSize: '12px', color: 'var(--c-text-3)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >✏️ Editar</button>
              </div>
            )}
          </div>
        </div>

        {/* Tags de localizações selecionadas */}
        {locations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {locations.map(loc => (
              <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'rgba(214,141,143,.08)', border: '1px solid rgba(214,141,143,.25)', borderRadius: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--c-accent)', fontWeight: 600, flex: 1, minWidth: '100px' }}>📍 {loc.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>Raio:</span>
                  {loc.custom ? (
                    <input
                      type="number"
                      min={1}
                      value={loc.radius}
                      onChange={e => setCustomLocRadius(loc.id, e.target.value)}
                      style={{ width: '60px', padding: '2px 6px', border: '1px solid var(--c-accent)', borderRadius: '6px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '11px', fontFamily: 'inherit' }}
                    />
                  ) : (
                    <select
                      value={loc.radius}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === 'custom') setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, custom: true } : l));
                        else updateLocRadius(loc.id, Number(v));
                      }}
                      style={{ padding: '2px 6px', border: '1px solid var(--c-border)', borderRadius: '6px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '11px', fontFamily: 'inherit' }}
                    >
                      {RADIUS_KM.map(r => <option key={r} value={r}>{r} km</option>)}
                      <option value="custom">✏️ Personalizar</option>
                    </select>
                  )}
                  {loc.custom && <span style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>km</span>}
                  <button
                    onClick={() => removeLocation(loc.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--c-accent)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mapa */}
        <div className="leaflet-map-container">
          <MapContainer center={JOINVILLE_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapResizeObserver />
            <MapClickHandler onAdd={loc => setLocations(prev => [...prev, loc])} radius={activeRadius} onReject={rejectOutOfBounds} />
            <MapFlyTo center={mapCenter} />

            {/* Anéis de potencial centrados na clínica (Boa Vista) */}
            <Circle
              center={[HOME_COORDS.lat, HOME_COORDS.lng]}
              radius={8000}
              pathOptions={{ color: '#D97706', fillColor: '#D97706', fillOpacity: 0.03, weight: 1, dashArray: '4 6' }}
            />
            <Circle
              center={[HOME_COORDS.lat, HOME_COORDS.lng]}
              radius={7000}
              pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.04, weight: 1, dashArray: '4 6' }}
            />
            <Circle
              center={[HOME_COORDS.lat, HOME_COORDS.lng]}
              radius={5000}
              pathOptions={{ color: '#16A34A', fillColor: '#16A34A', fillOpacity: 0.05, weight: 1, dashArray: '4 6' }}
            />
            {/* Ponto da clínica */}
            <Circle
              center={[HOME_COORDS.lat, HOME_COORDS.lng]}
              radius={120}
              pathOptions={{ color: '#d68d8f', fillColor: '#d68d8f', fillOpacity: 1, weight: 2 }}
            />

            {locations.map(loc => (
              <Circle
                key={loc.id}
                center={[loc.lat, loc.lng]}
                radius={loc.radius * 1000}
                pathOptions={{ color: '#d68d8f', fillColor: '#d68d8f', fillOpacity: 0.18, weight: 2 }}
              />
            ))}
          </MapContainer>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '6px' }}>
          Clique no mapa para adicionar regiões ou use a busca acima.
        </p>
      </div>

      {/* ── Faixa etária ── */}
      <div>
        <SectionLabel>{`Faixa etária: ${ageRange[0]} – ${ageRange[1]}${ageRange[1] === 65 ? '+' : ''} anos`}</SectionLabel>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginBottom: '6px' }}>Mínimo: {ageRange[0]} anos</div>
            <input type="range" min={18} max={64} value={ageRange[0]}
              onChange={e => setAgeRange(prev => [Math.min(Number(e.target.value), prev[1] - 1), prev[1]])}
              style={{ width: '100%' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginBottom: '6px' }}>Máximo: {ageRange[1]}{ageRange[1] === 65 ? '+' : ''} anos</div>
            <input type="range" min={19} max={65} value={ageRange[1]}
              onChange={e => setAgeRange(prev => [prev[0], Math.max(Number(e.target.value), prev[0] + 1)])}
              style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* ── Gênero ── */}
      <div>
        <SectionLabel>Gênero</SectionLabel>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[{ v: 'all', l: 'Todos' }, { v: 'female', l: 'Feminino' }, { v: 'male', l: 'Masculino' }].map(g => (
            <Pill key={g.v} selected={gender === g.v} onClick={() => setGender(g.v)}>{g.l}</Pill>
          ))}
        </div>
      </div>

      {/* Idioma: fixo em Português internamente — não exibido no front */}

      {/* ── Interesses ── */}
      <div>
        <SectionLabel sub="Segmente por interesses, comportamentos e dados demográficos.">
          Interesses e comportamentos
        </SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {INTEREST_SUGGESTIONS.filter(s => !interests.includes(s)).map(s => (
            <div
              key={s}
              onClick={() => setInterests(prev => [...prev, s])}
              style={{ padding: '5px 11px', border: '1px dashed var(--c-border)', borderRadius: '20px', fontSize: '11px', color: 'var(--c-text-3)', cursor: 'pointer', transition: 'all .12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.color = 'var(--c-accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-3)'; }}
            >+ {s}</div>
          ))}
        </div>
        {interests.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {interests.map(i => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(214,141,143,.08)', border: '1px solid rgba(214,141,143,.25)', borderRadius: '20px', fontSize: '12px', color: 'var(--c-accent)', fontWeight: 600 }}>
                {i}
                <span onClick={() => setInterests(prev => prev.filter(x => x !== i))} style={{ cursor: 'pointer', fontWeight: 700 }}>×</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Digitar interesse personalizado..."
            value={newInt}
            onChange={e => setNewInt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addInterest(newInt)}
            style={{ flex: 1, padding: '8px 12px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
          />
          <button onClick={() => addInterest(newInt)} style={{ padding: '8px 14px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', fontSize: '12px', color: 'var(--c-text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Adicionar
          </button>
        </div>
      </div>

      {/* ── Públicos personalizados — em breve ── */}
      <div style={{ padding: '14px 16px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)', marginBottom: '2px' }}>Públicos personalizados & Lookalike</div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>Retargeting, lista de clientes e públicos semelhantes — disponível após integração Meta Ads.</div>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--c-accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>Em breve</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   PASSO 3 — ORÇAMENTO
══════════════════════════════════════════ */

/* Classifica cada location pelo anel (primário/médio/externo/fora) */
function classifyLocationsByRing(locations) {
  const buckets = { primario: [], medio: [], externo: [], fora: [] };
  (locations || []).forEach(loc => {
    if (loc.lat == null || loc.lng == null) return;
    const d = distanceKm(HOME_COORDS, { lat: loc.lat, lng: loc.lng });
    if (d <= 5) buckets.primario.push(loc);
    else if (d <= 7) buckets.medio.push(loc);
    else if (d <= 8) buckets.externo.push(loc);
    else buckets.fora.push(loc);
  });
  return buckets;
}

/* Split 100% entre anéis ativos com ajuste automático */
function normalizeSplit(split, activeKeys) {
  const base = { primario: 0, medio: 0, externo: 0 };
  const cleaned = { ...base, ...split };
  const activeSum = activeKeys.reduce((s, k) => s + (Number(cleaned[k]) || 0), 0);
  if (activeSum === 0 && activeKeys.length > 0) {
    const even = Math.round(100 / activeKeys.length);
    const out = { ...base };
    activeKeys.forEach((k, i) => out[k] = i === activeKeys.length - 1 ? 100 - even * (activeKeys.length - 1) : even);
    return out;
  }
  return cleaned;
}

function RingBudgetSplit({ locations, budgetValue, budgetType, split, setSplit }) {
  const buckets = classifyLocationsByRing(locations);
  const activeKeys = ['primario', 'medio', 'externo'].filter(k => buckets[k].length > 0);
  const validLocations = (locations || []).filter(l => l && l.lat != null && l.lng != null);

  /* Estados informativos antes do split aparecer */
  if (validLocations.length === 0) return null; /* sem localizações, nada a fazer */

  if (activeKeys.length < 2) {
    const only = activeKeys[0];
    const labels = { primario: 'anel interno (0-5 km)', medio: 'anel médio (5-7 km)', externo: 'anel externo (7-8 km)', fora: 'fora do raio de 8 km' };
    const onlyLabel = only ? labels[only] : (buckets.fora.length > 0 ? labels.fora : 'no mesmo anel');
    return (
      <div style={{
        border: '1px dashed var(--c-border)',
        borderRadius: '12px',
        padding: '14px 16px',
        background: 'var(--c-surface)',
        fontSize: '12px', color: 'var(--c-text-3)', lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--c-text-2)' }}>🎯 Split por anel indisponível</strong> — todas as suas localizações caem {only ? `no ${onlyLabel}` : onlyLabel}.
        Para dividir o orçamento entre anéis diferentes, adicione bairros de outras distâncias do Boa Vista (ex: Boa Vista está no anel interno; Glória no anel médio).
      </div>
    );
  }

  if (!budgetValue || Number(budgetValue) <= 0) {
    return (
      <div style={{
        border: '1px dashed var(--c-accent)',
        borderRadius: '12px',
        padding: '14px 16px',
        background: 'rgba(214,141,143,.05)',
        fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--c-accent)' }}>🎯 Split por anel pronto</strong> — suas localizações cobrem {activeKeys.length} anéis.
        Digite o <strong>orçamento</strong> acima e o controle de divisão por % aparece aqui.
      </div>
    );
  }

  const normalized = normalizeSplit(split, activeKeys);
  const total = activeKeys.reduce((s, k) => s + (Number(normalized[k]) || 0), 0);
  const balanced = total === 100;
  const value = Number(budgetValue) || 0;

  const RINGS = [
    { key: 'primario', label: 'Anel interno (0–5 km)', color: '#16A34A', desc: 'Ticket alto · micropigmentação, glow lips' },
    { key: 'medio',    label: 'Anel médio (5–7 km)',   color: '#F59E0B', desc: 'Ticket médio · pacotes, combos' },
    { key: 'externo',  label: 'Anel externo (7–8 km)', color: '#D97706', desc: 'Ticket de entrada · lash, brow, limpeza' },
  ];

  function onChange(key, v) {
    const next = { ...normalized, [key]: Math.max(0, Math.min(100, Math.round(Number(v) || 0))) };
    setSplit(next);
  }

  function applyPreset(p) {
    const presets = {
      even: Object.fromEntries(activeKeys.map(k => [k, Math.round(100 / activeKeys.length)])),
      high: { primario: 60, medio: 30, externo: 10 },
      volume: { primario: 20, medio: 40, externo: 40 },
      balanced: { primario: 40, medio: 40, externo: 20 },
    }[p] || {};
    setSplit(normalizeSplit(presets, activeKeys));
  }

  return (
    <div style={{
      border: '1.5px solid var(--c-border)',
      borderRadius: '12px',
      padding: '16px 18px',
      background: 'var(--c-surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px' }}>
            🎯 Dividir orçamento por anel
          </div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)', lineHeight: 1.5 }}>
            Você marcou bairros em mais de um anel. Defina quanto % vai pra cada. Quando integrarmos o Meta Ads, isso gera um conjunto de anúncios por anel.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { k: 'balanced', l: '40/40/20' },
            { k: 'high',     l: 'Foco ticket alto' },
            { k: 'volume',   l: 'Foco volume' },
            { k: 'even',     l: 'Dividir igual' },
          ].map(p => (
            <button
              key={p.k}
              type="button"
              onClick={() => applyPreset(p.k)}
              style={{ padding: '5px 9px', borderRadius: '7px', border: '1px solid var(--c-border)', background: 'var(--c-card-bg)', fontSize: '10.5px', fontWeight: 600, color: 'var(--c-text-3)', cursor: 'pointer' }}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {RINGS.filter(r => activeKeys.includes(r.key)).map(r => {
          const pct = Number(normalized[r.key]) || 0;
          const share = (value * pct / 100).toFixed(2).replace('.', ',');
          const hoods = buckets[r.key].map(l => l.name).join(', ');
          return (
            <div key={r.key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: r.color, display: 'inline-block' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-1)' }}>{r.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={pct}
                    onChange={e => onChange(r.key, e.target.value)}
                    style={{ width: '58px', padding: '4px 8px', border: '1px solid var(--c-border)', borderRadius: '6px', background: 'var(--c-card-bg)', color: 'var(--c-text-1)', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>%</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-accent)', minWidth: '72px', textAlign: 'right' }}>
                    R$ {share}{budgetType === 'daily' ? '/dia' : budgetType === 'weekly' ? '/sem' : ''}
                  </span>
                </div>
              </div>
              <input
                type="range" min={0} max={100} value={pct}
                onChange={e => onChange(r.key, e.target.value)}
                style={{ width: '100%', accentColor: r.color }}
              />
              <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '3px', lineHeight: 1.4 }}>
                {r.desc}{hoods ? ` · ${hoods}` : ''}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: '12px', padding: '8px 12px', borderRadius: '8px',
        background: balanced ? 'rgba(22,163,74,.08)' : 'rgba(239,68,68,.07)',
        border: `1px solid ${balanced ? 'rgba(22,163,74,.3)' : 'rgba(239,68,68,.3)'}`,
        fontSize: '11.5px', fontWeight: 700,
        color: balanced ? '#16A34A' : '#DC2626',
        textAlign: 'center',
      }}>
        {balanced ? `✅ Total: 100% · R$\u00A0${value.toFixed(2).replace('.', ',')} distribuídos` : `⚠️ Total: ${total}% — ajuste para fechar 100%`}
      </div>

    </div>
  );
}

function Step4Budget({ budgetType, setBudgetType, budgetValue, setBudgetValue, startDate, setStartDate, endDate, setEndDate, errors = {}, locations = [], budgetRingSplit, setBudgetRingSplit }) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>Orçamento e programação</h2>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>Defina quanto investir e por quanto tempo o anúncio ficará ativo.</p>
      </div>

      {/* Tipo de orçamento */}
      <div>
        <SectionLabel>Tipo de orçamento</SectionLabel>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { v: 'daily',   l: 'Diário',             d: 'Gaste até X reais por dia' },
            { v: 'weekly',  l: 'Semanal',             d: 'Gaste até X reais por semana' },
            { v: 'total',   l: 'Total da campanha',   d: 'Gaste X reais no período total' },
          ].map(t => (
            <RadioCard key={t.v} selected={budgetType === t.v} onClick={() => setBudgetType(t.v)} style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: budgetType === t.v ? 'var(--c-accent)' : 'var(--c-text-1)', marginBottom: '2px' }}>{t.l}</div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>{t.d}</div>
            </RadioCard>
          ))}
        </div>
      </div>

      {/* Valor */}
      <div>
        <SectionLabel>{{ daily: 'Orçamento diário', weekly: 'Orçamento semanal', total: 'Orçamento total da campanha' }[budgetType]}</SectionLabel>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--c-surface)', border: `1.5px solid ${errors.budgetValue ? '#EF4444' : 'var(--c-border)'}`, borderRadius: '10px', padding: '0 16px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-accent)' }}>R$</span>
          <input
            type="number"
            min={1}
            step={0.01}
            placeholder="0,00"
            value={budgetValue}
            onChange={e => setBudgetValue(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '20px', fontWeight: 700, color: 'var(--c-text-1)', fontFamily: 'inherit', padding: '10px 0', width: '120px' }}
          />
        </div>
        {errors.budgetValue && <p style={{ fontSize: '12px', color: '#EF4444', fontWeight: 600, marginTop: '6px' }}>⚠ {errors.budgetValue}</p>}
        {budgetValue && budgetType === 'daily' && (
          <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '6px' }}>
            Estimativa semanal: <b>R$ {(Number(budgetValue) * 7).toFixed(2).replace('.', ',')}</b>
            {' · '}mensal: <b>R$ {(Number(budgetValue) * 30).toFixed(2).replace('.', ',')}</b>
          </p>
        )}
        {budgetValue && budgetType === 'weekly' && (
          <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '6px' }}>
            Estimativa mensal: <b>R$ {(Number(budgetValue) * 4.33).toFixed(2).replace('.', ',')}</b>
            {' · '}diário: <b>R$ {(Number(budgetValue) / 7).toFixed(2).replace('.', ',')}</b>
          </p>
        )}
      </div>

      {/* Split por anel (aparece só quando há localizações em mais de um anel) */}
      <RingBudgetSplit
        locations={locations}
        budgetValue={budgetValue}
        budgetType={budgetType}
        split={budgetRingSplit}
        setSplit={setBudgetRingSplit}
      />

      {/* Datas */}
      <div>
        <SectionLabel>Programação</SectionLabel>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginBottom: '5px' }}>Data de início *</div>
            <input
              type="date"
              value={startDate || today}
              min={today}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginBottom: '5px' }}>Data de término <span style={{ opacity: 0.6 }}>(opcional)</span></div>
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        {!endDate && <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '6px' }}>Sem data de término: o anúncio ficará ativo até ser pausado manualmente.</p>}
      </div>

    </div>
  );
}

/* ══════════════════════════════════════════
   PREVIEW BLOCK — Feed / Stories / Carrossel
══════════════════════════════════════════ */

function AdMockFeed({ mediaFiles, primaryText, headline, destUrl, ctaButton, scale = 1 }) {
  const media = mediaFiles[0];
  const domain = destUrl ? destUrl.replace(/https?:\/\//, '').split('/')[0] : null;
  // Feed 1080x1350 (4:5). Sombra em cima e embaixo = 10% cada (diferença do 1080x1080 central).
  const mediaW = 320 * scale;
  const mediaH = mediaW * (1350 / 1080); // = 400 * scale
  const shadeH = mediaH * (135 / 1350);   // ~10% = 40 * scale
  return (
    <div style={{ width: 320 * scale, border: '1px solid var(--c-border)', borderRadius: 12 * scale, overflow: 'hidden', background: 'var(--c-card-bg)', fontSize: scale }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 * scale, padding: `${10 * scale}px ${12 * scale}px`, borderBottom: '1px solid var(--c-border-lt)' }}>
        <div style={{ width: 32 * scale, height: 32 * scale, borderRadius: '50%', background: 'linear-gradient(135deg,#E8A4C8,#d68d8f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 * scale, fontWeight: 700, flexShrink: 0 }}>CC</div>
        <div>
          <div style={{ fontSize: 12 * scale, fontWeight: 600, color: 'var(--c-text-1)' }}>Cris Costa Beauty</div>
          <div style={{ fontSize: 10 * scale, color: 'var(--c-text-4)' }}>Patrocinado · 🌐</div>
        </div>
      </div>
      {primaryText && <div style={{ padding: `${8 * scale}px ${12 * scale}px`, fontSize: 12 * scale, color: 'var(--c-text-1)', lineHeight: 1.4 }}>{primaryText}</div>}
      <div style={{ position: 'relative', width: '100%', height: mediaH, background: 'var(--c-surface)' }}>
        {media ? (
          media.type === 'video'
            ? <video src={media.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <img src={media.url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)', fontSize: 12 * scale }}>Sem mídia (1080×1350)</div>
        )}
        {/* Sombra superior e inferior indicando área fora do 1080×1080 seguro */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: shadeH, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9 * scale, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.8)' }}>zona fora do 1080×1080</span>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: shadeH, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
      </div>
      <div style={{ padding: `${10 * scale}px ${12 * scale}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--c-border-lt)' }}>
        <div>
          {headline && <div style={{ fontSize: 12 * scale, fontWeight: 600, color: 'var(--c-text-1)' }}>{headline}</div>}
          {domain && <div style={{ fontSize: 10 * scale, color: 'var(--c-text-4)' }}>{domain}</div>}
        </div>
        <div style={{ padding: `${5 * scale}px ${12 * scale}px`, background: 'var(--c-accent)', color: '#fff', borderRadius: 6 * scale, fontSize: 11 * scale, fontWeight: 600, flexShrink: 0, marginLeft: 8 * scale }}>{ctaButton}</div>
      </div>
    </div>
  );
}

function AdMockStories({ mediaFiles, primaryText, headline, ctaButton, scale = 1 }) {
  const media = mediaFiles[0];
  return (
    <div style={{ width: 180 * scale, height: 320 * scale, borderRadius: 16 * scale, overflow: 'hidden', background: '#111', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {media ? (
        media.type === 'video'
          ? <video src={media.url} autoPlay muted loop style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <img src={media.url} alt="stories" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#3a1a2e,#d68d8f)' }} />
      )}
      <div style={{ position: 'relative', zIndex: 2, padding: `${10 * scale}px ${10 * scale}px 0`, display: 'flex', alignItems: 'center', gap: 6 * scale }}>
        <div style={{ width: 26 * scale, height: 26 * scale, borderRadius: '50%', background: 'linear-gradient(135deg,#E8A4C8,#d68d8f)', border: `2px solid #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8 * scale, fontWeight: 700 }}>CC</div>
        <div>
          <div style={{ fontSize: 9 * scale, fontWeight: 600, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>Cris Costa Beauty</div>
          <div style={{ fontSize: 8 * scale, color: 'rgba(255,255,255,.7)' }}>Patrocinado</div>
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto', padding: `${8 * scale}px ${10 * scale}px ${12 * scale}px` }}>
        {primaryText && <div style={{ fontSize: 10 * scale, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.8)', marginBottom: 6 * scale, lineHeight: 1.3 }}>{primaryText}</div>}
        {headline && <div style={{ fontSize: 11 * scale, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.8)', marginBottom: 6 * scale }}>{headline}</div>}
        <div style={{ background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(6px)', borderRadius: 20 * scale, padding: `${5 * scale}px ${14 * scale}px`, display: 'inline-block', fontSize: 10 * scale, fontWeight: 700, color: '#fff', border: '1px solid rgba(255,255,255,.4)' }}>
          {ctaButton} ↑
        </div>
      </div>
    </div>
  );
}

function AdMockCarousel({ mediaFiles, headline, destUrl, ctaButton, scale = 1 }) {
  const domain = destUrl ? destUrl.replace(/https?:\/\//, '').split('/')[0] : null;
  const cards = mediaFiles.length > 0 ? mediaFiles : [null, null, null];
  return (
    <div style={{ width: 320 * scale, border: '1px solid var(--c-border)', borderRadius: 12 * scale, overflow: 'hidden', background: 'var(--c-card-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 * scale, padding: `${10 * scale}px ${12 * scale}px`, borderBottom: '1px solid var(--c-border-lt)' }}>
        <div style={{ width: 32 * scale, height: 32 * scale, borderRadius: '50%', background: 'linear-gradient(135deg,#E8A4C8,#d68d8f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 * scale, fontWeight: 700, flexShrink: 0 }}>CC</div>
        <div>
          <div style={{ fontSize: 12 * scale, fontWeight: 600, color: 'var(--c-text-1)' }}>Cris Costa Beauty</div>
          <div style={{ fontSize: 10 * scale, color: 'var(--c-text-4)' }}>Patrocinado · 🌐</div>
        </div>
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', gap: 4 * scale, padding: `0 ${12 * scale}px`, scrollbarWidth: 'none' }}>
        {cards.map((f, i) => (
          <div key={i} style={{ flexShrink: 0, width: 140 * scale, height: 140 * scale, background: 'var(--c-surface)', borderRadius: 8 * scale, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {f ? (
              f.type === 'video'
                ? <video src={f.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <img src={f.url} alt={`card ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 10 * scale, color: 'var(--c-text-4)' }}>Card {i + 1}</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: `${10 * scale}px ${12 * scale}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--c-border-lt)' }}>
        <div>
          {headline && <div style={{ fontSize: 12 * scale, fontWeight: 600, color: 'var(--c-text-1)' }}>{headline}</div>}
          {domain && <div style={{ fontSize: 10 * scale, color: 'var(--c-text-4)' }}>{domain}</div>}
        </div>
        <div style={{ padding: `${5 * scale}px ${12 * scale}px`, background: 'var(--c-accent)', color: '#fff', borderRadius: 6 * scale, fontSize: 11 * scale, fontWeight: 600, flexShrink: 0, marginLeft: 8 * scale }}>{ctaButton}</div>
      </div>
    </div>
  );
}

function PreviewBlock({ adFormat, mediaFiles, primaryText, headline, destUrl, ctaButton }) {
  const tabs = ['Feed', 'Stories', ...(adFormat === 'carousel' ? ['Carrossel'] : [])];
  const [activeTab, setActiveTab] = useState('Feed');
  const [modal, setModal] = useState(false);

  const mockProps = { mediaFiles, primaryText, headline, destUrl, ctaButton };

  function renderMock(scale = 1) {
    if (activeTab === 'Stories') return <AdMockStories {...mockProps} scale={scale} />;
    if (activeTab === 'Carrossel') return <AdMockCarousel {...mockProps} scale={scale} />;
    return <AdMockFeed {...mockProps} scale={scale} />;
  }

  return (
    <div>
      <SectionLabel sub="Clique no preview para ampliar.">Pré-visualização</SectionLabel>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '4px 14px', borderRadius: '20px', border: '1.5px solid', borderColor: activeTab === t ? 'var(--c-accent)' : 'var(--c-border)', background: activeTab === t ? 'var(--c-accent)' : 'transparent', color: activeTab === t ? '#fff' : 'var(--c-text-2)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>{t}</button>
        ))}
      </div>
      <div onClick={() => setModal(true)} style={{ cursor: 'zoom-in', display: 'inline-block' }} title="Clique para ampliar">
        {renderMock(1)}
      </div>
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
            <button onClick={() => setModal(false)} style={{ position: 'absolute', top: -36, right: 0, background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            {renderMock(activeTab === 'Stories' ? 2 : 1.6)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   PASSO 5 — CRIATIVO
══════════════════════════════════════════ */

function Step5Creative({ adFormat, setAdFormat, mediaFiles, setMediaFiles, primaryText, setPrimaryText, headline, setHeadline, destUrl, setDestUrl, ctaButton, setCtaButton, errors = {} }) {
  const fileRef  = useRef(null);
  const [drag, setDrag] = useState(false);
  const [customCta, setCustomCta] = useState('');

  function handleFiles(files) {
    const arr = Array.from(files).map(f => ({
      id: Date.now() + Math.random(),
      file: f,
      url: URL.createObjectURL(f),
      type: f.type.startsWith('video') ? 'video' : 'image',
      name: f.name,
    }));
    setMediaFiles(prev => [...prev, ...arr]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>Crie o anúncio</h2>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>Adicione a mídia e escreva os textos que o público vai ver.</p>
      </div>

      {/* Formato */}
      <div>
        <SectionLabel>Formato do anúncio</SectionLabel>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[{ v: 'image', l: 'Imagem única', icon: '🖼️' }, { v: 'carousel', l: 'Carrossel', icon: '🎠' }, { v: 'video', l: 'Vídeo', icon: '🎬' }].map(f => (
            <RadioCard key={f.v} selected={adFormat === f.v} onClick={() => setAdFormat(f.v)} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '22px', marginBottom: '5px' }}>{f.icon}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: adFormat === f.v ? 'var(--c-accent)' : 'var(--c-text-2)' }}>{f.l}</div>
            </RadioCard>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '6px' }}>
          {adFormat === 'image' && 'Recomendado: 1080×1080 px (feed) ou 1080×1920 px (stories).'}
          {adFormat === 'carousel' && 'Adicione de 2 a 10 cartões. Cada cartão pode ter imagem, título e URL diferentes.'}
          {adFormat === 'video' && 'MP4 ou MOV. Duração máxima: 240 min. Recomendado: 15–30 s.'}
        </p>
      </div>

      {/* Upload de mídia */}
      <div>
        <SectionLabel>Mídia</SectionLabel>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

        {/* Previews */}
        {mediaFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
            {mediaFiles.map(m => (
              <div key={m.id} style={{ position: 'relative' }}>
                {m.type === 'video'
                  ? <video src={m.url} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                  : <img src={m.url} alt={m.name} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                }
                <button
                  onClick={() => setMediaFiles(prev => prev.filter(x => x.id !== m.id))}
                  style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,.65)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`drop-zone${drag ? ' drag-over' : ''}`}
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📁</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            {adFormat === 'carousel' ? 'Adicionar cartões (2–10 imagens)' : 'Clique ou arraste o arquivo aqui'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>JPG, PNG, MP4, MOV · Máx 30 MB por arquivo</div>
        </div>
      </div>

      {/* Texto principal */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <SectionLabel sub="Aparece acima da imagem no feed.">Texto principal</SectionLabel>
          <span style={{ fontSize: '11px', color: primaryText.length > 110 ? 'var(--c-accent)' : 'var(--c-text-4)' }}>{primaryText.length}/125</span>
        </div>
        <textarea
          placeholder="Ex: Cuide da sua beleza com quem entende! Agende agora e ganhe desconto especial. 💅"
          value={primaryText}
          onChange={e => setPrimaryText(e.target.value)}
          maxLength={125}
          rows={3}
          style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${errors.primaryText ? '#EF4444' : 'var(--c-border)'}`, borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
        />
        {errors.primaryText && <p style={{ fontSize: '12px', color: '#EF4444', fontWeight: 600, marginTop: '4px' }}>⚠ {errors.primaryText}</p>}
      </div>

      {/* Título */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <SectionLabel sub="Aparece em destaque abaixo da imagem.">Título</SectionLabel>
          <span style={{ fontSize: '11px', color: headline.length > 35 ? 'var(--c-accent)' : 'var(--c-text-4)' }}>{headline.length}/40</span>
        </div>
        <input
          type="text"
          placeholder="Ex: Cris Costa Beauty — Agende já!"
          value={headline}
          onChange={e => setHeadline(e.target.value)}
          maxLength={40}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Destino do anúncio */}
      <div>
        <SectionLabel sub="Para onde o clique leva. O WhatsApp da Cris já é o padrão — todo anúncio sempre leva ao WhatsApp.">Destino do anúncio</SectionLabel>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setDestUrl('https://wa.me/5547997071161')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px', borderRadius: '10px',
              border: '1.5px solid ' + (destUrl.includes('wa.me') ? '#25D366' : 'var(--c-border)'),
              background: destUrl.includes('wa.me') ? '#25D36618' : 'var(--c-surface)',
              fontSize: '12px', fontWeight: 600, color: destUrl.includes('wa.me') ? '#0F8A49' : 'var(--c-text-2)',
              cursor: 'pointer',
            }}
          >💬 Usar WhatsApp da Cris</button>
          <span style={{ fontSize: '11px', color: 'var(--c-text-4)', alignSelf: 'center' }}>
            ou cole um link personalizado abaixo
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--c-surface)', border: `1.5px solid ${(errors.destUrl || (destUrl && !destUrl.startsWith('http'))) ? '#EF4444' : 'var(--c-border)'}`, borderRadius: '10px', padding: '0 14px', transition: 'border-color .15s' }}>
          <span style={{ fontSize: '13px', color: 'var(--c-text-4)', flexShrink: 0 }}>🔗</span>
          <input
            type="url"
            placeholder="https://wa.me/5547997071161"
            value={destUrl}
            onChange={e => setDestUrl(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--c-text-1)', fontFamily: 'inherit', padding: '10px 0', width: '100%' }}
          />
          {destUrl && destUrl.startsWith('http') && <span style={{ color: '#22C55E', fontSize: '14px' }}>✓</span>}
        </div>
        {(errors.destUrl || (destUrl && !destUrl.startsWith('http'))) && (
          <p style={{ fontSize: '12px', color: '#EF4444', fontWeight: 600, marginTop: '4px' }}>⚠ {errors.destUrl || 'URL deve começar com https://'}</p>
        )}
      </div>

      {/* CTA */}
      <div>
        <SectionLabel sub="Texto do botão que aparece no anúncio.">Botão de chamada para ação (CTA)</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {CTA_OPTIONS.map(cta => (
            <Pill key={cta} selected={ctaButton === cta} onClick={() => { setCtaButton(cta); setCustomCta(''); }}>{cta}</Pill>
          ))}
          <Pill selected={!CTA_OPTIONS.includes(ctaButton) && ctaButton !== ''} onClick={() => {}}>
            <span style={{ color: 'var(--c-text-4)', fontSize: '11px' }}>Personalizado</span>
          </Pill>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Digite um texto personalizado..."
            value={customCta}
            onChange={e => { setCustomCta(e.target.value); if (e.target.value) setCtaButton(e.target.value); }}
            style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Preview */}
      {(mediaFiles.length > 0 || primaryText || headline) && (
        <PreviewBlock
          adFormat={adFormat}
          mediaFiles={mediaFiles}
          primaryText={primaryText}
          headline={headline}
          destUrl={destUrl}
          ctaButton={ctaButton}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   PASSO 6 — REVISAR
══════════════════════════════════════════ */

function Step6Review({ data, onGoTo }) {
  const obj = META_OBJECTIVES.flatMap(g => g.items).find(o => o.id === data.objective);

  const sections = [
    {
      step: 0,
      label: 'Objetivo',
      rows: [obj ? `${obj.icon} ${obj.label}` : '— não definido'],
    },
    {
      step: 1,
      label: 'Público',
      rows: [
        data.locations.length ? `📍 ${data.locations.map(l => l.name).join(' · ')}` : '📍 Brasil (sem segmentação geográfica)',
        `👤 ${data.ageRange[0]}–${data.ageRange[1]}${data.ageRange[1] === 65 ? '+' : ''} anos · ${({ all: 'Todos', female: 'Feminino', male: 'Masculino' })[data.gender] || 'Todos'}`,
        data.interests.length ? `🎯 ${data.interests.slice(0, 3).join(', ')}${data.interests.length > 3 ? ` +${data.interests.length - 3}` : ''}` : null,
      ].filter(Boolean),
    },
    {
      step: 2,
      label: 'Orçamento',
      rows: [
        data.budgetValue ? `💰 R$\u00A0${Number(data.budgetValue).toFixed(2).replace('.', ',')} / ${{ daily: 'dia', weekly: 'semana', total: 'campanha' }[data.budgetType] || 'campanha'}` : '💰 — valor não definido',
        `📅 Início: ${data.startDate || 'hoje'} ${data.endDate ? `· Término: ${data.endDate}` : '· Sem data de término'}`,
      ].filter(Boolean),
    },
    {
      step: 3,
      label: 'Criativo',
      rows: [
        data.adFormat ? `${{ image: '🖼️ Imagem única', carousel: '🎠 Carrossel', video: '🎬 Vídeo' }[data.adFormat]}` : null,
        data.mediaFiles.length ? `📎 ${data.mediaFiles.length} arquivo(s) adicionado(s)` : '📎 Nenhuma mídia adicionada',
        data.headline ? `"${data.headline}"` : null,
        data.destUrl ? `🔗 ${data.destUrl}` : '🔗 URL não definida',
        `🔘 CTA: ${data.ctaButton}`,
      ].filter(Boolean),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>Revisão do anúncio</h2>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>Confirme todas as configurações antes de publicar.</p>
      </div>

      {sections.map(s => (
        <div key={s.label} style={{ background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-3)' }}>{s.label}</span>
            <button
              onClick={() => onGoTo(s.step)}
              style={{ fontSize: '12px', color: 'var(--c-accent)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: '0' }}
            >✏️ Editar</button>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {s.rows.map((row, i) => (
              <div key={i} style={{ fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.5 }}>{row}</div>
            ))}
          </div>
        </div>
      ))}

      {/* Conjuntos de anúncios que serão criados (split por anel) */}
      {(() => {
        const buckets = classifyLocationsByRing(data.locations);
        const activeKeys = ['primario', 'medio', 'externo'].filter(k => buckets[k].length > 0);
        if (activeKeys.length < 2 || !data.budgetValue) return null;
        const split = normalizeSplit(data.budgetRingSplit || {}, activeKeys);
        const total = activeKeys.reduce((s, k) => s + (Number(split[k]) || 0), 0);
        const value = Number(data.budgetValue) || 0;
        const unit = { daily: '/dia', weekly: '/sem', total: ' total' }[data.budgetType] || '';
        const RING_META = {
          primario: { label: 'Anel interno (0-5 km)',  color: '#16A34A' },
          medio:    { label: 'Anel médio (5-7 km)',     color: '#F59E0B' },
          externo:  { label: 'Anel externo (7-8 km)',   color: '#D97706' },
        };
        return (
          <div style={{ background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-3)' }}>
                {activeKeys.length} conjuntos de anúncios serão criados
              </span>
              <button onClick={() => onGoTo(2)} style={{ fontSize: '12px', color: 'var(--c-accent)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none' }}>
                ✏️ Editar split
              </button>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', lineHeight: 1.5 }}>
                Mesmo criativo para todos. Cada conjunto tem seu próprio público e orçamento — o Meta otimiza entrega por conjunto separadamente.
              </div>
              {activeKeys.map(k => {
                const meta = RING_META[k];
                const pct = Number(split[k]) || 0;
                const share = (value * pct / 100).toFixed(2).replace('.', ',');
                const hoods = buckets[k].map(l => l.name).join(', ');
                return (
                  <div key={k} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 12px', borderRadius: '10px',
                    background: 'var(--c-surface)',
                    borderLeft: `4px solid ${meta.color}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px' }}>
                        Conjunto · {meta.label}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--c-text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📍 {hoods}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: meta.color }}>{pct}%</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-2)' }}>R$ {share}{unit}</div>
                    </div>
                  </div>
                );
              })}
              {total !== 100 && (
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#DC2626' }}>
                  ⚠️ Split está em {total}% — ajuste para 100% no passo Orçamento.
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Verificação de qualidade do texto */}
      {(() => {
        const warns = [
          ...checkTextQuality(data.primaryText, 'Texto principal'),
          ...checkTextQuality(data.headline, 'Título'),
        ];
        if (!warns.length) return null;
        return (
          <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)', borderRadius: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626', marginBottom: '8px' }}>🔤 Atenção — possíveis erros de texto:</div>
            <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {warns.map((w, i) => (
                <li key={i} style={{ fontSize: '12px', color: '#B91C1C', lineHeight: 1.5 }}>{w}</li>
              ))}
            </ul>
            <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '8px', marginBottom: 0 }}>Corrija no passo Criativo antes de publicar, se necessário.</p>
          </div>
        );
      })()}

      {/* Aviso de revisão */}
      <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.25)', borderRadius: '12px', fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>
        <span style={{ fontWeight: 700, color: '#B45309' }}>⚠️ Revisão do Meta:</span> Após a publicação, o anúncio passa por análise automática. O processo geralmente ocorre em menos de 24 horas. Certifique-se de que o criativo segue as <a href="https://www.facebook.com/policies/ads/" target="_blank" rel="noreferrer" style={{ color: 'var(--c-accent)' }}>Políticas de Publicidade do Meta</a>.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   PAINEL DE RESUMO
══════════════════════════════════════════ */

function SummaryPanel({ step, objective, locations, budgetType, budgetValue, adFormat }) {
  const obj = META_OBJECTIVES.flatMap(g => g.items).find(o => o.id === objective);
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="wizard-summary-panel" style={{ background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '14px', padding: '18px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--c-text-4)', marginBottom: '14px' }}>Resumo</div>

      {/* ── Mini tracker de etapas ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--c-border-lt)' }}>
        {STEPS.map((s, i) => {
          const done   = i < step;
          const active = i === step;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Círculo numerado */}
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                background: done ? '#22C55E' : active ? 'var(--c-accent)' : 'var(--c-surface)',
                border: `2px solid ${done ? '#22C55E' : active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700,
                color: done || active ? '#fff' : 'var(--c-text-4)',
                transition: 'background .2s, border-color .2s',
              }}>
                {done ? '✓' : i + 1}
              </div>
              {/* Nome da etapa */}
              <span style={{
                fontSize: '11px',
                fontWeight: active ? 600 : 400,
                color: done ? '#16A34A' : active ? 'var(--c-text-1)' : 'var(--c-text-4)',
                transition: 'color .2s',
              }}>{s}</span>
              {/* Badge "atual" */}
              {active && (
                <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 700, color: 'var(--c-accent)', background: 'rgba(214,141,143,.1)', borderRadius: '6px', padding: '1px 5px', whiteSpace: 'nowrap' }}>
                  atual
                </span>
              )}
              {done && (
                <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#16A34A' }}>✓</span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Dados preenchidos ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {obj && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '3px' }}>OBJETIVO</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)' }}>{obj.icon} {obj.label}</div>
          </div>
        )}

        {locations.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '3px' }}>LOCALIZAÇÃO</div>
            {locations.slice(0, 2).map(l => (
              <div key={l.id} style={{ fontSize: '12px', color: 'var(--c-text-2)' }}>📍 {l.name}</div>
            ))}
            {locations.length > 2 && <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>+{locations.length - 2} regiões</div>}
          </div>
        )}

        {budgetValue && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '3px' }}>INVESTIMENTO</div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--c-accent)' }}>
              R$ {Number(budgetValue).toFixed(2).replace('.', ',')}
              <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--c-text-4)' }}> /{{ daily: 'dia', weekly: 'semana', total: 'total' }[budgetType] || 'total'}</span>
            </div>
          </div>
        )}

        {adFormat && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '3px' }}>FORMATO</div>
            <div style={{ fontSize: '12px', color: 'var(--c-text-2)' }}>
              {{ image: '🖼️ Imagem única', carousel: '🎠 Carrossel', video: '🎬 Vídeo' }[adFormat]}
            </div>
          </div>
        )}
      </div>

      {/* Barra de progresso */}
      <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--c-border-lt)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>Progresso</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-accent)' }}>{progress}%</span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '6px' }}>
          Passo {step + 1} de {STEPS.length}: {STEPS[step]}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MODAL DE PUBLICAÇÃO
══════════════════════════════════════════ */

function PublishModal({ onClose, scheduled, startDate }) {
  const dateLabel = startDate ? new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '20px', padding: '40px 36px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.3)', animation: 'fadeIn .25s ease' }}>
        <div style={{ fontSize: '54px', marginBottom: '16px' }}>{scheduled ? '📅' : '🎉'}</div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '10px' }}>
          {scheduled ? 'Campanha agendada!' : 'Anúncio enviado para revisão!'}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--c-text-2)', lineHeight: 1.7, marginBottom: '10px' }}>
          Seu anúncio foi enviado para <strong>revisão do Meta Ads</strong>. Se estiver nas conformidades, será {scheduled ? `publicado automaticamente em ${dateLabel}` : 'publicado em breve'}.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)', lineHeight: 1.6, marginBottom: '20px' }}>
          Você receberá uma notificação no sino quando o Meta aprovar ou reprovar. Se for reprovado, aparecerá na sessão <strong>Reprovados</strong> com o motivo e orientação.
        </p>
        <div style={{ padding: '12px 16px', background: 'rgba(214,141,143,.07)', border: '1px solid rgba(214,141,143,.2)', borderRadius: '10px', fontSize: '12px', color: 'var(--c-text-3)', marginBottom: '24px', lineHeight: 1.5 }}>
          📋 Status atual: <strong style={{ color: 'var(--c-accent)' }}>{scheduled ? `Agendado para ${dateLabel} · Em revisão` : 'Em revisão pelo Meta'}</strong>
        </div>
        <button
          onClick={onClose}
          style={{ padding: '13px 32px', background: 'linear-gradient(135deg,#E8A9AB,#d68d8f)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(214,141,143,.35)', width: '100%' }}
        >
          Ver meus anúncios →
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════ */

export default function CreateAd() {
  const navigate = useNavigate();
  const location = useLocation();
  const commercialDate = location.state?.commercialDate;
  const rejectedAd = location.state?.rejectedAd || null;
  const reuseAudience = location.state?.reuseAudience || null;
  const referenceRef = location.state?.referenceRef || null;
  /* Referência externa (biblioteca de marcas) vira um reuseCreative
     padronizado para aproveitar todo o fluxo existente de quick-start. */
  const reuseCreative = location.state?.reuseCreative || (referenceRef ? {
    id: referenceRef.id,
    name: `${referenceRef.brand} — ${referenceRef.title}`,
    primaryText: referenceRef.primaryText,
    headline: referenceRef.headline,
    cta: referenceRef.cta === 'Enviar mensagem' ? 'WhatsApp' : referenceRef.cta,
  } : null);
  const reviewMode = !!location.state?.reviewMode || !!referenceRef;
  const { addNotification, addAd, updateAd, getAdById, audiences, creatives, addCreative, markCreativeUsed, removeRejectedAd, logHistory, pixel, metaAccount } = useAppState();
  const editId = location.state?.editId || null;
  const editingAd = editId ? getAdById(editId) : null;

  const fixMode = !!rejectedAd;
  const rejectionInfo = fixMode ? getRejectionInfo(rejectedAd.reason) : null;
  const source = rejectedAd?.payload || editingAd || null;

  /* Quick-start: data comercial, reuso de público ou de criativo */
  const hasQuickStart = !!(commercialDate || reuseAudience || reuseCreative);
  const quickFill = hasQuickStart && !source;

  const quickFillAudience = quickFill
    ? (reuseAudience || (audiences.length > 0 ? audiences[0] : null))
    : null;
  const quickFillCreative = quickFill
    ? (reuseCreative || (reviewMode && creatives.length > 0 ? creatives[0] : null))
    : null;

  /* Abrir direto em Revisar apenas quando houver texto disponível para publicar */
  const wantsReview = quickFill && (commercialDate || reviewMode);
  const canReview = wantsReview && (
    !!commercialDate?.preFill?.primaryText ||
    !!quickFillCreative?.primaryText
  );

  const [step, setStep] = useState(
    fixMode && rejectionInfo ? rejectionInfo.step
    : canReview ? 4 /* direto em Revisar quando o quick-start tem texto */
    : 0
  );
  const [errors, setErrors] = useState({});
  const [publishing, setPublishing] = useState(false);

  const initialStart = (() => {
    if (source && source.startDate !== undefined) return source.startDate || '';
    if (!commercialDate?.dateISO) return '';
    const target = new Date(commercialDate.dateISO);
    const start = new Date(target);
    start.setDate(start.getDate() - (commercialDate.daysBefore || 0));
    return start.toISOString().split('T')[0];
  })();

  const initialEnd = (() => {
    if (source && source.endDate !== undefined) return source.endDate || '';
    if (!commercialDate?.dateISO) return '';
    return new Date(commercialDate.dateISO).toISOString().split('T')[0];
  })();

  const DEFAULT_QUICK_BUDGET = 25;
  const initialBudget = (source && source.budgetValue !== undefined)
    ? String(source.budgetValue ?? '')
    : (commercialDate?.dailyBudget
        ? String(commercialDate.dailyBudget)
        : (commercialDate?.suggestedBudget?.daily
            ? String(commercialDate.suggestedBudget.daily)
            : (canReview ? String(DEFAULT_QUICK_BUDGET) : '')));

  /* Normalizar schema do audience reusado para o Step2Audience */
  const normalizedAudienceLocations = normalizeAudienceLocations(quickFillAudience?.locations);
  const normalizedAudienceGender = normalizeAudienceGender(quickFillAudience?.gender);

  /* ── Estado do formulário ── */
  /* Default 'messages' — objetivo preferido da Cris (leads via WhatsApp) */
  const [objective,          setObjective]          = useState(source?.objective || 'messages');
  const [locations,          setLocations]          = useState(source?.locations || (quickFillAudience ? normalizedAudienceLocations : []));
  const [ageRange,           setAgeRange]           = useState(source?.ageRange || (quickFillAudience ? [quickFillAudience.ageMin, quickFillAudience.ageMax] : [18, 65]));
  const [gender,             setGender]             = useState(source?.gender || (quickFillAudience ? normalizedAudienceGender : 'all'));
  const [interests,          setInterests]          = useState(source?.interests || (quickFillAudience?.interests || []));
  const [budgetType,         setBudgetType]         = useState(source?.budgetType || 'daily');
  const [budgetValue,        setBudgetValue]        = useState(initialBudget);
  const [budgetRingSplit,    setBudgetRingSplit]    = useState(source?.budgetRingSplit || { primario: 40, medio: 40, externo: 20 });
  const [startDate,          setStartDate]          = useState(initialStart);
  const [endDate,            setEndDate]            = useState(initialEnd);
  const [adFormat,           setAdFormat]           = useState(source?.adFormat || 'image');
  const [mediaFiles,         setMediaFiles]         = useState(source?.mediaFiles || []);
  const [primaryText,        setPrimaryText]        = useState(source?.primaryText ?? (quickFillCreative?.primaryText || commercialDate?.preFill?.primaryText || ''));
  const [headline,           setHeadline]           = useState(source?.headline ?? (quickFillCreative?.headline || commercialDate?.preFill?.headline || ''));
  const [destUrl,            setDestUrl]            = useState(source?.destUrl || 'https://wa.me/5547997071161');
  const [ctaButton,          setCtaButton]          = useState(source?.ctaButton || quickFillCreative?.cta || 'WhatsApp');

  /* Contexto da abertura do CreateAd (fixMode, data comercial, reuso) já é
     visível no próprio Wizard — notificações no sino são apenas para alertas. */

  function validateStep(s) {
    const errs = {};
    if (s === 0 && !objective) errs.objective = 'Selecione um objetivo para continuar.';
    if (s === 1 && (!locations || locations.length === 0)) {
      errs.locations = 'Adicione ao menos uma localização (Joinville ou região).';
    }
    if (s === 2 && (!budgetValue || Number(budgetValue) <= 0)) errs.budgetValue = 'Defina um valor de orçamento maior que zero.';
    if (s === 3) {
      if (!adFormat) errs.adFormat = 'Escolha o formato do anúncio.';
      if (!primaryText.trim()) errs.primaryText = 'O texto principal é obrigatório.';
      if (!headline.trim()) errs.headline = 'O título é obrigatório.';
      const messageCTAs = ['WhatsApp', 'Enviar mensagem', 'Mande uma mensagem', 'Chamar agora'];
      const needsUrl = !messageCTAs.includes(ctaButton);
      if (needsUrl && !destUrl.trim()) errs.destUrl = 'Com este CTA é preciso informar um destino.';
      else if (destUrl.trim() && !destUrl.startsWith('http')) errs.destUrl = 'A URL deve começar com https://';
    }
    return errs;
  }

  // Revalidação completa de todos os steps antes de publicar.
  // Evita estado inconsistente quando usuário volta, muda campos e pula pra Review.
  function validateAll() {
    const all = {};
    for (let i = 0; i <= 3; i++) Object.assign(all, validateStep(i));
    return all;
  }

  const todayISO = new Date().toISOString().split('T')[0];
  const isScheduled = !!startDate && startDate > todayISO;

  function handlePublish() {
    // Revalidação final — evita estado inválido após navegar entre steps.
    const finalErrs = validateAll();
    if (Object.keys(finalErrs).length > 0) {
      setErrors(finalErrs);
      const firstStepWithError = [0, 1, 2, 3].find(i => Object.keys(validateStep(i)).length > 0);
      if (firstStepWithError !== undefined) setStep(firstStepWithError);
      /* Sino é só pra alertas — formulário já destaca campos inline */
      return;
    }

    // Validar conta Meta conectada
    if (!metaAccount?.connected && !metaAccount?.pageId) {
      addNotification({
        kind: 'warning',
        title: 'Conta Meta não conectada',
        message: 'Conecte sua conta Meta em Plataformas antes de publicar. O anúncio será salvo como rascunho.',
      });
    }

    setPublishing(true);
    const adName = (headline || primaryText.slice(0, 40) || (commercialDate?.name ?? 'Novo anúncio')).trim();

    // IDs Meta fake (serão substituídos pelos reais no primeiro sync).
    // No edit, mantém os IDs anteriores.
    const metaIds = editingAd?.metaCampaignId
      ? {
          metaCampaignId: editingAd.metaCampaignId,
          metaAdSetId:    editingAd.metaAdSetId,
          metaAdId:       editingAd.metaAdId,
          metaCreativeId: editingAd.metaCreativeId,
          imageHash:      editingAd.imageHash,
        }
      : newMetaIds();

    // Serializa mediaFiles pra state — File objects perdem ao reload,
    // guardamos só os metadados + URLs temporárias pra preview.
    const serializedMedia = (mediaFiles || []).map(m => ({
      id:   m.id,
      url:  m.url,
      type: m.type,
      name: m.name,
    }));

    // Referências (em vez de duplicar) quando o user reusa audience/creative
    const audienceId = reuseAudience?.id || null;
    const creativeId = reuseCreative?.id || null;
    const referenceId = referenceRef?.id || null;

    const adPayload = {
      name: adName,
      platform: 'instagram',
      status: isScheduled ? 'review' : 'review',

      // Orçamento (local)
      budget: Number(budgetValue) || 0,
      budgetValue: Number(budgetValue) || 0,
      budgetType, startDate, endDate,
      budgetRingSplit,

      // Público (local)
      objective, locations, ageRange, gender, interests,

      // Criativo (local)
      adFormat, primaryText, headline, destUrl, ctaButton,
      mediaFiles: serializedMedia,

      // Referências a outras entidades salvas
      audienceId, creativeId, referenceId,
      commercialDateId: commercialDate?.id || null,

      // Integração Meta
      pixelId:       pixel?.enabled ? pixel.pixelId : null,
      metaAccountId: metaAccount?.pageId || null,
      ...metaIds,
    };

    // Anexa o payload no schema Meta v20 (pronto pra sync real)
    adPayload.meta = toMetaPayload(adPayload);

    let publishedAd = null;
    if (editingAd) {
      updateAd(editingAd.id, adPayload);
      publishedAd = { ...editingAd, ...adPayload };
    } else {
      publishedAd = addAd(adPayload);
    }
    // Cria criativo reutilizável apenas se o user NÃO reusou um existente
    if (!reuseCreative && primaryText && headline) {
      addCreative({ name: headline, primaryText, headline, destUrl, ctaButton, adFormat });
    } else if (reuseCreative?.id) {
      markCreativeUsed?.(reuseCreative.id);
    }
    logHistory({
      type: fixMode ? 'ad-corrected' : (editingAd ? 'ad-updated' : 'ad-published'),
      title: fixMode
        ? `Correção publicada: ${adName}`
        : editingAd
          ? `Anúncio atualizado: ${adName}`
          : `Anúncio publicado: ${adName}`,
      description: isScheduled
        ? `Agendado para ${new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')}.`
        : 'Enviado ao Meta para revisão.',
      restorable: false,
      payload: publishedAd,
    });
    if (fixMode) {
      removeRejectedAd(rejectedAd.id);
    }
    /* Publicação/correção já aparece no histórico — não vira notificação */
  }

  const reviewData = { objective, locations, ageRange, gender, interests, budgetType, budgetValue, startDate, endDate, adFormat, mediaFiles, primaryText, headline, destUrl, ctaButton, budgetRingSplit };

  const stepComponents = [
    <Step1Objective objective={objective} setObjective={setObjective} errors={errors} />,
    <Step2Audience  locations={locations} setLocations={setLocations} ageRange={ageRange} setAgeRange={setAgeRange} gender={gender} setGender={setGender} interests={interests} setInterests={setInterests} />,
    <Step4Budget budgetType={budgetType} setBudgetType={setBudgetType} budgetValue={budgetValue} setBudgetValue={setBudgetValue} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} errors={errors} locations={locations} budgetRingSplit={budgetRingSplit} setBudgetRingSplit={setBudgetRingSplit} />,
    <Step5Creative adFormat={adFormat} setAdFormat={setAdFormat} mediaFiles={mediaFiles} setMediaFiles={setMediaFiles} primaryText={primaryText} setPrimaryText={setPrimaryText} headline={headline} setHeadline={setHeadline} destUrl={destUrl} setDestUrl={setDestUrl} ctaButton={ctaButton} setCtaButton={setCtaButton} errors={errors} />,
    <Step6Review data={reviewData} onGoTo={(s) => { setErrors({}); setStep(s); }} />,
  ];

  return (
    <div className="page-container">
      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            {fixMode ? 'Corrigir anúncio reprovado' : 'Criar anúncio'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
            {fixMode
              ? `Meta Ads · Ajuste o passo "${STEPS[rejectionInfo?.step] || '—'}" e reenvie — o restante já está preenchido.`
              : quickFill
                ? `Meta Ads · ${
                    commercialDate ? commercialDate.name
                    : reuseCreative ? `Criativo "${reuseCreative.name}"`
                    : reuseAudience ? `Público "${reuseAudience.name}"`
                    : 'Quick-start'
                  } pré-preenchido. ${canReview ? 'Revise e publique, ou personalize se quiser ajustar.' : 'Complete o que falta nos passos abaixo.'}`
                : 'Meta Ads · Configure sua campanha de tráfego pago em 5 passos.'}
          </p>
        </div>
        <button
          onClick={() => navigate('/anuncios')}
          style={{ padding: '8px 16px', border: '1.5px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-3)', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}
        >
          Cancelar
        </button>
      </div>

      {/* ── Step Indicator ── */}
      <StepIndicator steps={STEPS} current={step} />

      {/* ── Layout wizard ── */}
      <div className="wizard-layout">
        {/* Conteúdo do passo */}
        <div style={{ background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '16px', padding: '28px', animation: 'fadeIn .2s ease' }}>
          {fixMode && rejectionInfo && (
            <div style={{
              padding: '14px 16px',
              background: 'rgba(239,68,68,.07)',
              border: '1px solid rgba(239,68,68,.25)',
              borderLeft: '4px solid #EF4444',
              borderRadius: '10px',
              marginBottom: '22px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', letterSpacing: '.5px', marginBottom: '6px' }}>
                ⚠️ MOTIVO DA REPROVAÇÃO
              </div>
              <p style={{ fontSize: '13px', color: 'var(--c-text-2)', margin: '0 0 10px 0', lineHeight: 1.6 }}>
                <strong>{rejectedAd.reason}</strong>{rejectedAd.details ? ` — ${rejectedAd.details}` : ''}
              </p>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', letterSpacing: '.5px', marginBottom: '4px' }}>
                💡 COMO CORRIGIR
              </div>
              <p style={{ fontSize: '12px', color: 'var(--c-text-2)', margin: 0, lineHeight: 1.6 }}>
                {rejectionInfo.hint}
              </p>
              {step !== rejectionInfo.step && (
                <button
                  type="button"
                  onClick={() => { setErrors({}); setStep(rejectionInfo.step); }}
                  style={{
                    marginTop: '10px', padding: '7px 12px',
                    background: 'var(--c-surface)', border: '1.5px solid var(--c-border)',
                    color: 'var(--c-text-2)', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  ← Voltar ao passo "{STEPS[rejectionInfo.step]}"
                </button>
              )}
            </div>
          )}
          {quickFill && canReview && step === 4 && (
            <div style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(214,141,143,.09), rgba(125,74,94,.04))',
              border: '1px solid var(--c-border)',
              borderLeft: '4px solid var(--c-accent)',
              borderRadius: '10px',
              marginBottom: '22px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-accent)', letterSpacing: '.5px', marginBottom: '8px' }}>
                {commercialDate
                  ? `${commercialDate.emoji} PRÉ-PREENCHIDO · ${commercialDate.name.toUpperCase()}`
                  : reuseCreative
                    ? `🎨 PRÉ-PREENCHIDO · CRIATIVO "${reuseCreative.name.toUpperCase()}"`
                    : reuseAudience
                      ? `👥 PRÉ-PREENCHIDO · PÚBLICO "${reuseAudience.name.toUpperCase()}"`
                      : '✨ PRÉ-PREENCHIDO'}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--c-text-2)', margin: '0 0 8px 0', lineHeight: 1.55 }}>
                Revise abaixo o que foi montado:
              </p>
              <ul style={{ fontSize: '12.5px', color: 'var(--c-text-2)', margin: '0 0 12px 20px', lineHeight: 1.7, padding: 0 }}>
                <li><strong>Objetivo:</strong> mensagens no WhatsApp</li>
                {quickFillAudience && (
                  <li><strong>Público:</strong> {quickFillAudience.name} {reuseAudience ? '' : '(padrão salvo)'}</li>
                )}
                {(quickFillCreative || commercialDate) && (
                  <li>
                    <strong>Texto:</strong>{' '}
                    {quickFillCreative
                      ? <>de "{quickFillCreative.name}" {reuseCreative ? '' : '(criativo salvo)'}</>
                      : <>da estratégia desta data</>}
                  </li>
                )}
                {budgetValue && <li><strong>Orçamento:</strong> R$ {budgetValue}/dia</li>}
              </ul>
              <p style={{ fontSize: '12px', color: 'var(--c-text-3)', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                Se tudo estiver certo, é só publicar. Caso queira mudar algo, personalize abaixo.
              </p>
              <button
                type="button"
                onClick={() => { setErrors({}); setStep(0); }}
                style={{
                  padding: '7px 12px',
                  background: 'var(--c-surface)', border: '1.5px solid var(--c-border)',
                  color: 'var(--c-text-2)', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                ✏️ Personalizar do início
              </button>
            </div>
          )}
          {stepComponents[step]}

          {/* Navegação */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--c-border-lt)' }}>
            <button
              onClick={() => { setErrors({}); step > 0 ? setStep(s => s - 1) : navigate('/anuncios'); }}
              style={{ padding: '10px 20px', border: '1.5px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-2)', borderRadius: '10px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              {step === 0 ? 'Cancelar' : '← Voltar'}
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => {
                  const errs = validateStep(step);
                  if (Object.keys(errs).length > 0) { setErrors(errs); return; }
                  setErrors({});
                  /* Quando veio de data comercial/quick-start e só quer ajustar um item,
                     pula direto para a revisão final em vez de avançar passo a passo. */
                  if (canReview) {
                    setStep(STEPS.length - 1);
                  } else {
                    setStep(s => s + 1);
                  }
                }}
                style={{ padding: '10px 26px', background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {canReview ? '✓ Atualizar e voltar à revisão' : 'Próximo →'}
              </button>
            ) : (
              <button
                onClick={handlePublish}
                style={{
                  padding: '11px 28px',
                  background: fixMode
                    ? 'linear-gradient(135deg,#22C55E,#16A34A)'
                    : 'linear-gradient(135deg,#E8A9AB,#d68d8f)',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: fixMode ? '0 4px 16px rgba(22,163,74,.35)' : '0 4px 16px rgba(214,141,143,.35)',
                }}
              >
                {fixMode ? '✅ Corrigir e publicar' : (isScheduled ? '📅 Agendar campanha' : '🚀 Publicar campanha')}
              </button>
            )}
          </div>
        </div>

        {/* Painel de resumo */}
        <SummaryPanel
          step={step}
          objective={objective}
          locations={locations}
          budgetType={budgetType}
          budgetValue={budgetValue}
          adFormat={adFormat}
        />
      </div>

      {publishing && <PublishModal onClose={() => navigate('/anuncios')} scheduled={isScheduled} startDate={startDate} />}
    </div>
  );
}
