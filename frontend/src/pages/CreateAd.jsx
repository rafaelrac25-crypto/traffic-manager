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
import { fetchDistrictInsights, recommendationLine } from '../data/districtInsights';
import { SERVICES, getService } from '../data/services';
import { hasEnoughData, buildBannerLine } from '../data/serviceInsights';
import api from '../services/api';
import { processMediaFile } from '../utils/mediaProcessor';
import { INTEREST_PRESETS } from '../data/interestPresets';
import { getRejectionInfo } from '../data/rejectionRules';
import PublishingModal from '../components/PublishingModal';
import {
  DISTRICT_COORDS,
  analyzeDistrict,
  HOME_COORDS,
  HOME_RADIUS_KM,
  HOME_DISTRICT,
  distanceKm,
  ringByDistance,
  nearestDistrict,
} from '../data/joinvilleDistricts';
import { toMetaPayload, newMetaIds } from '../utils/metaNormalize';
import {
  classifyRings,
  JOINVILLE_MAX_RADIUS_KM,
  MIN_DAILY_PER_RING_BRL,
} from '../config/metaRules';
import Icon from '../components/Icon';

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
      { id: 'brand_awareness', label: 'Reconhecimento de marca', icon: 'star', desc: 'Alcance pessoas com maior probabilidade de lembrar do seu negócio.' },
      { id: 'reach',           label: 'Alcance',                 icon: 'target', desc: 'Exiba seu anúncio para o máximo de pessoas dentro do público.' },
    ],
  },
  {
    category: 'Consideração',
    color: '#8B5CF6',
    items: [
      { id: 'traffic',      label: 'Tráfego',             icon: 'link', desc: 'Direcione pessoas para seu site, WhatsApp ou aplicativo.' },
      { id: 'engagement',   label: 'Engajamento',         icon: 'chat', desc: 'Aumente curtidas, comentários e compartilhamentos.' },
      /* "Geração de leads" removido: Meta v20 exige lead_gen_form_id no creative
         (Instant Forms), e ainda não temos UI pra criar formulários nativos.
         Cris pode usar "Mensagens" pro mesmo objetivo (leads via WhatsApp). */
      { id: 'messages',     label: 'Mensagens',           icon: 'whatsapp', desc: 'Incentive conversas no WhatsApp, Messenger ou Instagram Direct.' },
      { id: 'app_installs', label: 'Instalações do app',  icon: 'phone', desc: 'Aumente os downloads do seu aplicativo.' },
    ],
  },
  {
    category: 'Conversão',
    color: 'var(--c-accent)',
    items: [
      { id: 'sales',         label: 'Vendas',              icon: 'cart', desc: 'Encontre pessoas com maior probabilidade de comprar.' },
      { id: 'store_traffic', label: 'Tráfego para loja',   icon: 'pin', desc: 'Atraia visitantes para seu estabelecimento físico.' },
    ],
  },
];



/* CTAs permitidos pelo Meta v20 por objetivo. Cada label PT-BR mapeia
   pra um enum oficial no Meta (ver frontend/src/utils/metaNormalize.js:
   CTA_TO_META). O wizard só mostra os que são compatíveis com o
   objective escolhido no passo 1 — evita erro 1487891 do Meta. */
const CTA_BY_OBJECTIVE = {
  messages:     ['WhatsApp', 'Enviar mensagem', 'Mande uma mensagem', 'Chamar agora'],
  traffic:      ['Saiba mais', 'Agendar', 'Reservar', 'Comprar agora', 'Inscrever-se', 'Entrar em contato', 'Ver mais', 'Solicitar orçamento'],
  engagement:   ['Saiba mais', 'Enviar mensagem', 'Entrar em contato'],
  leads:        ['Saiba mais', 'Inscrever-se', 'Entrar em contato'],
  sales:        ['Comprar agora', 'Saiba mais', 'Ver mais'],
  brand_awareness: ['Saiba mais', 'Ver mais'],
  reach:        ['Saiba mais', 'Ver mais'],
  app_installs: ['Saiba mais'],
  store_traffic:['Saiba mais', 'Chamar agora', 'Entrar em contato'],
};
const CTA_DEFAULT_BY_OBJECTIVE = {
  messages:     'WhatsApp',
  traffic:      'Saiba mais',
  engagement:   'Saiba mais',
  leads:        'Inscrever-se',
  sales:        'Comprar agora',
  brand_awareness: 'Saiba mais',
  reach:        'Saiba mais',
  app_installs: 'Saiba mais',
  store_traffic:'Chamar agora',
};

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
        border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
        background: selected ? 'var(--c-accent-soft)' : 'var(--c-surface)',
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
        padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
        fontSize: '12px', fontWeight: selected ? 700 : 500,
        border: `1px solid ${selected ? 'rgba(193,53,132,.4)' : 'var(--c-border)'}`,
        background: selected ? 'var(--c-accent-soft)' : 'var(--c-surface)',
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
      {sub && <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', marginTop: '2px', fontWeight: 400 }}>{sub}</div>}
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
                background: done
                  ? 'rgba(52,211,153,.18)'
                  : active
                    ? 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))'
                    : 'var(--c-surface)',
                border: `1.5px solid ${done ? 'rgba(52,211,153,.45)' : active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                color: done ? '#34D399' : active ? '#fff' : 'var(--c-text-4)',
                boxShadow: active ? '0 0 18px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)' : 'none',
                transition: 'background .2s, border-color .2s',
              }}>
                {done ? <Icon name="check" size={11} /> : i + 1}
              </div>
              <span style={{
                fontSize: '12px', whiteSpace: 'nowrap',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--c-text-1)' : done ? '#34D399' : 'var(--c-text-3)',
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: '1px', minWidth: '10px', maxWidth: '36px', margin: '0 6px',
                background: i < current ? 'rgba(52,211,153,.45)' : 'var(--c-border)',
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
      /* Prioriza nome de BAIRRO (suburb/neighbourhood) em vez de 'Joinville' cidade.
         Fallback: calcula o bairro mais próximo da nossa lista local. */
      let name;
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
          { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'TrafficManager/1.0' } }
        );
        const d = await r.json();
        const a = d.address || {};
        name = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.residential;
      } catch { /* ignora — cai no fallback */ }

      if (!name) {
        const nearest = nearestDistrict(lat, lng);
        if (nearest) name = nearest.name;
      }
      if (!name) name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      onAdd({ id: Date.now(), name, lat, lng, radius });
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

function Step1Objective({ objective, setObjective, service, setService, errors = {} }) {
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
                  title={preferred ? `${obj.desc}\n★ Preferido da Cris (leads via WhatsApp)` : obj.desc}
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
                  <Icon name={obj.icon} size={18} />
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
                        fontSize: '10px', fontWeight: 800, color: '#FBBF24',
                        background: 'rgba(251,191,36,.16)', padding: '1px 6px', borderRadius: '8px',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="star" size={10} color="warning" />
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
          <strong style={{ color: selected.color, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icon name={selected.icon} size={14} /> {selected.label}</strong> — {selected.desc}
        </div>
      )}

      {errors.objective && (
        <p style={{ fontSize: '13px', color: '#F87171', fontWeight: 600, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}><Icon name="alert" size={13} color="danger" /> {errors.objective}</p>
      )}

      {/* ── Serviço promovido (opcional) — alimenta recomendação por bairro ── */}
      <div style={{ marginTop: '18px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--c-text-2)', marginBottom: '6px' }}>
          <Icon name="tag" size={13} color="muted" />
          Serviço promovido
          <span style={{ fontWeight: 400, color: 'var(--c-text-4)', fontSize: '11px' }}>(opcional — melhora sugestões de bairro)</span>
        </label>
        <select
          value={service || ''}
          onChange={(e) => setService(e.target.value || undefined)}
          style={{
            width: '100%', padding: '9px 12px',
            border: service ? '1.5px solid var(--c-accent)' : '1px solid var(--c-border)',
            background: 'var(--c-surface)', color: service ? 'var(--c-text-1)' : 'var(--c-text-4)',
            borderRadius: '10px', fontSize: '13px',
            fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: '32px',
          }}
        >
          <option value="">— Não especificado —</option>
          {Object.entries(
            SERVICES.reduce((acc, s) => {
              if (!acc[s.category]) acc[s.category] = [];
              acc[s.category].push(s);
              return acc;
            }, {})
          ).map(([cat, items]) => (
            <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
              {items.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   PASSO 2 — PÚBLICO
══════════════════════════════════════════ */

/* Barra compacta de presets de localização. Salva { bairros + modo de anéis }
   com nome editável, dropdown pra carregar, e modal pra gerenciar. */
function LocationPresetBar({ locations, setLocations, ringsMode, setRingsMode }) {
  const { locationPresets, addLocationPreset, updateLocationPreset, removeLocationPreset } = useAppState();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const hasLocs = Array.isArray(locations) && locations.length > 0;

  function applyPreset(p) {
    const locs = (p.locations || []).map(l => ({
      ...l,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }));
    setLocations(locs);
    if (setRingsMode && p.ringsMode) setRingsMode(p.ringsMode);
    setOpen(false);
  }

  function confirmSave() {
    if (!presetName.trim() || !hasLocs) return;
    addLocationPreset({
      name: presetName.trim(),
      locations: locations.map(({ id, ...rest }) => rest), /* descarta id volátil */
      ringsMode: ringsMode || 'auto',
    });
    setPresetName('');
    setSaving(false);
  }

  function confirmRename(id) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    updateLocationPreset(id, { name: renameValue.trim() });
    setRenamingId(null);
    setRenameValue('');
  }

  const ringsLabel = { auto: 'Auto', '1': '1 anel', '2': '2 anéis', '3': '3 anéis' };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      marginBottom: '10px', fontSize: '11.5px',
    }}>
      {/* Carregar preset */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          disabled={locationPresets.length === 0}
          style={{
            padding: '6px 10px', fontSize: '11.5px', fontWeight: 600,
            border: '1px solid var(--c-border)', borderRadius: '8px',
            background: 'var(--c-surface)', color: 'var(--c-text-2)',
            cursor: locationPresets.length === 0 ? 'not-allowed' : 'pointer',
            opacity: locationPresets.length === 0 ? 0.5 : 1,
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px',
          }}
          title={locationPresets.length === 0 ? 'Nenhum preset salvo ainda' : 'Carregar preset salvo'}
        >
          <Icon name="clipboard" size={13} /> Presets {locationPresets.length > 0 && <span style={{ color: 'var(--c-text-4)' }}>({locationPresets.length})</span>}
          <span style={{ fontSize: '9px' }}>▾</span>
        </button>
        {open && locationPresets.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0,
            minWidth: '260px', maxHeight: '280px', overflowY: 'auto',
            background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
            borderRadius: '10px', boxShadow: 'var(--shadow)', zIndex: 1000,
          }}>
            {locationPresets.map(p => (
              <div
                key={p.id}
                onClick={() => applyPreset(p)}
                style={{
                  padding: '9px 12px', cursor: 'pointer',
                  borderBottom: '1px solid var(--c-border-lt)',
                  fontSize: '12px',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px' }}>{p.name}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)' }}>
                  {(p.locations || []).length} bairro{(p.locations || []).length === 1 ? '' : 's'} · {ringsLabel[p.ringsMode] || 'Auto'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Salvar atual */}
      {!saving ? (
        <button
          type="button"
          onClick={() => { setSaving(true); setPresetName(''); }}
          disabled={!hasLocs}
          style={{
            padding: '6px 10px', fontSize: '11.5px', fontWeight: 600,
            border: '1px solid var(--c-border)', borderRadius: '8px',
            background: 'var(--c-surface)', color: 'var(--c-text-2)',
            cursor: hasLocs ? 'pointer' : 'not-allowed',
            opacity: hasLocs ? 1 : 0.5, fontFamily: 'inherit',
          }}
          title={hasLocs ? 'Salvar os bairros e anéis atuais como preset' : 'Adicione ao menos 1 bairro para salvar'}
        >
          <Icon name="download" size={13} /> Salvar atual
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="text"
            autoFocus
            placeholder="Nome do preset"
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmSave();
              if (e.key === 'Escape') { setSaving(false); setPresetName(''); }
            }}
            style={{
              padding: '6px 10px', border: '1.5px solid var(--c-accent)', borderRadius: '8px',
              background: 'var(--c-surface)', color: 'var(--c-text-1)',
              fontSize: '11.5px', fontFamily: 'inherit', outline: 'none', width: '160px',
            }}
          />
          <button
            type="button"
            onClick={confirmSave}
            disabled={!presetName.trim()}
            style={{
              padding: '6px 10px', fontSize: '11.5px', fontWeight: 600,
              background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: '8px',
              cursor: presetName.trim() ? 'pointer' : 'not-allowed',
              opacity: presetName.trim() ? 1 : 0.5,
            }}
          ><Icon name="check" size={13} /></button>
          <button
            type="button"
            onClick={() => { setSaving(false); setPresetName(''); }}
            style={{
              padding: '6px 10px', fontSize: '11.5px',
              background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px',
              color: 'var(--c-text-3)', cursor: 'pointer',
            }}
          ><Icon name="x" size={13} /></button>
        </div>
      )}

      {/* Gerenciar */}
      {locationPresets.length > 0 && (
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          style={{
            padding: '6px 8px', fontSize: '11.5px',
            border: '1px solid var(--c-border)', borderRadius: '8px',
            background: 'var(--c-surface)', color: 'var(--c-text-3)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
          title="Renomear ou excluir presets"
        ><Icon name="settings" size={14} /></button>
      )}

      {/* Modal de gerenciamento */}
      {manageOpen && (
        <div
          onClick={() => setManageOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="ccb-modal"
            style={{
              borderRadius: '14px',
              padding: '18px 20px', width: '100%', maxWidth: '460px',
              maxHeight: '80vh', overflowY: 'auto',
              border: '1px solid var(--c-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Gerenciar presets</h3>
              <button onClick={() => setManageOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex', alignItems: 'center' }}><Icon name="x" size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {locationPresets.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: '10px',
                  background: 'var(--c-surface)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {renamingId === p.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmRename(p.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onBlur={() => confirmRename(p.id)}
                        style={{
                          width: '100%', padding: '4px 8px', border: '1.5px solid var(--c-accent)',
                          borderRadius: '6px', fontSize: '12.5px', fontWeight: 700,
                          background: 'var(--c-card-bg)', color: 'var(--c-text-1)',
                          fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                    )}
                    <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '2px' }}>
                      {(p.locations || []).length} bairro{(p.locations || []).length === 1 ? '' : 's'} · {ringsLabel[p.ringsMode] || 'Auto'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setRenamingId(p.id); setRenameValue(p.name); }}
                    style={{
                      padding: '5px 9px', fontSize: '11px',
                      background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '7px',
                      color: 'var(--c-text-2)', cursor: 'pointer',
                    }}
                    title="Renomear"
                  ><Icon name="edit" size={13} /></button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Excluir o preset "${p.name}"?`)) removeLocationPreset(p.id);
                    }}
                    style={{
                      padding: '5px 9px', fontSize: '11px',
                      background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '7px',
                      color: '#F87171', cursor: 'pointer',
                    }}
                    title="Excluir"
                  ><Icon name="trash" size={13} color="danger" /></button>
                </div>
              ))}
              {locationPresets.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--c-text-4)', fontSize: '12px' }}>
                  Nenhum preset salvo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Banner discreto com recomendação de bairros baseada em dados reais.
   Fica silencioso até a primeira campanha acumular ≥10 conversões. */
/**
 * Banner de insight de bairro.
 * - Sem service: usa lógica global (média de todos os serviços).
 * - Com service: busca endpoint específico e mostra recomendação focada.
 * - Silencioso quando dados insuficientes.
 */
function DistrictInsightsBanner({ service }) {
  const [insight, setInsight] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (service) {
        /* Busca insights filtrados pelo serviço */
        try {
          const { data } = await api.get(`/api/campaigns/analytics/insights-by-service?service=${encodeURIComponent(service)}`);
          if (cancelled) return;
          if (!hasEnoughData(data)) return; /* silêncio quando sem dados */
          const svc = getService(service);
          const line = buildBannerLine(svc?.label || service, data);
          if (line) setInsight({ line });
        } catch { /* silêncio em erro de rede */ }
      } else {
        /* Fallback global (sem serviço selecionado) */
        const data = await fetchDistrictInsights();
        if (cancelled) return;
        const line = recommendationLine(data);
        if (line) setInsight({ line });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [service]);

  if (!insight || dismissed) return null;

  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 13px', marginBottom: '10px',
      background: 'var(--c-info-soft, rgba(59,130,246,.07))',
      border: '1px solid var(--c-info-border, rgba(59,130,246,.25))',
      borderRadius: '10px',
      fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.5,
    }}>
      <Icon name="lightbulb" size={14} color="info" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{insight.line}</span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-text-4)', fontSize: '14px',
          padding: '0 4px', lineHeight: 1, flexShrink: 0,
        }}
        title="Fechar"
        aria-label="Fechar sugestão"
      ><Icon name="x" size={14} /></button>
    </div>
  );
}

function Step2Audience({ locations, setLocations, ageRange, setAgeRange, gender, setGender, interests, setInterests, ringsMode, setRingsMode, advantageAudience = false, setAdvantageAudience = () => {}, service }) {
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
    /* Prioriza bairro específico (mesma lógica do clique no mapa) */
    const a = r.address || {};
    let name = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.residential;
    if (!name) {
      const nearest = nearestDistrict(lat, lng);
      if (nearest) name = nearest.name;
    }
    if (!name) name = r.display_name.split(',').slice(0, 2).join(',').trim();

    setLocations(prev => [...prev, {
      id: Date.now(),
      name,
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

        <LocationPresetBar
          locations={locations}
          setLocations={setLocations}
          ringsMode={ringsMode}
          setRingsMode={setRingsMode}
        />

        <DistrictInsightsBanner service={service} />

        {locationError && (
          <div role="alert" style={{
            padding: '10px 12px', marginBottom: '10px', borderRadius: '10px',
            background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.3)',
            color: '#F87171', fontSize: '12px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Icon name="x-circle" size={14} color="danger" /> {locationError}
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
                    <Icon name="pin" size={12} /> {r.display_name.split(',').slice(0, 3).join(',')}
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
                ><Icon name="check" size={13} /></button>
                <button
                  onClick={() => { setEditingRadius(false); setCustomRadius(''); }}
                  style={{ padding: '8px 10px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', fontSize: '12px', color: 'var(--c-text-3)', cursor: 'pointer' }}
                ><Icon name="x" size={13} /></button>
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
                  style={{ padding: '8px 10px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', fontSize: '12px', color: 'var(--c-text-3)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                ><Icon name="edit" size={12} /> Editar</button>
              </div>
            )}
          </div>
        </div>

        {/* Tags de localizações selecionadas */}
        {locations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {locations.map(loc => (
              <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'rgba(193,53,132,.08)', border: '1px solid rgba(193,53,132,.25)', borderRadius: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--c-accent)', fontWeight: 600, flex: 1, minWidth: '100px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="pin" size={12} /> {loc.name}</span>
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
              pathOptions={{ color: '#34D399', fillColor: '#34D399', fillOpacity: 0.05, weight: 1, dashArray: '4 6' }}
            />
            {/* Ponto da clínica */}
            <Circle
              center={[HOME_COORDS.lat, HOME_COORDS.lng]}
              radius={120}
              pathOptions={{ color: 'var(--c-accent)', fillColor: 'var(--c-accent)', fillOpacity: 1, weight: 2 }}
            />

            {locations.map(loc => (
              <Circle
                key={loc.id}
                center={[loc.lat, loc.lng]}
                radius={loc.radius * 1000}
                pathOptions={{ color: 'var(--c-accent)', fillColor: 'var(--c-accent)', fillOpacity: 0.18, weight: 2 }}
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

        {/* Presets por serviço — carregam 3 interesses curados de uma vez */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            <Icon name="target" size={12} /> Conjuntos prontos por serviço
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {INTEREST_PRESETS.map(p => {
              const allPresent = p.interests.every(i => interests.includes(i));
              return (
                <button
                  key={p.id}
                  type="button"
                  title={`${p.description}\n\nAdiciona: ${p.interests.join(', ')}`}
                  onClick={() => {
                    if (allPresent) {
                      /* Todos já estão: remove esses 3 */
                      setInterests(prev => prev.filter(i => !p.interests.includes(i)));
                    } else {
                      /* Adiciona os que faltam */
                      setInterests(prev => [...prev, ...p.interests.filter(i => !prev.includes(i))]);
                    }
                  }}
                  style={{
                    padding: '7px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 600,
                    border: `1px solid ${allPresent ? 'var(--c-accent)' : 'var(--c-border)'}`,
                    background: allPresent ? 'rgba(193,53,132,.10)' : 'var(--c-surface)',
                    color: allPresent ? 'var(--c-accent)' : 'var(--c-text-2)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <span>{p.emoji}</span>
                  <span>{p.service}</span>
                  {allPresent && <Icon name="check" size={13} color="success" />}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '5px', lineHeight: 1.5 }}>
            Cada botão adiciona 3 interesses curados pro Meta reconhecer e otimizar. Clique de novo pra remover.
          </div>
        </div>

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
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(193,53,132,.08)', border: '1px solid rgba(193,53,132,.25)', borderRadius: '20px', fontSize: '12px', color: 'var(--c-accent)', fontWeight: 600 }}>
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

      {/* Advantage+ Audience toggle (off por padrão pra Cris) */}
      <div style={{ marginTop: '16px', padding: '12px 14px', border: '1px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-bg-2)' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!advantageAudience}
            onChange={(e) => setAdvantageAudience(e.target.checked)}
            style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--c-accent)' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)' }}>
              Permitir Meta expandir público (Advantage+ Audience)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '4px', lineHeight: 1.4 }}>
              {advantageAudience
                ? '✅ ATIVADO — Meta vai mostrar o anúncio também pra perfis fora dos seus interesses/idade se achar que vão converter. Recomendado quando você quer alcance.'
                : '⏸️ DESATIVADO — Meta respeita exatamente os interesses, idade e bairros que você definiu. Recomendado pra negócio hiperlocal como o da Cris.'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-5)', marginTop: '4px', fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <Icon name="alert" size={11} color="warning" style={{ flexShrink: 0, marginTop: '1px' }} /> Em alguns objetivos Meta força ATIVO mesmo quando desligado — confirme via Audit após publicar.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   PASSO 3 — ORÇAMENTO
══════════════════════════════════════════ */

/* Classifica bairros em anéis. Delega à implementação única em
   `config/metaRules.js` — esse wrapper só preserva a chave `fora: []`
   esperada pelo código de UI legado (label "fora do raio de 8 km"). */
function classifyLocationsByRing(locations, ringsMode = 'auto') {
  const buckets = classifyRings(locations, ringsMode);
  return { ...buckets, fora: [] };
}

/* Split 100% entre anéis ativos — garante que o %s dos activeKeys somem 100,
   mesmo quando o split vem com valores de anéis que foram desativados.
   Ex: default {primario:40, medio:40, externo:20} com activeKeys=['primario']
   precisa virar {primario:100, ...} senão o daily por anel sai errado (40%
   do daily em vez de 100%). */
function normalizeSplit(split, activeKeys) {
  const base = { primario: 0, medio: 0, externo: 0 };
  const cleaned = { ...base, ...split };
  if (activeKeys.length === 0) return cleaned;

  /* 1 anel ativo: 100% nele, sempre. */
  if (activeKeys.length === 1) {
    return { ...base, [activeKeys[0]]: 100 };
  }

  const activeSum = activeKeys.reduce((s, k) => s + (Number(cleaned[k]) || 0), 0);
  /* Zerado em todos os ativos → divide igualmente */
  if (activeSum === 0) {
    const even = Math.round(100 / activeKeys.length);
    const out = { ...base };
    activeKeys.forEach((k, i) => out[k] = i === activeKeys.length - 1 ? 100 - even * (activeKeys.length - 1) : even);
    return out;
  }
  /* Soma dos ativos ≠ 100 → renormaliza proporcionalmente */
  if (activeSum !== 100) {
    const out = { ...base };
    activeKeys.forEach(k => {
      out[k] = Math.round((Number(cleaned[k]) || 0) * 100 / activeSum);
    });
    const diff = 100 - activeKeys.reduce((s, k) => s + out[k], 0);
    if (diff !== 0) out[activeKeys[activeKeys.length - 1]] += diff;
    return out;
  }
  return cleaned;
}

function RingBudgetSplit({ locations, budgetValue, budgetType, split, setSplit, ringsMode = 'auto' }) {
  const buckets = classifyLocationsByRing(locations, ringsMode);
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
        <strong style={{ color: 'var(--c-text-2)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="target" size={13} /> Split por anel indisponível</strong> — todas as suas localizações caem {only ? `no ${onlyLabel}` : onlyLabel}.
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
        background: 'rgba(193,53,132,.05)',
        fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--c-accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="target" size={13} color="accent" /> Split por anel pronto</strong> — suas localizações cobrem {activeKeys.length} anéis.
        Digite o <strong>orçamento</strong> acima e o controle de divisão por % aparece aqui.
      </div>
    );
  }

  const normalized = normalizeSplit(split, activeKeys);
  const total = activeKeys.reduce((s, k) => s + (Number(normalized[k]) || 0), 0);
  const balanced = total === 100;
  const value = Number(budgetValue) || 0;

  const RINGS = [
    { key: 'primario', label: 'Anel interno (0–5 km)', color: '#34D399' },
    { key: 'medio',    label: 'Anel médio (5–7 km)',   color: '#F59E0B' },
    { key: 'externo',  label: 'Anel externo (7–8 km)', color: '#D97706' },
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
    <div className="ccb-card" style={{
      borderRadius: '14px',
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px' }}>
            <Icon name="target" size={13} /> Dividir orçamento por anel
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
                {hoods
                  ? <><Icon name="pin" size={12} /> <strong>{buckets[r.key].length} {buckets[r.key].length === 1 ? 'bairro' : 'bairros'}:</strong> {hoods}</>
                  : 'Nenhum bairro neste anel.'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: '12px', padding: '8px 12px', borderRadius: '8px',
        background: balanced ? 'rgba(52,211,153,.16)' : 'rgba(248,113,113,.12)',
        border: `1px solid ${balanced ? 'rgba(52,211,153,.3)' : 'rgba(248,113,113,.3)'}`,
        fontSize: '11.5px', fontWeight: 700,
        color: balanced ? '#34D399' : '#F87171',
        textAlign: 'center',
      }}>
        {balanced ? `✅ Total: 100% · R$\u00A0${value.toFixed(2).replace('.', ',')} distribuídos` : `⚠️ Total: ${total}% — ajuste para fechar 100%`}
      </div>

      {/* Alerta de budget mínimo — Meta exige R$ 7/dia por ad set (R$ 6 bruto + folga) */}
      {budgetType === 'daily' && balanced && (() => {
        const lowRings = RINGS.filter(r => activeKeys.includes(r.key))
          .map(r => ({ key: r.key, label: r.label, share: value * (Number(normalized[r.key]) || 0) / 100 }))
          .filter(r => r.share < 7);
        if (lowRings.length === 0) return null;
        return (
          <div style={{
            marginTop: '10px', padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(248,113,113,.12)',
            border: '1px solid rgba(248,113,113,.3)',
            fontSize: '11px', lineHeight: 1.5, color: '#F87171',
          }}>
            <strong>⚠ Cada anel precisa de R$ 7/dia no mínimo.</strong> Seu split
            atual deixa {lowRings.length === 1 ? 'um anel' : `${lowRings.length} anéis`} abaixo
            (R$ {lowRings.map(r => r.share.toFixed(2).replace('.', ',')).join(' · R$ ')}).
            {' '}Meta pode recusar. Aumente o orçamento total para pelo menos
            R$ {(7 * activeKeys.length).toFixed(2).replace('.', ',')}/dia, ou reduza os anéis.
          </div>
        );
      })()}

    </div>
  );
}

/* ══════════════════════════════════════════
   PAINEL DE RESUMO DE ORÇAMENTO
   Mostra dias de campanha, divisão por anel com mínimo R$ 7/dia,
   total previsto e comparação com saldo disponível no Meta.
   Saldo vem do /api/campaigns/preflight (debounced).
══════════════════════════════════════════ */
const MIN_DAILY_PER_RING = MIN_DAILY_PER_RING_BRL;

function computeDailyBudget(budgetValue, budgetType, days) {
  const v = Number(budgetValue) || 0;
  if (v <= 0) return 0;
  if (budgetType === 'daily')  return v;
  if (budgetType === 'weekly') return v / 7;
  if (budgetType === 'total')  return days && days > 0 ? v / days : 0;
  return v;
}

/* Converte um Date pra "YYYY-MM-DD" no fuso LOCAL do usuário.
   new Date().toISOString() retorna em UTC — depois das 21h em Brasília
   já virou o dia seguinte em UTC, bloqueando o calendário de selecionar
   "hoje". Esta função usa os getters locais pra respeitar GMT-3. */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeDays(startDate, endDate) {
  if (!startDate || !endDate) return null;
  /* Fuso local fixo pra evitar deslocamento UTC do parser (YYYY-MM-DD vira UTC
     meia-noite e pode cair num dia diferente no Brasil — usa T00:00:00 local). */
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  if (isNaN(s) || isNaN(e) || e < s) return null;
  /* Meta conta período inclusivo: 01/05 a 05/05 = 5 dias (não 4).
     Mesmo dia = 1 dia. */
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

/* Normaliza nome de bairro pra comparar (case/acento insensível).
   Ex: "Boa Vista" e "boa vista" viram a mesma chave. */
function BudgetSummaryPanel({ budgetValue, budgetType, startDate, endDate, locations, budgetRingSplit, ringsMode }) {
  const days = computeDays(startDate, endDate);
  const dailyBudget = computeDailyBudget(budgetValue, budgetType, days);

  const buckets = classifyLocationsByRing(locations, ringsMode);
  const activeKeys = ['primario', 'medio', 'externo'].filter(k => buckets[k].length > 0);
  const normalized = normalizeSplit(budgetRingSplit, activeKeys);

  const RING_LABELS = {
    primario: { label: 'Interno', color: '#34D399' },
    medio:    { label: 'Médio',   color: '#F59E0B' },
    externo:  { label: 'Externo', color: '#D97706' },
  };

  const perRing = activeKeys.map(k => ({
    key: k,
    label: RING_LABELS[k].label,
    color: RING_LABELS[k].color,
    pct: Number(normalized[k]) || 0,
    daily: dailyBudget * (Number(normalized[k]) || 0) / 100,
  }));
  const underMin = perRing.filter(r => r.daily < MIN_DAILY_PER_RING);

  /* Total previsto: se tem dias, daily × dias. Se não, mostra só "por dia". */
  const totalEstimated = days ? dailyBudget * days : null;

  /* Chama /preflight com debounce pra ver saldo real na conta Meta */
  const [balanceState, setBalanceState] = useState({ loading: false, data: null, error: null });

  useEffect(() => {
    /* Só chama se tiver valor e duração definidos */
    if (!(dailyBudget > 0) || !days) {
      setBalanceState({ loading: false, data: null, error: null });
      return;
    }
    const t = setTimeout(async () => {
      setBalanceState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch('/api/campaigns/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budget_daily: Number(dailyBudget.toFixed(2)), days }),
        });
        const json = await res.json();
        const bal = (json.checks || []).find(c => c.key === 'balance');
        const conn = (json.checks || []).find(c => c.key === 'connected');
        if (conn && conn.ok === false) {
          setBalanceState({ loading: false, data: null, error: 'Meta não conectado' });
          return;
        }
        if (!bal) {
          setBalanceState({ loading: false, data: null, error: 'Saldo não retornado pelo Meta' });
          return;
        }
        setBalanceState({
          loading: false,
          data: {
            ok: bal.ok,
            available: bal.data?.available ?? null,
            needed: bal.data?.needed ?? null,
            estimated: bal.data?.estimated ?? null,
            currency: bal.data?.currency || 'BRL',
            details: bal.details,
          },
          error: null,
        });
      } catch (e) {
        setBalanceState({ loading: false, data: null, error: e.message || 'Erro ao consultar saldo' });
      }
    }, 600); /* debounce — evita chamar a cada tecla */
    return () => clearTimeout(t);
  }, [dailyBudget, days]);

  const fmtBRL = (n) => `R$ ${(Number(n) || 0).toFixed(2).replace('.', ',')}`;
  const fmtDate = (d) => {
    try { return new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  /* Estado vazio — precisa de valor + datas pra fazer sentido */
  if (!(dailyBudget > 0)) return null;

  return (
    <div className="ccb-card" style={{
      borderRadius: '14px',
      padding: '14px 18px',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px' }}>
          <Icon name="clipboard" size={13} /> Resumo do investimento
        </div>
        <div style={{ fontSize: '11px', color: 'var(--c-text-4)', lineHeight: 1.5 }}>
          Confira duração, divisão por anel e se seu saldo no Meta cobre a campanha.
        </div>
      </div>

      {/* 1. Duração */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--c-card-bg)' }}>
        <Icon name="calendar" size={16} />
        <div style={{ flex: 1 }}>
          {days ? (
            <>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                {days} {days === 1 ? 'dia' : 'dias'} de campanha
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
                {fmtDate(startDate)} → {fmtDate(endDate)}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-1)' }}>Sem data de término</div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
                Anúncio roda até pausa manual. Defina uma data de término pra ver total e saldo.
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Divisão por anel — só faz sentido com 2+ anéis (1 anel = 100%
         do orçamento, não tem o que dividir) */}
      {perRing.length >= 2 && (
        <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--c-card-bg)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--c-text-2)', marginBottom: '8px' }}>
            <Icon name="money" size={13} /> Divisão diária por anel ({perRing.length === 1 ? '1 anel' : `${perRing.length} anéis`})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {perRing.map(r => {
              const ok = r.daily >= MIN_DAILY_PER_RING;
              const hoods = (buckets[r.key] || []).map(l => l.name);
              return (
                <div key={r.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--c-text-1)', fontWeight: 600, minWidth: '70px' }}>{r.label}</span>
                    <span style={{ color: 'var(--c-text-4)' }}>({r.pct}%)</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontWeight: 700, color: ok ? '#34D399' : '#F87171' }}>
                      {fmtBRL(r.daily)}/dia
                    </span>
                    <span style={{ display: 'flex' }}>{ok ? <Icon name="check-circle" size={14} color="success" /> : <Icon name="x-circle" size={14} color="danger" />}</span>
                  </div>
                  {hoods.length > 0 && (
                    <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginLeft: '16px', marginTop: '3px', lineHeight: 1.45, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Icon name="pin" size={11} /> <strong>{hoods.length} {hoods.length === 1 ? 'bairro' : 'bairros'}:</strong> {hoods.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {underMin.length > 0 && (
            <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '6px', background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.3)', fontSize: '11px', color: '#F87171', lineHeight: 1.5 }}>
              <strong>Abaixo do mínimo.</strong>{' '}
              {activeKeys.length === 1
                ? `Meta exige no mínimo ${fmtBRL(MIN_DAILY_PER_RING)}/dia. Aumente o valor diário.`
                : `Cada anel precisa de pelo menos ${fmtBRL(MIN_DAILY_PER_RING)}/dia. Aumente o orçamento para ${fmtBRL(MIN_DAILY_PER_RING * activeKeys.length)}/dia ou reduza os anéis.`}
            </div>
          )}
        </div>
      )}

      {/* 3. Total previsto — valor bruto + folga 20% Meta */}
      {totalEstimated != null && (() => {
        /* Meta pode gastar até ~25% a mais num dia quente (daily budget
           variance). Padrão da plataforma: reservar 20% de folga no saldo
           pra não pausar anúncio no meio da campanha por falta de fundos. */
        const BALANCE_FOLGA_PCT = 0.20;
        const neededWithFolga = totalEstimated * (1 + BALANCE_FOLGA_PCT);
        return (
          <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--c-card-bg)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icon name="chart-bar" size={16} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11.5px', color: 'var(--c-text-4)' }}>Gasto previsto da campanha</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--c-text-1)' }}>
                  {fmtBRL(totalEstimated)}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)', textAlign: 'right', lineHeight: 1.4 }}>
                {fmtBRL(dailyBudget)}/dia<br />× {days} {days === 1 ? 'dia' : 'dias'}
              </div>
            </div>
            <div style={{ height: '1px', background: 'var(--c-border-lt)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icon name="money" size={16} color="accent" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11.5px', color: 'var(--c-text-4)' }}>
                  Saldo que você precisa ter no Meta
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--c-accent)' }}>
                  {fmtBRL(neededWithFolga)}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)', textAlign: 'right', lineHeight: 1.4 }}>
                {fmtBRL(totalEstimated)}<br />+ 20% folga
              </div>
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', lineHeight: 1.5, paddingTop: '2px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <Icon name="info" size={12} color="info" style={{ flexShrink: 0, marginTop: '1px' }} /> A folga de 20% é recomendação do Meta — alguns dias gastam um pouco mais que o diário. Sem ela, o anúncio pode pausar no meio por falta de saldo.
            </div>
          </div>
        );
      })()}

      {/* 4. Check de saldo (assíncrono) — compara available com needed+20% */}
      {days ? (
        balanceState.loading ? (
          <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--c-card-bg)', fontSize: '12px', color: 'var(--c-text-4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="search" size={13} /> Consultando saldo no Meta…
          </div>
        ) : balanceState.error ? (
          <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(251,191,36,.16)', border: '1px solid rgba(251,191,36,.3)', fontSize: '11.5px', color: '#FBBF24', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <Icon name="alert" size={14} color="warning" style={{ flexShrink: 0, marginTop: '1px' }} /> Não consegui checar o saldo: {balanceState.error}. Verifique na etapa de revisão.
          </div>
        ) : balanceState.data ? (
          (() => {
            const { ok, available, needed, estimated } = balanceState.data;
            const avail = Number(available) || 0;
            const est = Number(estimated) || totalEstimated || 0;
            const need = Number(needed) || est * 1.2;
            const marginVsNeed = avail - need;
            /* 3 estados:
               - verde: saldo cobre needed (estimado + 20% folga) com sobra
               - amarelo: cobre apenas o estimado bruto, mas não a folga de 20%
               - vermelho: não cobre nem o estimado */
            let status = 'green', title = 'Dá pra rodar com folga';
            if (avail < est) { status = 'red'; title = 'Não cabe no saldo'; }
            else if (avail < need) { status = 'yellow'; title = 'Cabe, mas sem folga de 20%'; }
            const palette = {
              green:  { bg: 'rgba(52,211,153,.16)', bd: 'rgba(52,211,153,.3)', fg: '#34D399' },
              yellow: { bg: 'rgba(251,191,36,.16)', bd: 'rgba(251,191,36,.3)', fg: '#FBBF24' },
              red:    { bg: 'rgba(248,113,113,.16)', bd: 'rgba(248,113,113,.3)', fg: '#F87171' },
            }[status];
            const statusIcon = status === 'green'
              ? <Icon name="check-circle" size={14} color="success" />
              : status === 'red'
              ? <Icon name="x-circle" size={14} color="danger" />
              : <Icon name="alert" size={14} color="warning" />;
            return (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: palette.bg, border: `1px solid ${palette.bd}` }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: palette.fg, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {statusIcon} {title}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>
                  Saldo disponível no Meta: <strong>{fmtBRL(avail)}</strong><br />
                  Gasto previsto: <strong>{fmtBRL(est)}</strong> · Com folga 20%: <strong>{fmtBRL(need)}</strong><br />
                  {status === 'green' && <span style={{ color: '#34D399' }}>Sobra {fmtBRL(marginVsNeed)} de segurança.</span>}
                  {status === 'yellow' && <span style={{ color: '#FBBF24' }}>Faltam {fmtBRL(need - avail)} pra ter a folga recomendada.</span>}
                  {status === 'red' && <span style={{ color: '#F87171' }}>Faltam {fmtBRL(est - avail)} só pra cobrir o gasto bruto.</span>}
                </div>
                {status !== 'green' && (
                  <div style={{ fontSize: '11px', color: palette.fg, marginTop: '6px' }}>
                    {status === 'yellow'
                      ? 'Sugestão: adicione saldo ou reduza 1 dia da campanha pra ficar mais seguro.'
                      : 'Reduza dias ou valor diário, ou coloque saldo no Meta antes de publicar.'}
                  </div>
                )}
              </div>
            );
          })()
        ) : null
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════
   HORÁRIO COMERCIAL — sub-componente
══════════════════════════════════════════ */

const DAYS_OF_WEEK = [
  { v: 1, l: 'Seg' },
  { v: 2, l: 'Ter' },
  { v: 3, l: 'Qua' },
  { v: 4, l: 'Qui' },
  { v: 5, l: 'Sex' },
  { v: 6, l: 'Sáb' },
  { v: 0, l: 'Dom' },
];

function BusinessHoursPicker({ value, onChange, budgetType, error }) {
  const v = value || { enabled: false, startTime: '08:00', endTime: '22:00', days: [1, 2, 3, 4, 5, 6] };
  const [showCustom, setShowCustom] = useState(false);

  const toggleEnabled = () => {
    onChange?.({ ...v, enabled: !v.enabled });
    if (v.enabled) setShowCustom(false);
  };

  const toggleDay = (d) => {
    const current = Array.isArray(v.days) ? v.days : [];
    const next = current.includes(d) ? current.filter(x => x !== d) : [...current, d];
    onChange?.({ ...v, days: next });
  };

  const setStart = (t) => onChange?.({ ...v, startTime: t });
  const setEnd   = (t) => onChange?.({ ...v, endTime: t });

  /* Texto descritivo legível (PT-BR) das janelas selecionadas */
  const daysLabel = (() => {
    const days = Array.isArray(v.days) ? [...v.days].sort((a, b) => a - b) : [];
    if (days.length === 0) return 'Nenhum dia selecionado';
    if (days.length === 7) return 'Todos os dias';
    /* seg-sex */
    if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return 'Seg-Sex';
    /* seg-sab */
    if (days.length === 6 && days.every(d => d >= 1 && d <= 6)) return 'Seg-Sáb';
    return days.map(d => DAYS_OF_WEEK.find(w => w.v === d)?.l).filter(Boolean).join(', ');
  })();

  const lifetimeRequired = budgetType !== 'total';

  return (
    <div className="ccb-card" style={{
      borderRadius: '14px',
      padding: '14px 18px',
      borderColor: error ? '#F87171' : undefined,
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!v.enabled}
          onChange={toggleEnabled}
          aria-label="Rodar só em horário comercial"
          style={{ width: '16px', height: '16px', accentColor: 'var(--c-accent)', cursor: 'pointer' }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="clock" size={14} /> Rodar só em horário comercial
          </div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)', lineHeight: 1.5 }}>
            Pausa o anúncio fora do horário em que você atende. Evita gastar com mensagens que vão ficar sem resposta.
          </div>
        </div>
      </label>

      {v.enabled && (
        <div style={{ marginTop: '12px', paddingLeft: '26px' }}>
          <div style={{ fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.5, marginBottom: '8px' }}>
            Anúncio rodará <b>{daysLabel}</b> das <b>{v.startTime}</b> às <b>{v.endTime}</b>.
            {Array.isArray(v.days) && !v.days.includes(0) && ' Domingos pausado.'}
          </div>

          {!showCustom ? (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              style={{
                fontSize: '11.5px', fontWeight: 600,
                color: 'var(--c-accent)', background: 'transparent',
                border: 'none', cursor: 'pointer', padding: 0,
                textDecoration: 'underline',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}
            >
              <Icon name="settings" size={12} /> Personalizar horário
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              {/* Dias da semana */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-3)', marginBottom: '6px' }}>
                  Dias da semana
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {DAYS_OF_WEEK.map(d => {
                    const active = (v.days || []).includes(d.v);
                    return (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() => toggleDay(d.v)}
                        aria-pressed={active}
                        aria-label={`Dia ${d.l}`}
                        style={{
                          padding: '6px 12px', borderRadius: '20px', minWidth: '46px',
                          border: `1.5px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                          background: active ? 'rgba(193,53,132,.08)' : 'var(--c-card-bg)',
                          color: active ? 'var(--c-accent)' : 'var(--c-text-3)',
                          fontSize: '11.5px', fontWeight: active ? 700 : 500,
                          fontFamily: 'inherit', cursor: 'pointer',
                          transition: 'all .12s',
                        }}
                      >
                        {d.l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horários */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-3)', display: 'block', marginBottom: '4px' }} htmlFor="bh-start">
                    Hora início
                  </label>
                  <input
                    id="bh-start"
                    type="time"
                    value={v.startTime || '08:00'}
                    onChange={e => setStart(e.target.value)}
                    aria-label="Hora de início do horário comercial"
                    style={{
                      width: '100%', padding: '8px 12px',
                      border: '1.5px solid var(--c-border)', borderRadius: '8px',
                      background: 'var(--c-card-bg)', color: 'var(--c-text-1)',
                      fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-3)', display: 'block', marginBottom: '4px' }} htmlFor="bh-end">
                    Hora fim
                  </label>
                  <input
                    id="bh-end"
                    type="time"
                    value={v.endTime || '22:00'}
                    onChange={e => setEnd(e.target.value)}
                    aria-label="Hora de término do horário comercial"
                    style={{
                      width: '100%', padding: '8px 12px',
                      border: '1.5px solid var(--c-border)', borderRadius: '8px',
                      background: 'var(--c-card-bg)', color: 'var(--c-text-1)',
                      fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCustom(false)}
                style={{
                  alignSelf: 'flex-start',
                  fontSize: '11px', color: 'var(--c-text-4)',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Ocultar
              </button>
            </div>
          )}

          {/* Aviso: precisa lifetime_budget */}
          {lifetimeRequired && (
            <div style={{
              marginTop: '10px',
              padding: '10px 12px',
              background: 'rgba(251,191,36,.16)',
              border: '1px solid rgba(251,191,36,.35)',
              borderLeft: '2px solid #F59E0B',
              borderRadius: '8px',
              fontSize: '11.5px', color: 'var(--c-text-2)', lineHeight: 1.5,
              display: 'flex', alignItems: 'flex-start', gap: '6px',
            }}>
              <Icon name="alert" size={13} color="warning" style={{ flexShrink: 0, marginTop: '1px' }} /> <b>Atenção:</b> horário comercial só funciona com <b>"Orçamento total"</b>. Mude o tipo de orçamento acima ou desative essa opção.
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '10px',
          fontSize: '12px', color: '#F87171', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '4px',
        }}><Icon name="alert" size={13} color="danger" /> {error}</div>
      )}
    </div>
  );
}

function Step4Budget({ budgetType, setBudgetType, budgetValue, setBudgetValue, startDate, setStartDate, endDate, setEndDate, errors = {}, locations = [], budgetRingSplit, setBudgetRingSplit, ringsMode = 'auto', setRingsMode, budgetOptimization = 'adset', setBudgetOptimization, businessHours, setBusinessHours }) {
  const today = toLocalISODate(new Date());

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
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--c-surface)', border: `1.5px solid ${errors.budgetValue ? '#F87171' : 'var(--c-border)'}`, borderRadius: '10px', padding: '0 16px' }}>
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
        {errors.budgetValue && <p style={{ fontSize: '12px', color: '#F87171', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><Icon name="alert" size={13} color="danger" /> {errors.budgetValue}</p>}
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

      {/* Modelo de orçamento — ABO (manual por anel) ou CBO (Meta otimiza) */}
      <div className="ccb-card" style={{
        borderRadius: '14px', padding: '14px 18px',
      }}>
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="money" size={13} /> Como distribuir o orçamento?
          </div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)', lineHeight: 1.5 }}>
            Escolha se você controla manualmente por anel, ou se deixa o Meta otimizar automaticamente entre os anéis.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          {[
            { v: 'adset',    l: 'Manual (por anel)',    d: 'Você define quanto vai em cada anel. Melhor pra testar qual distância funciona.', tag: 'Recomendado pra teste' },
            { v: 'campaign', l: 'Meta otimiza (CBO)',   d: 'Meta realoca entre anéis em tempo real pelo que está convertendo. Melhor quando você já sabe o que funciona.', tag: 'Pra campanhas otimizadas' },
          ].map(o => {
            const selected = budgetOptimization === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => setBudgetOptimization && setBudgetOptimization(o.v)}
                style={{
                  padding: '12px 14px', borderRadius: '10px',
                  border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  background: selected ? 'rgba(193,53,132,.08)' : 'var(--c-card-bg)',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  transition: 'all .15s',
                }}
              >
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: selected ? 'var(--c-accent)' : 'var(--c-text-1)', marginBottom: '3px' }}>
                  {o.l}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', lineHeight: 1.45, marginBottom: '4px' }}>
                  {o.d}
                </div>
                <div style={{
                  display: 'inline-block', fontSize: '9.5px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.5px',
                  color: selected ? 'var(--c-accent)' : 'var(--c-text-4)',
                  background: selected ? 'rgba(193,53,132,.12)' : 'var(--c-surface)',
                  padding: '2px 6px', borderRadius: '4px',
                }}>{o.tag}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Seletor — quantos anéis (ad sets) criar */}
      {(locations || []).filter(l => l?.lat != null).length >= 2 && (() => {
        const validCount = (locations || []).filter(l => l?.lat != null).length;
        /* Calcula quantos anéis o modo 'auto' vai escolher pra essa configuração
           atual de bairros. Se auto == 1, mostra badge "= Automático" no botão
           1 anel pra deixar claro que são equivalentes neste caso. */
        const autoBuckets = classifyLocationsByRing(locations, 'auto');
        const autoRings = ['primario', 'medio', 'externo'].filter(k => autoBuckets[k].length > 0).length;
        const options = [
          { v: 'auto', l: 'Automático', d: `Sistema escolhe pela distância — agora daria ${autoRings} ${autoRings === 1 ? 'anel' : 'anéis'}` },
          { v: '1',    l: '1 anel',     d: 'Tudo num ad set só', equiv: autoRings === 1 },
          { v: '2',    l: '2 anéis',    d: 'Divide em 2 grupos por distância', disabled: validCount < 2, equiv: autoRings === 2 },
          { v: '3',    l: '3 anéis',    d: 'Divide em 3 grupos por distância', disabled: validCount < 3, equiv: autoRings === 3 },
        ];
        return (
          <div className="ccb-card" style={{
            borderRadius: '14px', padding: '14px 18px',
          }}>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="target" size={13} /> Quantos anéis (ad sets) criar?
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)', lineHeight: 1.5 }}>
                Cada anel vira 1 ad set no Meta com seus bairros agrupados por distância. Lembrete: cada ad set precisa de pelo menos R$ 7/dia.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
              {options.map(o => {
                const selected = ringsMode === o.v;
                const disabled = o.disabled;
                return (
                  <button
                    key={o.v}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setRingsMode && setRingsMode(o.v)}
                    style={{
                      padding: '10px 12px', borderRadius: '10px',
                      border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
                      background: selected ? 'rgba(193,53,132,.08)' : 'var(--c-card-bg)',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.4 : 1,
                      textAlign: 'left', fontFamily: 'inherit',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: selected ? 'var(--c-accent)' : 'var(--c-text-1)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{o.l}</span>
                      {o.equiv && o.v !== 'auto' && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, letterSpacing: '.4px',
                          padding: '1px 5px', borderRadius: '4px',
                          background: 'rgba(193,53,132,.12)',
                          color: 'var(--c-accent)',
                          textTransform: 'uppercase',
                        }}>= Auto</span>
                      )}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', lineHeight: 1.4 }}>
                      {o.d}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Split por anel (quando ≥2 anéis ativos) */}
      <RingBudgetSplit
        locations={locations}
        budgetValue={budgetValue}
        budgetType={budgetType}
        split={budgetRingSplit}
        setSplit={setBudgetRingSplit}
        ringsMode={ringsMode}
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

      {/* Contador simples de duração — mostra quantos dias o anúncio vai rodar. */}
      {startDate && endDate && (() => {
        const d = computeDays(startDate, endDate);
        if (!d) return null;
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', borderRadius: '10px',
            border: '1.5px solid var(--c-border)', background: 'var(--c-surface)',
            fontSize: '13px', color: 'var(--c-text-1)',
          }}>
            <Icon name="calendar" size={16} />
            <span><strong>{d} {d === 1 ? 'dia' : 'dias'}</strong> de campanha</span>
          </div>
        );
      })()}

      {/* Horário comercial — opcional. Pausa anúncio fora do expediente
          em que a Cris atende WhatsApp/IG Direct. Requer lifetime_budget. */}
      <BusinessHoursPicker
        value={businessHours}
        onChange={setBusinessHours}
        budgetType={budgetType}
        error={errors.businessHours}
      />

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
        <div style={{ width: 32 * scale, height: 32 * scale, borderRadius: '50%', background: 'linear-gradient(135deg,#E8A4C8,var(--c-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 * scale, fontWeight: 700, flexShrink: 0 }}>CC</div>
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
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#3a1a2e,var(--c-accent))' }} />
      )}
      <div style={{ position: 'relative', zIndex: 2, padding: `${10 * scale}px ${10 * scale}px 0`, display: 'flex', alignItems: 'center', gap: 6 * scale }}>
        <div style={{ width: 26 * scale, height: 26 * scale, borderRadius: '50%', background: 'linear-gradient(135deg,#E8A4C8,var(--c-accent))', border: `2px solid #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8 * scale, fontWeight: 700 }}>CC</div>
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
        <div style={{ width: 32 * scale, height: 32 * scale, borderRadius: '50%', background: 'linear-gradient(135deg,#E8A4C8,var(--c-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 * scale, fontWeight: 700, flexShrink: 0 }}>CC</div>
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

/* Seletor de capa do vídeo. 2 modos:
   - Automático: sistema extrai frame aos ~1s do vídeo (default)
   - Manual: user faz upload de uma imagem (recomendado 1:1 ou 9:16, ~1080px) */
function VideoCoverPicker({ videoFile, thumbnail, setThumbnail }) {
  const [mode, setMode] = useState(thumbnail ? 'manual' : 'auto');
  const [autoPreview, setAutoPreview] = useState(null);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  /* Regenera preview automático quando vídeo muda */
  useEffect(() => {
    if (mode !== 'auto' || !videoFile) { setAutoPreview(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { extractVideoThumbnail } = await import('../utils/videoCompressor');
        const thumb = await extractVideoThumbnail(videoFile);
        if (cancelled) return;
        setAutoPreview({ file: thumb, url: URL.createObjectURL(thumb) });
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [videoFile, mode]);

  async function handleManualUpload(file) {
    setErr('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Arquivo precisa ser uma imagem (JPG ou PNG)');
      return;
    }
    try {
      const { compressImage } = await import('../utils/mediaProcessor');
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], 'capa.jpg', { type: 'image/jpeg' });
      setThumbnail({ file: compressedFile, url: URL.createObjectURL(compressedFile) });
    } catch (e) {
      setErr(`Falha ao processar imagem: ${e.message}`);
    }
  }

  return (
    <div>
      <SectionLabel sub="A imagem que aparece antes do vídeo começar a tocar — Meta usa como thumbnail no feed.">
        Capa do vídeo
      </SectionLabel>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {[
          { v: 'auto', l: 'Automática', icon: 'sparkles', d: 'Sistema tira um frame do vídeo' },
          { v: 'manual', l: 'Enviar imagem', icon: 'image', d: 'Você sobe uma imagem própria' },
        ].map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => { setMode(o.v); if (o.v === 'auto') setThumbnail(null); }}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: '10px',
              border: `1.5px solid ${mode === o.v ? 'var(--c-accent)' : 'var(--c-border)'}`,
              background: mode === o.v ? 'rgba(193,53,132,.08)' : 'var(--c-card-bg)',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: mode === o.v ? 'var(--c-accent)' : 'var(--c-text-1)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Icon name={o.icon} size={13} /> {o.l}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)' }}>
              {o.d}
            </div>
          </button>
        ))}
      </div>

      {/* Preview */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {mode === 'auto' && autoPreview && (
          <div>
            <img src={autoPreview.url} alt="Capa automática" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--c-border)' }} />
            <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '4px', textAlign: 'center' }}>Frame aos 1s</div>
          </div>
        )}
        {mode === 'manual' && thumbnail && (
          <div style={{ position: 'relative' }}>
            <img src={thumbnail.url} alt="Capa manual" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--c-border)' }} />
            <button
              onClick={() => setThumbnail(null)}
              style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,.65)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px' }}
            >×</button>
          </div>
        )}
        {mode === 'manual' && !thumbnail && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleManualUpload(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                width: '120px', height: '120px', borderRadius: '10px',
                border: '2px dashed var(--c-border)', background: 'var(--c-surface)',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px',
                color: 'var(--c-text-3)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <Icon name="upload" size={22} />
              Clique para enviar
            </button>
            <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '4px', textAlign: 'center', width: '120px' }}>
              1:1 ou 9:16 · 1080 px
            </div>
          </div>
        )}
        {mode === 'auto' && !autoPreview && !err && (
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)', padding: '8px 0' }}>Gerando preview do frame…</div>
        )}
      </div>

      {err && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#F87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><Icon name="x-circle" size={12} color="danger" /> {err}</div>
      )}
    </div>
  );
}

function Step5Creative({ objective, adFormat, setAdFormat, mediaFiles, setMediaFiles, videoThumbnail, setVideoThumbnail, primaryText, setPrimaryText, headline, setHeadline, destUrl, setDestUrl, ctaButton, setCtaButton, whatsappMessage, setWhatsappMessage, errors = {} }) {
  const fileRef  = useRef(null);
  const [drag, setDrag] = useState(false);
  const [uploadError, setUploadError] = useState('');
  /* Quando o erro de upload for por HEVC, mostra também botões pra sites
     gratuitos de conversão. Liga só nesse caso pra não poluir UX em outros erros. */
  const [uploadIsHevc, setUploadIsHevc] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');

  /* CTAs filtrados pelo objetivo — só mostra os que Meta aceita pra aquele
     objective, evita erro 1487891 ("Criativo inválido para o objetivo").
     EXCEÇÃO wa.me: quando link é wa.me/, o sistema usa fallback de tráfego
     (LEARN_MORE = "Saiba mais"). Outros CTAs de mensageria (WhatsApp,
     Enviar mensagem) são REJEITADOS pelo Meta nesse fluxo — restringir a
     "Saiba mais" pra evitar confusão do usuário. */
  const isWaMeLink = typeof destUrl === 'string'
    && /(wa\.me\/|api\.whatsapp\.com|whatsapp\.com\/)/i.test(destUrl);
  /* Whitelist wa.me: Meta força CTA pra LEARN_MORE quando link é wa.me e
     CTA não está em [LEARN_MORE, CONTACT_US, BOOK_TRAVEL, BOOK_NOW].
     Pra evitar UX confuso (user escolhe X, anuncio mostra Saiba mais),
     restringe lista a só os 4 que sobrevivem o whitelist. Vale para
     QUALQUER objetivo (Trafego, Mensagens, etc) com link wa.me. */
  const allowedCTAs = isWaMeLink
    ? ['Saiba mais', 'Fale conosco', 'Agendar', 'Reservar']
    : (CTA_BY_OBJECTIVE[objective] || CTA_BY_OBJECTIVE.traffic);

  /* Auto-corrige ctaButton se o user voltou pro passo 1 e trocou de objetivo
     (deixando um CTA incompatível). Também aplica quando troca destUrl
     entre wa.me e outras URLs. */
  useEffect(() => {
    if (!allowedCTAs.includes(ctaButton)) {
      setCtaButton(allowedCTAs[0] || CTA_DEFAULT_BY_OBJECTIVE[objective] || 'Saiba mais');
    }
  }, [objective, isWaMeLink]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Mede dimensões reais da mídia pra validar contra o mínimo Meta (500×500).
     Usa elementos off-screen: <video> pra vídeo, <img> pra imagem. */
  async function getMediaDimensions(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const done = (w, h) => { URL.revokeObjectURL(url); resolve({ width: w, height: h }); };
      if (file.type.startsWith('video/')) {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => done(v.videoWidth, v.videoHeight);
        v.onerror = () => done(0, 0);
        v.src = url;
      } else {
        const img = new Image();
        img.onload = () => done(img.naturalWidth, img.naturalHeight);
        img.onerror = () => done(0, 0);
        img.src = url;
      }
    });
  }

  async function handleFiles(files) {
    setUploadError('');
    setUploadIsHevc(false);
    setProcessing(true);
    setProgress('');
    const processed = [];
    const errors = [];
    let hevcDetected = false;
    for (const f of Array.from(files)) {
      const isVideo = f.type.startsWith('video/');
      const sizeMB = f.size / (1024 * 1024);
      const onProg = (p) => {
        if (typeof p === 'number') setProgress(`Comprimindo "${f.name}"… ${p}%`);
        else setProgress(`${p}`);
      };
      if (isVideo && sizeMB >= 4) setProgress(`Comprimindo "${f.name}"… preparando`);
      const result = await processMediaFile(f, onProg);
      if (result.error) {
        errors.push(`${f.name}: ${result.error}`);
        if (result.kind === 'hevc') hevcDetected = true;
        continue;
      }
      /* Sanity check final: o processador (mediaProcessor + videoCompressor)
         já tenta upscale automático pra atender mínimo Meta (500×500).
         Se mesmo assim chegou aqui abaixo do mínimo, é porque o ajuste
         falhou — avisa amigavelmente sem instruções técnicas. */
      const dim = await getMediaDimensions(result.file);
      if (dim.width > 0 && (dim.width < 500 || dim.height < 500)) {
        errors.push(`${f.name}: não consegui ajustar este arquivo automaticamente (ficou ${dim.width}×${dim.height}). Tente outro vídeo/imagem — qualquer um gravado pelo celular costuma funcionar.`);
        continue;
      }
      processed.push({
        id: Date.now() + Math.random(),
        file: result.file,
        url: URL.createObjectURL(result.file),
        type: result.type,
        name: result.name,
        originalSize: result.originalSize,
        finalSize: result.finalSize,
        wasCompressed: result.wasCompressed,
        width: dim.width,
        height: dim.height,
      });
    }
    if (errors.length > 0) {
      setUploadError(errors.join(' · '));
      setUploadIsHevc(hevcDetected);
    }
    if (processed.length > 0) setMediaFiles(prev => [...prev, ...processed]);
    setProcessing(false);
    setProgress('');
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
          {[{ v: 'image', l: 'Imagem única', icon: 'image' }, { v: 'carousel', l: 'Carrossel', icon: 'layers' }, { v: 'video', l: 'Vídeo', icon: 'video' }].map(f => (
            <RadioCard key={f.v} selected={adFormat === f.v} onClick={() => setAdFormat(f.v)} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '5px' }}><Icon name={f.icon} size={22} /></div>
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
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />

        {/* Previews com indicador de compressão */}
        {mediaFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
            {mediaFiles.map(m => (
              <div key={m.id} style={{ position: 'relative' }}>
                {m.type === 'video'
                  ? <video src={m.url} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                  : <img src={m.url} alt={m.name} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                }
                <button
                  type="button"
                  title="Remover esta mídia (clique pra trocar)"
                  aria-label="Remover mídia"
                  onClick={() => {
                    if (confirm('Remover esta mídia do anúncio?')) {
                      setMediaFiles(prev => prev.filter(x => x.id !== m.id));
                    }
                  }}
                  style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(220,38,38,.92)', color: '#fff', border: '2px solid #fff', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,.3)' }}
                >×</button>
                {m.finalSize && (
                  <div style={{
                    position: 'absolute', bottom: '2px', left: '2px', right: '2px',
                    fontSize: '9px', fontWeight: 700, color: '#fff',
                    background: 'rgba(0,0,0,.65)', padding: '2px 4px', borderRadius: '4px',
                    textAlign: 'center',
                  }} title={m.wasCompressed ? `Otimizado de ${m.originalSize} MB → ${m.finalSize} MB` : `${m.finalSize} MB`}>
                    {m.wasCompressed && '✓ '}{m.finalSize} MB
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Loading com progresso real */}
        {processing && (
          <div style={{
            padding: '10px 14px', marginBottom: '8px',
            background: 'rgba(193, 53, 132, 0.08)', border: '1px solid rgba(193, 53, 132, 0.25)',
            borderRadius: '10px', fontSize: '12px', color: 'var(--c-text-2)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Icon name="settings" size={13} style={{ flexShrink: 0 }} /> {progress || 'Otimizando mídia…'}
          </div>
        )}

        {/* Erro de upload — mostra motivo específico. Quando o motivo é HEVC,
            adiciona 3 botões pra sites gratuitos de conversão (caminho rápido
            pra acervo legado já em HEVC, sem regravar). 3 opções pra caso 1
            esteja fora do ar. */}
        {uploadError && (
          <div style={{
            padding: '10px 14px', marginBottom: '8px',
            background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.35)',
            borderRadius: '10px', fontSize: '12px', color: '#F87171', fontWeight: 600, lineHeight: 1.5,
            display: 'flex', alignItems: 'flex-start', gap: '6px',
          }}>
            <Icon name="x-circle" size={14} color="danger" style={{ flexShrink: 0, marginTop: '1px' }} /> <span>{uploadError}</span>
            {uploadIsHevc && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(248,113,113,.2)' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px', color: '#F87171' }}>
                  Converter para MP4 num site grátis (escolha um):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { label: 'CloudConvert', url: 'https://cloudconvert.com/mov-to-mp4', sub: '1 GB grátis' },
                    { label: 'Convertio', url: 'https://convertio.co/mov-mp4/', sub: '100 MB grátis' },
                    { label: 'FreeConvert', url: 'https://www.freeconvert.com/mov-to-mp4', sub: '1 GB grátis' },
                  ].map(s => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                        padding: '8px 14px', background: 'var(--c-surface)', border: '1px solid rgba(248,113,113,.3)',
                        borderRadius: '8px', textDecoration: 'none', color: '#F87171',
                        fontSize: '12px', fontWeight: 700, lineHeight: 1.3,
                      }}
                    >
                      🌐 {s.label}
                      <span style={{ fontSize: '10px', fontWeight: 500, opacity: 0.75, marginTop: '2px' }}>{s.sub}</span>
                    </a>
                  ))}
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 500, color: '#F87171' }}>
                  Suba o arquivo lá, escolha <strong>MP4</strong>, baixe o resultado e tente subir aqui de novo.
                </div>
              </div>
            )}
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
          <div style={{ marginBottom: '8px' }}><Icon name="upload" size={28} /></div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            {adFormat === 'carousel' ? 'Adicionar cartões (2–10 imagens)' : 'Clique ou arraste o arquivo aqui'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
            Qualquer imagem ou vídeo — o sistema otimiza automaticamente antes de enviar ao Meta.
          </div>
        </div>
      </div>

      {/* Capa do vídeo — visível quando houver vídeo no upload */}
      {mediaFiles.some(m => m.type === 'video') && (
        <VideoCoverPicker
          videoFile={mediaFiles.find(m => m.type === 'video')?.file}
          thumbnail={videoThumbnail}
          setThumbnail={setVideoThumbnail}
        />
      )}

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
          style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${errors.primaryText ? '#F87171' : 'var(--c-border)'}`, borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
        />
        {errors.primaryText && <p style={{ fontSize: '12px', color: '#F87171', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Icon name="alert" size={13} color="danger" /> {errors.primaryText}</p>}
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
          ><Icon name="whatsapp" size={14} /> Usar WhatsApp da Cris</button>
          <span style={{ fontSize: '11px', color: 'var(--c-text-4)', alignSelf: 'center' }}>
            ou cole um link personalizado abaixo
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--c-surface)', border: `1.5px solid ${(errors.destUrl || (destUrl && !destUrl.startsWith('http'))) ? '#F87171' : 'var(--c-border)'}`, borderRadius: '10px', padding: '0 14px', transition: 'border-color .15s' }}>
          <Icon name="link" size={13} color="info" style={{ flexShrink: 0 }} />
          <input
            type="url"
            placeholder="https://wa.me/5547997071161"
            value={destUrl}
            onChange={e => setDestUrl(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--c-text-1)', fontFamily: 'inherit', padding: '10px 0', width: '100%' }}
          />
          {destUrl && destUrl.startsWith('http') && <Icon name="check" size={14} color="success" style={{ flexShrink: 0 }} />}
        </div>
        {(errors.destUrl || (destUrl && !destUrl.startsWith('http'))) && (
          <p style={{ fontSize: '12px', color: '#F87171', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Icon name="alert" size={13} color="danger" /> {errors.destUrl || 'URL deve começar com https://'}</p>
        )}
      </div>

      {/* Mensagem WhatsApp — só aparece quando o destino é wa.me/api.whatsapp.
          Backend usa este texto pra montar o param ?text= no link final do anúncio,
          fazendo a conversa abrir já com a mensagem digitada pela lead. */}
      {isWaMeLink && (() => {
        const defaultMessage = headline.trim()
          ? `Oi Cris, vim pelo Instagram, quero saber sobre ${headline.trim().toLowerCase()}`
          : 'Oi Cris, vim pelo Instagram, quero saber mais.';
        const effectiveMessage = whatsappMessage.trim() || defaultMessage;
        const baseUrl = destUrl.split('?')[0];
        const previewUrl = `${baseUrl}?text=${encodeURIComponent(effectiveMessage)}`;
        const isCustom = whatsappMessage.trim() && whatsappMessage.trim() !== defaultMessage;
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <SectionLabel sub="Texto que já aparece digitado quando a lead abrir o WhatsApp.">Mensagem WhatsApp</SectionLabel>
              {isCustom && (
                <button
                  type="button"
                  onClick={() => setWhatsappMessage('')}
                  style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                >↺ Restaurar padrão</button>
              )}
            </div>
            <input
              type="text"
              placeholder={defaultMessage}
              value={whatsappMessage}
              onChange={e => setWhatsappMessage(e.target.value)}
              maxLength={200}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ marginTop: '8px', padding: '8px 12px', background: '#25D36612', border: '1px solid #25D36633', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#34D399', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '4px' }}>Link final que vai pro Meta</div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-2)', wordBreak: 'break-all', fontFamily: 'ui-monospace, SFMono-Regular, monospace', lineHeight: 1.5 }}>{previewUrl}</div>
            </div>
          </div>
        );
      })()}

      {/* CTA — apenas os aceitos pelo Meta pra este objetivo */}
      <div>
        <SectionLabel sub="Meta aceita apenas estas opções para o objetivo escolhido — texto livre é rejeitado.">
          Botão de chamada para ação (CTA)
        </SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
          {allowedCTAs.map(cta => (
            <Pill key={cta} selected={ctaButton === cta} onClick={() => setCtaButton(cta)}>{cta}</Pill>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '4px' }}>
          Quer outra opção? Troque o objetivo no passo 1.
        </p>
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
        /* Horário comercial — só mostra se estiver ativo */
        data.businessHours?.enabled
          ? (() => {
              const days = Array.isArray(data.businessHours.days) ? [...data.businessHours.days].sort((a, b) => a - b) : [];
              const DLBL = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
              let label;
              if (days.length === 7) label = 'Todos os dias';
              else if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) label = 'Seg-Sex';
              else if (days.length === 6 && days.every(d => d >= 1 && d <= 6)) label = 'Seg-Sáb';
              else label = days.map(d => DLBL[d]).filter(Boolean).join(', ');
              return `🕒 Horário comercial: ${label}, ${data.businessHours.startTime || '08:00'}–${data.businessHours.endTime || '22:00'}`;
            })()
          : null,
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
        <div key={s.label} className="ccb-card" style={{ borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-3)' }}>{s.label}</span>
            <button
              onClick={() => onGoTo(s.step)}
              style={{ fontSize: '12px', color: 'var(--c-accent)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: '0' }}
            ><Icon name="edit" size={12} /> Editar</button>
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
        const buckets = classifyLocationsByRing(data.locations, data.ringsMode);
        const activeKeys = ['primario', 'medio', 'externo'].filter(k => buckets[k].length > 0);
        if (activeKeys.length < 2 || !data.budgetValue) return null;
        const split = normalizeSplit(data.budgetRingSplit || {}, activeKeys);
        const total = activeKeys.reduce((s, k) => s + (Number(split[k]) || 0), 0);
        const value = Number(data.budgetValue) || 0;
        const unit = { daily: '/dia', weekly: '/sem', total: ' total' }[data.budgetType] || '';
        const RING_META = {
          primario: { label: 'Anel interno (0-5 km)',  color: '#34D399' },
          medio:    { label: 'Anel médio (5-7 km)',     color: '#F59E0B' },
          externo:  { label: 'Anel externo (7-8 km)',   color: '#D97706' },
        };
        return (
          <div className="ccb-card" style={{ borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-3)' }}>
                {activeKeys.length} conjuntos de anúncios serão criados
              </span>
              <button onClick={() => onGoTo(2)} style={{ fontSize: '12px', color: 'var(--c-accent)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="edit" size={12} /> Editar split
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
                      <div style={{ fontSize: '11px', color: 'var(--c-text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Icon name="pin" size={10} /> {hoods}
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
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#F87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Icon name="alert" size={13} color="danger" /> Split está em {total}% — ajuste para 100% no passo Orçamento.
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
          <div style={{ padding: '14px 16px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#F87171', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="alert" size={14} color="danger" /> Atenção — possíveis erros de texto:</div>
            <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {warns.map((w, i) => (
                <li key={i} style={{ fontSize: '12px', color: '#F87171', lineHeight: 1.5 }}>{w}</li>
              ))}
            </ul>
            <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '8px', marginBottom: 0 }}>Corrija no passo Criativo antes de publicar, se necessário.</p>
          </div>
        );
      })()}

      {/* Aviso de revisão */}
      <div style={{ padding: '14px 16px', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', borderRadius: '12px', fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>
        <span style={{ fontWeight: 700, color: '#FBBF24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="alert" size={13} color="warning" /> Revisão do Meta:</span> Após a publicação, o anúncio passa por análise automática. O processo geralmente ocorre em menos de 24 horas. Certifique-se de que o criativo segue as <a href="https://www.facebook.com/policies/ads/" target="_blank" rel="noreferrer" style={{ color: 'var(--c-accent)' }}>Políticas de Publicidade do Meta</a>.
      </div>

      {/* Preflight check — consulta Meta em tempo real */}
      <PreflightCheckPanel data={data} />
    </div>
  );
}

/* Consulta /api/campaigns/preflight automaticamente ao entrar na revisão.
   Mostra checklist ✅/⚠️/❌ pra que a Cris veja ANTES de publicar se saldo,
   token, page e IG estão OK. Se algo falhar, ela corrige antes de gastar. */
function PreflightCheckPanel({ data }) {
  const [state, setState] = useState({ loading: true, ok_overall: null, checks: [], error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 60000); /* 60s — Meta às vezes trava na validação */
      try {
        /* Calcula duração estimada pra validação de saldo (usa o mesmo
           helper que o painel de resumo pra não divergir). */
        const daily = computeDailyBudget(data.budgetValue, data.budgetType || 'daily', computeDays(data.startDate, data.endDate));
        const days = computeDays(data.startDate, data.endDate) || 5;
        const res = await fetch('/api/campaigns/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budget_daily: Number(daily.toFixed(2)), days }),
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        const json = await res.json();
        if (!cancelled) setState({ loading: false, ...json });
      } catch (e) {
        clearTimeout(tid);
        /* Traduz erros nativos do navegador pra mensagem amigável.
           "Failed to fetch" / "Load failed" → sem internet ou servidor offline.
           "AbortError" → timeout 60s — Meta provavelmente lento. */
        const raw = String(e?.message || e);
        const isAbort = e?.name === 'AbortError';
        const isNetworkErr = /Failed to fetch|Load failed|NetworkError|TypeError.*fetch/i.test(raw);
        /* Timeout do Meta no preflight nao bloqueia publish — silencia
           pra nao confundir o usuario com aviso inutil. So mostra erro
           se for falha real de rede com o backend (nao com Meta). */
        if (isAbort) {
          if (!cancelled) setState({ loading: false, ok_overall: true, checks: [], silenced: true });
        } else {
          const friendly = isNetworkErr
            ? 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'
            : raw;
          if (!cancelled) setState({ loading: false, ok_overall: false, checks: [], error: friendly });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [data.budgetValue, data.startDate, data.endDate]);

  const box = {
    padding: '14px 16px',
    border: '1px solid var(--c-border)',
    borderRadius: '12px',
    background: 'var(--c-card-bg)',
  };

  if (state.loading) {
    return (
      <div style={box}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-2)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="search" size={13} /> Verificando compatibilidade com Meta Ads…</div>
        <div style={{ fontSize: '12px', color: 'var(--c-text-4)' }}>Checando token, saldo, Page e Instagram.</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={{ ...box, borderColor: 'rgba(248,113,113,.35)', background: 'rgba(248,113,113,.1)' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#F87171' }}>Não consegui verificar: {state.error}</div>
      </div>
    );
  }

  const borderColor = state.ok_overall ? 'rgba(52,211,153,.35)' : 'rgba(248,113,113,.35)';
  const bgColor = state.ok_overall ? 'rgba(52,211,153,.1)' : 'rgba(248,113,113,.1)';
  const headerColor = state.ok_overall ? '#34D399' : '#F87171';
  const headerIcon = state.ok_overall
    ? <Icon name="check-circle" size={14} color="success" />
    : <Icon name="x-circle" size={14} color="danger" />;
  const headerText = state.ok_overall ? 'Tudo certo pra publicar' : 'Corrija antes de publicar';

  return (
    <div style={{ ...box, borderColor, background: bgColor }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: headerColor, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {headerIcon} {headerText}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {state.checks.map(c => {
          const checkIcon = c.ok
            ? <Icon name="check-circle" size={13} color="success" />
            : c.severity === 'warn'
            ? <Icon name="alert" size={13} color="warning" />
            : <Icon name="x-circle" size={13} color="danger" />;
          const color = c.ok ? 'var(--c-text-2)' : (c.severity === 'warn' ? '#FBBF24' : '#F87171');
          return (
            <li key={c.key} style={{ fontSize: '12px', color, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{ flexShrink: 0, marginTop: '1px' }}>{checkIcon}</span>
              <span><strong>{c.label}</strong>{c.details && <span style={{ color: 'var(--c-text-4)', fontWeight: 400 }}> — {c.details}</span>}</span>
            </li>
          );
        })}
      </ul>
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
    <div className="wizard-summary-panel ccb-card" style={{ borderRadius: '18px', padding: '18px 20px' }}>
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
                background: done
                  ? 'rgba(52,211,153,.18)'
                  : active
                    ? 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))'
                    : 'var(--c-surface)',
                border: `1.5px solid ${done ? 'rgba(52,211,153,.45)' : active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700,
                color: done ? '#34D399' : active ? '#fff' : 'var(--c-text-4)',
                boxShadow: active ? '0 0 14px rgba(193,53,132,.35)' : 'none',
                transition: 'background .2s, border-color .2s',
              }}>
                {done ? <Icon name="check" size={9} /> : i + 1}
              </div>
              {/* Nome da etapa */}
              <span style={{
                fontSize: '11px',
                fontWeight: active ? 600 : 400,
                color: done ? '#34D399' : active ? 'var(--c-text-1)' : 'var(--c-text-3)',
                transition: 'color .2s',
              }}>{s}</span>
              {/* Badge "atual" */}
              {active && (
                <span style={{
                  marginLeft: 'auto', fontSize: '10px', fontWeight: 700, letterSpacing: '.3px',
                  color: 'var(--c-accent)',
                  background: 'var(--c-accent-soft)',
                  border: '1px solid rgba(193,53,132,.4)',
                  borderRadius: '999px', padding: '2px 8px', whiteSpace: 'nowrap',
                }}>
                  atual
                </span>
              )}
              {done && (
                <span style={{ marginLeft: 'auto' }}><Icon name="check" size={9} color="success" /></span>
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
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)', display: 'flex', alignItems: 'center', gap: '5px' }}><Icon name={obj.icon} size={13} /> {obj.label}</div>
          </div>
        )}

        {locations.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '3px' }}>LOCALIZAÇÃO</div>
            {locations.slice(0, 2).map(l => (
              <div key={l.id} style={{ fontSize: '12px', color: 'var(--c-text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}><Icon name="pin" size={11} /> {l.name}</div>
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
            <div style={{ fontSize: '12px', color: 'var(--c-text-2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Icon name={{ image: 'image', carousel: 'layers', video: 'video' }[adFormat]} size={12} />
              {{ image: 'Imagem única', carousel: 'Carrossel', video: 'Vídeo' }[adFormat]}
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="ccb-card ccb-modal" style={{ padding: '40px 36px', maxWidth: '440px', width: '100%', textAlign: 'center', borderRadius: '20px' }}>
        <div style={{ marginBottom: '16px' }}><Icon name={scheduled ? 'calendar' : 'celebrate'} size={48} /></div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '10px' }}>
          {scheduled ? 'Campanha agendada!' : 'Anúncio enviado para revisão!'}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--c-text-2)', lineHeight: 1.7, marginBottom: '10px' }}>
          Seu anúncio foi enviado para <strong>revisão do Meta Ads</strong>. Se estiver nas conformidades, será {scheduled ? `publicado automaticamente em ${dateLabel}` : 'publicado em breve'}.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)', lineHeight: 1.6, marginBottom: '20px', fontWeight: 400 }}>
          Você receberá uma notificação no sino quando o Meta aprovar ou reprovar. Se for reprovado, aparecerá na sessão <strong>Reprovados</strong> com o motivo e orientação.
        </p>
        <div style={{ padding: '12px 16px', background: 'var(--c-accent-soft)', border: '1px solid rgba(193,53,132,.4)', borderRadius: '12px', fontSize: '12px', color: 'var(--c-text-3)', marginBottom: '24px', lineHeight: 1.5 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icon name="info" size={13} color="info" /></span> Status atual: <strong style={{ color: 'var(--c-accent)' }}>{scheduled ? `Agendado para ${dateLabel} · Em revisão` : 'Em revisão pelo Meta'}</strong>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '13px 32px',
            background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
            color: '#fff', border: 'none', borderRadius: '12px',
            fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
            width: '100%',
          }}
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
  const { addNotification, addAd, updateAd, getAdById, audiences, creatives, addCreative, markCreativeUsed, removeRejectedAd, logHistory, pixel, metaAccount, saveDraft, clearCurrentDraft } = useAppState();
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
  /* { pct: 0-100, label: string } | null — progresso do upload chunked Meta */
  const [uploadProgress, setUploadProgress] = useState(null);
  /* job_id retornado pelo POST /api/campaigns (202) — abre PublishingModal */
  const [publishJobId, setPublishJobId] = useState(null);

  const initialStart = (() => {
    if (source && source.startDate !== undefined) return source.startDate || '';
    if (!commercialDate?.dateISO) return '';
    const target = new Date(commercialDate.dateISO);
    const start = new Date(target);
    start.setDate(start.getDate() - (commercialDate.daysBefore || 0));
    return toLocalISODate(start);
  })();

  const initialEnd = (() => {
    if (source && source.endDate !== undefined) return source.endDate || '';
    if (!commercialDate?.dateISO) return '';
    return toLocalISODate(new Date(commercialDate.dateISO));
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
  /* service: id do serviço promovido — opcional, alimenta recomendação bairro×serviço */
  const [service,            setService]            = useState(source?.service || undefined);
  const [locations,          setLocations]          = useState(source?.locations || (quickFillAudience ? normalizedAudienceLocations : []));
  const [ageRange,           setAgeRange]           = useState(source?.ageRange || (quickFillAudience ? [quickFillAudience.ageMin, quickFillAudience.ageMax] : [18, 65]));
  const [gender,             setGender]             = useState(source?.gender || (quickFillAudience ? normalizedAudienceGender : 'all'));
  const [interests,          setInterests]          = useState(source?.interests || (quickFillAudience?.interests || []));
  const [budgetType,         setBudgetType]         = useState(source?.budgetType || 'daily');
  const [budgetValue,        setBudgetValue]        = useState(initialBudget);
  const [budgetRingSplit,    setBudgetRingSplit]    = useState(source?.budgetRingSplit || { primario: 40, medio: 40, externo: 20 });
  const [ringsMode,          setRingsMode]          = useState(
    source?.ringsMode !== undefined
      ? source.ringsMode
      : source?.ringsEnabled === false ? '1' : 'auto'
  );
  const [budgetOptimization, setBudgetOptimization] = useState(source?.budgetOptimization || 'adset');
  const [advantageAudience,  setAdvantageAudience]  = useState(!!source?.advantageAudience); /* default OFF */
  const [startDate,          setStartDate]          = useState(initialStart);
  const [endDate,            setEndDate]            = useState(initialEnd);
  /* Horário comercial (adset_schedule no Meta v20).
     Default: desligado. Quando ligado: seg-sab 8h-22h (0=dom..6=sab).
     Cris atende WhatsApp/IG Direct nesse horário — sem isso anúncio
     pode rodar 3h da manhã e mensagem ficar sem resposta. */
  const [businessHours, setBusinessHours] = useState(source?.businessHours || {
    enabled:   false,
    startTime: '08:00',
    endTime:   '22:00',
    days:      [1, 2, 3, 4, 5, 6], /* segunda a sábado */
  });
  const [adFormat,           setAdFormat]           = useState(source?.adFormat || 'image');
  const [mediaFiles,         setMediaFiles]         = useState(source?.mediaFiles || []);
  const [videoThumbnail,     setVideoThumbnail]     = useState(source?.videoThumbnail || null); /* { file, url } se manual, null = automático */
  const [primaryText,        setPrimaryText]        = useState(source?.primaryText ?? (quickFillCreative?.primaryText || commercialDate?.preFill?.primaryText || ''));
  const [headline,           setHeadline]           = useState(source?.headline ?? (quickFillCreative?.headline || commercialDate?.preFill?.headline || ''));
  const [destUrl,            setDestUrl]            = useState(source?.destUrl || 'https://wa.me/5547997071161');
  const [ctaButton,          setCtaButton]          = useState(source?.ctaButton || quickFillCreative?.cta || 'WhatsApp');
  const [whatsappMessage,    setWhatsappMessage]    = useState(source?.whatsappMessage || '');

  /* Contexto da abertura do CreateAd (fixMode, data comercial, reuso) já é
     visível no próprio Wizard — notificações no sino são apenas para alertas. */

  /* Cancelamento defensivo: se o usuário fez algum progresso (passou de
     step 0 OU subiu mídia OU escreveu copy), confirma antes de descartar e
     SEMPRE tenta salvar como rascunho — assim "OK por engano" não destrói
     trabalho, ele pode voltar depois. */
  function handleCancel() {
    const hasContent = step > 0
      || (mediaFiles && mediaFiles.length > 0)
      || (headline || '').trim()
      || (primaryText || '').trim()
      || (locations && locations.length > 0);
    if (!hasContent) {
      navigate('/anuncios');
      return;
    }
    const ok = window.confirm(
      'Cancelar agora?\n\nSuas informações serão salvas como rascunho — você pode continuar depois.'
    );
    if (!ok) return;
    try {
      saveDraft?.({
        objective, locations, ageRange, gender, interests,
        budgetType, budgetValue, startDate, endDate,
        adFormat, mediaFiles, primaryText, headline, destUrl, ctaButton, whatsappMessage,
        budgetRingSplit, ringsMode, businessHours,
      });
    } catch { /* salvar é best-effort, não bloqueia saída */ }
    navigate('/anuncios');
  }

  function validateStep(s) {
    const errs = {};
    if (s === 0 && !objective) errs.objective = 'Selecione um objetivo para continuar.';
    if (s === 1 && (!locations || locations.length === 0)) {
      errs.locations = 'Adicione ao menos uma localização (Joinville ou região).';
    }
    if (s === 2) {
      const v = Number(budgetValue);
      if (!budgetValue || v <= 0) {
        errs.budgetValue = 'Defina um valor de orçamento maior que zero.';
      } else if (budgetType === 'daily' && v < 7) {
        /* Meta BR exige ~R$6/dia/adset. Pedimos R$7 com folga de 15% pra não
           bater no limite quando dividimos entre 2-3 anéis. */
        errs.budgetValue = 'Orçamento diário mínimo R$ 7,00 (exigência Meta + folga).';
      } else if (budgetType === 'total') {
        /* Lifetime mínimo dinâmico: 5 dias × R$7 = R$35 absoluto.
           Se o user já escolheu datas, calcula (dias inclusivos) × R$7. */
        let minTotal = 35;
        const days = computeDays(startDate, endDate);
        if (days) {
          minTotal = Math.max(35, days * 7);
        }
        if (v < minTotal) {
          errs.budgetValue = `Orçamento total mínimo R$ ${minTotal},00 (${Math.max(5, Math.round(minTotal/7))} dias × R$ 7).`;
        }
      }
      /* Datas: Meta rejeita end <= start */
      if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
        errs.endDate = 'Data de fim deve ser posterior à data de início.';
      }
      /* Meta v20 rejeita lifetime_budget sem end_time. Sem isso, payload sai
         com end_time:null e Graph retorna erro 100/2446117. */
      if (budgetType === 'total' && !endDate) {
        errs.endDate = 'Quando você escolhe orçamento total, é obrigatório definir uma data de término. Defina a data fim da campanha pra continuar.';
      }
      /* Horário comercial só funciona com lifetime_budget (Meta v20).
         Se user ligou businessHours mas budget é daily, bloqueia. */
      if (businessHours?.enabled && budgetType !== 'total') {
        errs.businessHours = 'Horário comercial só funciona com "Orçamento total" (não com "Orçamento diário"). Mude o tipo de orçamento ou desative essa opção.';
      }
      /* Se ligou horário comercial mas não escolheu nenhum dia, anúncio
         nunca rodaria — bloqueia. */
      if (businessHours?.enabled && Array.isArray(businessHours.days) && businessHours.days.length === 0) {
        errs.businessHours = 'Selecione ao menos 1 dia da semana para o horário comercial.';
      }
      /* Hora fim precisa ser depois da hora início. */
      if (businessHours?.enabled && businessHours.startTime && businessHours.endTime) {
        const toMin = (s) => {
          const [h, m] = String(s).split(':').map(Number);
          return (h || 0) * 60 + (m || 0);
        };
        if (toMin(businessHours.endTime) <= toMin(businessHours.startTime)) {
          errs.businessHours = 'A hora de término precisa ser depois da hora de início.';
        }
      }
      /* Divisão por anel: cada anel precisa de R$ 7/dia mínimo.
         Bloqueia antes de chegar no Meta, evita "ad set under minimum" (code 1815113). */
      try {
        const days = computeDays(startDate, endDate);
        const dailyBudget = computeDailyBudget(budgetValue, budgetType, days);
        if (dailyBudget > 0) {
          const buckets = classifyLocationsByRing(locations, ringsMode);
          const activeKeys = ['primario', 'medio', 'externo'].filter(k => buckets[k].length > 0);
          if (activeKeys.length > 0) {
            const normalized = normalizeSplit(budgetRingSplit, activeKeys);
            const under = activeKeys.filter(k => (dailyBudget * (Number(normalized[k]) || 0) / 100) < MIN_DAILY_PER_RING);
            if (under.length > 0) {
              const minTotal = MIN_DAILY_PER_RING * activeKeys.length;
              errs.budgetValue = activeKeys.length === 1
                ? `Valor diário mínimo R$ ${MIN_DAILY_PER_RING} (exigência Meta).`
                : `Cada anel precisa de R$ ${MIN_DAILY_PER_RING}/dia. Aumente pra R$ ${minTotal}/dia ou reduza os anéis (${under.length} abaixo do mínimo).`;
            }
          }
        }
      } catch { /* se falhar o classify, não bloqueia — o preflight do Step 5 pega */ }
      /* Idade: Meta aceita 13-65. Default 18-65 está ok, mas validar user override. */
      if (Array.isArray(ageRange)) {
        if (ageRange[0] < 13) errs.ageRange = 'Idade mínima é 13 (regra Meta).';
        else if (ageRange[1] > 65) errs.ageRange = 'Idade máxima é 65 (regra Meta).';
        else if (ageRange[0] > ageRange[1]) errs.ageRange = 'Idade mínima maior que máxima.';
      }
    }
    if (s === 3) {
      if (!adFormat) errs.adFormat = 'Escolha o formato do anúncio.';
      if (!primaryText.trim()) errs.primaryText = 'O texto principal é obrigatório.';
      /* Meta recomenda ≤125 chars pra não truncar em mobile; limite rígido ~500 */
      else if (primaryText.length > 500) errs.primaryText = 'Texto principal acima do limite Meta (500 caracteres).';
      if (!headline.trim()) errs.headline = 'O título é obrigatório.';
      /* Meta recomenda ≤40 chars; hard ~255 */
      else if (headline.length > 255) errs.headline = 'Título acima do limite Meta (255 caracteres).';
      const messageCTAs = ['WhatsApp', 'Enviar mensagem', 'Mande uma mensagem', 'Chamar agora'];
      const needsUrl = !messageCTAs.includes(ctaButton);
      if (needsUrl && !destUrl.trim()) errs.destUrl = 'Com este CTA é preciso informar um destino.';
      else if (destUrl.trim() && !destUrl.startsWith('https://')) errs.destUrl = 'A URL deve começar com https:// (Meta exige HTTPS).';
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

  const todayISO = toLocalISODate(new Date());
  const isScheduled = !!startDate && startDate > todayISO;

  async function blobUrlToBase64(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ dataUrl: reader.result, mime: blob.type });
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  }

  /* Upload de mídia ANTES do publish.
     - VÍDEO: usa Resumable Upload (chunks de 3.5MB) — qualquer tamanho, sem
       compressão, qualidade 100%. Token Meta nunca sai do backend.
     - IMAGEM: usa endpoint multipart dedicado (cabe em <4.5MB do Vercel).
     Para vídeos, também extrai frame como thumbnail (Meta video_data exige
     image_hash além do video_id). */
  async function uploadAllMedia(files) {
    const out = [];
    for (const m of files || []) {
      if (!m?.file) {
        if (m?.metaHash || m?.metaVideoId) out.push(m);
        continue;
      }
      const { uploadMedia } = await import('../services/adsApi');

      if (m.type === 'video') {
        /* Thumb: usa capa manual se user enviou, senão extrai automático do vídeo */
        let thumbFile;
        if (videoThumbnail?.file) {
          thumbFile = videoThumbnail.file;
        } else {
          const { extractVideoThumbnail } = await import('../utils/videoCompressor');
          thumbFile = await extractVideoThumbnail(m.file);
        }
        const { uploadVideoChunked } = await import('../utils/metaResumableUploader');
        setUploadProgress?.({ pct: 0, label: 'Preparando vídeo…' });
        const [videoResult, thumbResult] = await Promise.all([
          uploadVideoChunked(m.file, {
            onProgress: (pct, label) => setUploadProgress?.({ pct, label }),
          }),
          uploadMedia(thumbFile),
        ]);
        setUploadProgress?.(null);
        out.push({
          id: m.id,
          type: 'video',
          name: m.name,
          metaVideoId: videoResult.video_id || null,
          metaHash: thumbResult.hash || null,
        });
      } else {
        /* Imagem: se > 3.5MB usa chunked direto pro Meta (sem compressão);
           senão pipeline antigo (que já comprime pra Meta-recomendado).
           Limite 3.5MB porque acima disso não cabe num único request Vercel. */
        const sizeMB = (m.file.size || 0) / (1024 * 1024);
        let imageHash = null;
        if (sizeMB > 3.5) {
          const { uploadImageChunked } = await import('../utils/metaResumableUploader');
          setUploadProgress?.({ pct: 0, label: 'Preparando imagem…' });
          const r = await uploadImageChunked(m.file, {
            onProgress: (pct, label) => setUploadProgress?.({ pct, label }),
          });
          setUploadProgress?.(null);
          imageHash = r.hash || null;
          out.push({
            id: m.id,
            type: 'image',
            name: m.name,
            metaHash: imageHash,
            metaVideoId: null,
          });
        } else {
          const result = await uploadMedia(m.file);
          out.push({
            id: m.id,
            type: result.type,
            name: m.name,
            metaHash: result.hash || null,
            metaVideoId: null,
          });
        }
      }
    }
    return out;
  }

  async function handlePublish(asDraft = false) {
    /* Rascunho: pula validacao estrita, upload e Meta. Salva o que tiver
       preenchido pra Rafa publicar depois (ao reabrir o anuncio em /anuncios,
       wizard re-popula tudo via editingAd e o botao "Publicar" funciona normal). */
    if (!asDraft) {
      // Revalidação final — evita estado inválido após navegar entre steps.
      const finalErrs = validateAll();
      if (Object.keys(finalErrs).length > 0) {
        setErrors(finalErrs);
        const firstStepWithError = [0, 1, 2, 3].find(i => Object.keys(validateStep(i)).length > 0);
        if (firstStepWithError !== undefined) setStep(firstStepWithError);
        return;
      }
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

    /* Upload de mídia em etapa separada — via multipart dedicado pra evitar
       o limite de 4.5MB do body JSON do Vercel. Cada arquivo vai individual,
       independente do tamanho total (até 15MB por vídeo, imagens comprimidas).
       Rascunho NÃO faz upload (zero chamada Meta) — só salva o que tiver. */
    let mediaFilesData = [];
    if (!asDraft) {
      try {
        mediaFilesData = await uploadAllMedia(mediaFiles);
      } catch (uploadErr) {
        setPublishing(false);
        setUploadProgress?.(null);
        addNotification({
          kind: 'publish-failed',
          title: 'Falha no upload da mídia',
          message: `"${adName}" não foi publicado. ${uploadErr?.message || 'Erro no upload'}. Tente uma imagem/vídeo menor.`,
        });
        return;
      }

      /* Validação: precisa ter AO MENOS 1 hash real do Meta (imagem ou vídeo).
         Sem isso, Meta rejeita creative. Cenário comum: reaproveitou ad reprovado
         sem re-subir a mídia (File não persiste em localStorage). */
      const hasRealMedia = mediaFilesData.some(m => {
        const h = m.metaHash;
        const v = m.metaVideoId;
        const realHash = typeof h === 'string' && /^[a-f0-9]{20,}$/i.test(h) && !h.startsWith('17');
        const realVideoId = typeof v === 'string' && /^\d{10,20}$/.test(v);
        return realHash || realVideoId;
      });
      if (!hasRealMedia) {
        setPublishing(false);
        addNotification({
          kind: 'publish-failed',
          title: 'Mídia precisa ser enviada novamente',
          message: `Detectei que você está reaproveitando um anúncio. Por segurança, volte ao Passo 5 (Criativo), remova a imagem/vídeo atual e adicione de novo antes de publicar.`,
        });
        return;
      }
    }

    // Referências (em vez de duplicar) quando o user reusa audience/creative
    const audienceId = reuseAudience?.id || null;
    const creativeId = reuseCreative?.id || null;
    const referenceId = referenceRef?.id || null;

    const adPayload = {
      name: adName,
      platform: 'instagram',
      status: asDraft ? 'draft' : 'publishing', /* publishing = job async em curso */
      publishMode: asDraft ? 'draft' : 'immediate',

      // Orçamento (local)
      budget: Number(budgetValue) || 0,
      budgetValue: Number(budgetValue) || 0,
      budgetType, startDate, endDate,
      budgetRingSplit,
      ringsMode,
      budgetOptimization,
      businessHours,
      advantageAudience,

      // Público (local)
      objective, service: service || null, locations, ageRange, gender, interests,

      // Criativo (local)
      adFormat, primaryText, headline, destUrl, ctaButton,
      whatsappMessage,
      mediaFiles: serializedMedia,
      mediaFilesData,

      // Referências a outras entidades salvas
      audienceId, creativeId, referenceId,
      commercialDateId: commercialDate?.id || null,

      // Integração Meta
      pixelId:       pixel?.enabled ? pixel.pixelId : null,
      /* metaPageId é o ID da Facebook Page (necessário pro creative
         object_story_spec.page_id). Antes era enviado como `metaAccountId`
         — nome confuso porque metaAccount.pageId NÃO é o ad account ID
         (que é creds.account_id, vindo do banco). O alias é mantido
         abaixo até o backend ser atualizado pra ler metaPageId. */
      metaPageId:    metaAccount?.pageId || null,
      metaAccountId: metaAccount?.pageId || null, /* alias legado — deprecado */
      ...metaIds,
    };

    // Anexa o payload no schema Meta v20 (pronto pra sync real)
    adPayload.meta = toMetaPayload(adPayload);

    /* ── Rascunho: salva local, sem chamada ao backend async ── */
    if (asDraft) {
      let publishedAd = null;
      if (editingAd) {
        updateAd(editingAd.id, { ...adPayload, status: 'draft' });
        publishedAd = { ...editingAd, ...adPayload, status: 'draft' };
      } else {
        publishedAd = addAd({ ...adPayload, status: 'draft' });
      }
      if (!reuseCreative && primaryText && headline) {
        addCreative({ name: headline, primaryText, headline, destUrl, ctaButton, adFormat });
      } else if (reuseCreative?.id) {
        markCreativeUsed?.(reuseCreative.id);
      }
      logHistory({
        type: 'ad-published',
        title: `Rascunho salvo: ${adName}`,
        description: 'Salvo como rascunho — publique quando estiver pronto.',
        restorable: false,
        payload: publishedAd,
      });
      setPublishing(false);
      navigate('/anuncios');
      return;
    }

    /* ── Publicação real: POST /api/campaigns → 202 { job_id } ── */
    try {
      const resp = await api.post('/api/campaigns', adPayload);
      const { job_id, campaign_id_local, deduped } = resp.data;

      /* Salva o anúncio localmente com status 'publishing' e o job_id
         para que Campaigns.jsx possa mostrar o badge "Em publicação". */
      const localPayload = { ...adPayload, status: 'publishing', publish_job_id: job_id };
      let publishedAd = null;
      if (editingAd) {
        updateAd(editingAd.id, localPayload);
        publishedAd = { ...editingAd, ...localPayload };
      } else if (deduped && campaign_id_local) {
        /* Backend dedupou — campanha ja existe local com esse id, atualiza
           em vez de duplicar. */
        updateAd(campaign_id_local, localPayload);
        publishedAd = { id: campaign_id_local, ...localPayload };
      } else {
        /* Se o backend retornou campaign_id_local, usa ele como id local */
        publishedAd = addAd(campaign_id_local ? { ...localPayload, id: campaign_id_local } : localPayload);
      }
      if (!reuseCreative && primaryText && headline) {
        addCreative({ name: headline, primaryText, headline, destUrl, ctaButton, adFormat });
      } else if (reuseCreative?.id) {
        markCreativeUsed?.(reuseCreative.id);
      }
      logHistory({
        type: fixMode ? 'ad-corrected' : (editingAd ? 'ad-updated' : 'ad-published'),
        title: fixMode
          ? `Correção enviada: ${adName}`
          : editingAd
            ? `Anúncio atualizado: ${adName}`
            : `Campanha em publicação: ${adName}`,
        description: isScheduled
          ? `Agendado para ${new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')}.`
          : 'Job de publicação iniciado — acompanhe o progresso no modal.',
        restorable: false,
        payload: publishedAd,
      });
      if (fixMode) {
        removeRejectedAd(rejectedAd.id);
      }

      /* Abre o PublishingModal — polling começa dentro do componente */
      setPublishJobId(job_id);
      setPublishing(false);
    } catch (postErr) {
      setPublishing(false);
      /* Erros de timeout (504/408) não são problema de tamanho de arquivo —
         o backend processará o job em background. Mensagem genérica clara. */
      const httpStatus = postErr?.response?.status;
      const isTimeout = httpStatus === 504 || httpStatus === 408 || postErr?.code === 'ECONNABORTED';
      addNotification({
        kind: 'publish-failed',
        title: 'Falha ao iniciar publicação',
        message: isTimeout
          ? 'Tempo de resposta esgotado. Verifique sua conexão e tente novamente.'
          : `Não foi possível enviar a campanha. ${postErr?.response?.data?.error || postErr?.message || 'Erro desconhecido.'}`,
      });
    }
  }

  const reviewData = { objective, locations, ageRange, gender, interests, budgetType, budgetValue, startDate, endDate, adFormat, mediaFiles, primaryText, headline, destUrl, ctaButton, budgetRingSplit, ringsMode, budgetOptimization, businessHours };

  const stepComponents = [
    <Step1Objective objective={objective} setObjective={setObjective} service={service} setService={setService} errors={errors} />,
    <Step2Audience  locations={locations} setLocations={setLocations} ageRange={ageRange} setAgeRange={setAgeRange} gender={gender} setGender={setGender} interests={interests} setInterests={setInterests} ringsMode={ringsMode} setRingsMode={setRingsMode} advantageAudience={advantageAudience} setAdvantageAudience={setAdvantageAudience} service={service} />,
    <Step4Budget budgetType={budgetType} setBudgetType={setBudgetType} budgetValue={budgetValue} setBudgetValue={setBudgetValue} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} errors={errors} locations={locations} budgetRingSplit={budgetRingSplit} setBudgetRingSplit={setBudgetRingSplit} ringsMode={ringsMode} setRingsMode={setRingsMode} budgetOptimization={budgetOptimization} setBudgetOptimization={setBudgetOptimization} businessHours={businessHours} setBusinessHours={setBusinessHours} />,
    <Step5Creative objective={objective} adFormat={adFormat} setAdFormat={setAdFormat} mediaFiles={mediaFiles} setMediaFiles={setMediaFiles} videoThumbnail={videoThumbnail} setVideoThumbnail={setVideoThumbnail} primaryText={primaryText} setPrimaryText={setPrimaryText} headline={headline} setHeadline={setHeadline} destUrl={destUrl} setDestUrl={setDestUrl} ctaButton={ctaButton} setCtaButton={setCtaButton} whatsappMessage={whatsappMessage} setWhatsappMessage={setWhatsappMessage} errors={errors} />,
    <Step6Review data={reviewData} onGoTo={(s) => { setErrors({}); setStep(s); }} />,
  ];

  return (
    <div className="page-container">
      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            {fixMode ? 'Corrigir anúncio reprovado' : 'Nova campanha'}
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
          onClick={handleCancel}
          style={{ padding: '8px 14px', border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-2)', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          Cancelar
        </button>
      </div>

      {/* ── Step Indicator ── */}
      <StepIndicator steps={STEPS} current={step} />

      {/* ── Layout wizard ── */}
      <div className="wizard-layout">
        {/* Conteúdo do passo */}
        <div className="ccb-card" style={{ padding: '28px', borderRadius: '18px' }}>
          {fixMode && rejectionInfo && (
            <div style={{
              padding: '14px 16px',
              background: 'rgba(248,113,113,.12)',
              border: '1px solid rgba(248,113,113,.3)',
              borderLeft: '2px solid #EF4444',
              borderRadius: '10px',
              marginBottom: '22px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#F87171', letterSpacing: '.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="alert" size={12} color="danger" /> MOTIVO DA REPROVAÇÃO
              </div>
              <p style={{ fontSize: '13px', color: 'var(--c-text-2)', margin: '0 0 10px 0', lineHeight: 1.6 }}>
                <strong>{rejectedAd.reason}</strong>{rejectedAd.details ? ` — ${rejectedAd.details}` : ''}
              </p>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#34D399', letterSpacing: '.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Icon name="info" size={12} color="success" /> COMO CORRIGIR
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
              background: 'linear-gradient(135deg, rgba(193,53,132,.12), rgba(125,74,94,.04))',
              border: '1px solid var(--c-border)',
              borderLeft: '2px solid var(--c-accent)',
              borderRadius: '10px',
              marginBottom: '22px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-accent)', letterSpacing: '.5px', marginBottom: '8px' }}>
                {commercialDate
                  ? `${commercialDate.emoji} PRÉ-PREENCHIDO · ${commercialDate.name.toUpperCase()}`
                  : reuseCreative
                    ? `PRÉ-PREENCHIDO · CRIATIVO "${reuseCreative.name.toUpperCase()}"`
                    : reuseAudience
                      ? `PRÉ-PREENCHIDO · PÚBLICO "${reuseAudience.name.toUpperCase()}"`
                      : 'PRÉ-PREENCHIDO'}
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
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Icon name="edit" size={11} /> Personalizar do início
              </button>
            </div>
          )}
          {stepComponents[step]}

          {/* Navegação */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--c-border)' }}>
            <button
              onClick={() => { setErrors({}); step > 0 ? setStep(s => s - 1) : handleCancel(); }}
              style={{ padding: '8px 16px', border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-2)', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
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
                style={{
                  padding: '11px 24px',
                  background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
                }}
              >
                {canReview ? '✓ Atualizar e voltar à revisão' : 'Próximo →'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Salvar rascunho — bypassa Meta, salva local pra publicar depois */}
                {!fixMode && (
                  <button
                    onClick={() => handlePublish(true)}
                    disabled={publishing}
                    aria-disabled={publishing}
                    title="Salva o que voce preencheu sem publicar no Meta. Voce pode abrir o anuncio depois e clicar em Publicar."
                    style={{
                      padding: '11px 22px',
                      background: 'transparent',
                      color: 'var(--c-text-2)',
                      border: '1.5px solid var(--c-border)',
                      borderRadius: '12px',
                      fontSize: '13px', fontWeight: 600,
                      cursor: publishing ? 'not-allowed' : 'pointer',
                      opacity: publishing ? 0.5 : 1,
                      transition: 'border-color .15s, color .15s',
                    }}
                    onMouseEnter={e => { if (!publishing) { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.color = 'var(--c-accent)'; }}}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-2)'; }}
                  >
                    Salvar como rascunho
                  </button>
                )}
                <button
                  onClick={() => handlePublish(false)}
                  /* Bloqueia double-click — sem isso, 2 cliques rápidos criam
                     2 campanhas Meta + 2 INSERTs locais. handlePublish é async
                     e leva alguns segundos (upload de mídia → create campaign). */
                  disabled={publishing}
                  aria-disabled={publishing}
                  aria-busy={publishing}
                  style={{
                    padding: '11px 28px',
                    background: fixMode
                      ? 'linear-gradient(135deg, #34D399, #10B981)'
                      : 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
                    color: '#fff', border: 'none', borderRadius: '12px',
                    fontSize: '14px', fontWeight: 700,
                    cursor: publishing ? 'not-allowed' : 'pointer',
                    opacity: publishing ? 0.6 : 1,
                    pointerEvents: publishing ? 'none' : 'auto',
                    boxShadow: fixMode
                      ? '0 8px 24px rgba(52,211,153,.4), inset 0 1px 0 rgba(255,255,255,.18)'
                      : '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
                    transition: 'opacity .15s',
                  }}
                >
                  {publishing
                    ? (uploadProgress
                        ? `${uploadProgress.label || 'Enviando…'} (${uploadProgress.pct || 0}%)`
                        : 'Enviando...')
                    : fixMode
                      ? 'Corrigir e publicar'
                      : (isScheduled ? 'Agendar campanha' : 'Publicar campanha')}
                </button>
              </div>
            )}
          </div>
          {publishing && uploadProgress && (
            <div style={{ marginTop: '10px', width: '100%' }}>
              <div style={{ height: '6px', background: 'rgba(0,0,0,.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${uploadProgress.pct || 0}%`,
                  background: 'linear-gradient(90deg, var(--c-accent), var(--c-accent-dk))',
                  transition: 'width .3s ease',
                }} />
              </div>
              <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--c-text-soft)', textAlign: 'right' }}>
                {uploadProgress.label}
              </div>
            </div>
          )}
        </div>

        {/* Painel lateral de resumo removido — resumo final no Step 6 (Revisão)
           já cobre tudo. Mantendo a função SummaryPanel no arquivo caso seja
           reativado no futuro. */}
      </div>

      {publishJobId && (
        <PublishingModal
          jobId={publishJobId}
          onComplete={() => navigate('/anuncios')}
          onFailure={() => {/* playBell já tocou dentro do modal */}}
          onClose={(retry) => {
            setPublishJobId(null);
            if (retry) {
              /* Volta ao Step 5 para o usuário tentar de novo */
              setStep(4);
            } else {
              navigate('/anuncios');
            }
          }}
        />
      )}
    </div>
  );
}
