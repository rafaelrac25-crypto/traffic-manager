/**
 * IMPORTANTE:
 * Wizard de criação de anúncios Meta Ads.
 * Integração real com Meta Ads API será implementada na fase seguinte.
 * Os dados coletados são enviados via POST /api/campaigns.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

const STEPS = ['Objetivo', 'Público', 'Posicionamentos', 'Orçamento', 'Criativo', 'Revisar'];

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
    color: '#C13584',
    items: [
      { id: 'sales',         label: 'Vendas',              icon: '🛍️', desc: 'Encontre pessoas com maior probabilidade de comprar.' },
      { id: 'store_traffic', label: 'Tráfego para loja',   icon: '🏪', desc: 'Atraia visitantes para seu estabelecimento físico.' },
    ],
  },
];

const META_PLACEMENTS = [
  { platform: 'Facebook',         icon: '🔵', items: ['Feed', 'Stories', 'Reels', 'Coluna direita', 'Vídeos in-stream', 'Marketplace', 'Artigos instantâneos'] },
  { platform: 'Instagram',        icon: '📸', items: ['Feed', 'Stories', 'Reels', 'Explorar', 'Explorar Home', 'Loja'] },
  { platform: 'Messenger',        icon: '💬', items: ['Caixa de entrada', 'Stories'] },
  { platform: 'Audience Network', icon: '🌐', items: ['Nativo, banner e intersticial', 'Vídeos in-stream rewarded'] },
];

const BID_STRATEGIES = [
  { id: 'lowest_cost', label: 'Menor custo',     desc: 'O Meta maximiza resultados usando todo o orçamento disponível.' },
  { id: 'cost_cap',    label: 'Limite de custo',  desc: 'Controla o custo médio por resultado. Recomendado para escala.' },
  { id: 'bid_cap',     label: 'Limite de lance',  desc: 'Define o valor máximo por lance em cada leilão de anúncios.' },
];

const CTA_OPTIONS = [
  'Saiba mais', 'Comprar agora', 'Inscrever-se', 'Entrar em contato',
  'Reservar agora', 'Baixar', 'Obter oferta', 'Enviar mensagem',
  'Ligar agora', 'Ver menu', 'Pedir agora', 'Assistir a mais',
];

const INTEREST_SUGGESTIONS = [
  'Beleza e cosméticos', 'Cuidados com a pele', 'Moda feminina', 'Bem-estar',
  'Saúde e fitness', 'Manicure e unhas', 'Cabelo e penteados', 'Maquiagem',
  'Estética e spa', 'Autoestima', 'Salão de beleza', 'Produtos naturais',
];

const RADIUS_KM = [1, 5, 10, 25, 50, 80, 150];
const JOINVILLE_CENTER = [-26.304, -48.846];

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

function RadioCard({ selected, onClick, children, style = {} }) {
  return (
    <div
      onClick={onClick}
      style={{
        border: `2px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
        background: selected ? 'rgba(193,53,132,.07)' : 'var(--c-card-bg)',
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
        background: selected ? 'rgba(193,53,132,.08)' : 'var(--c-surface)',
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
                background: done || active ? 'var(--c-accent)' : 'var(--c-surface)',
                border: `2px solid ${done || active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                color: done || active ? '#fff' : 'var(--c-text-4)',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: '12px', whiteSpace: 'nowrap',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--c-text-1)' : done ? 'var(--c-accent)' : 'var(--c-text-4)',
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: '1px', minWidth: '10px', maxWidth: '36px', margin: '0 6px',
                background: i < current ? 'var(--c-accent)' : 'var(--c-border)',
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

function MapClickHandler({ onAdd, radius }) {
  useMapEvents({
    click: async ({ latlng: { lat, lng } }) => {
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

function MapFlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 11, { duration: 1 });
  }, [center?.[0], center?.[1]]);
  return null;
}

/* ══════════════════════════════════════════
   PASSO 1 — OBJETIVO
══════════════════════════════════════════ */

function Step1Objective({ objective, setObjective }) {
  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
        Qual é o objetivo da campanha?
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--c-text-3)', marginBottom: '24px' }}>
        O Meta vai otimizar a entrega do anúncio com base no que você escolher.
      </p>

      {META_OBJECTIVES.map(({ category, color, items }) => (
        <div key={category} style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--c-text-3)' }}>
              {category}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px' }}>
            {items.map(obj => (
              <RadioCard key={obj.id} selected={objective === obj.id} onClick={() => setObjective(obj.id)}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{obj.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: objective === obj.id ? 'var(--c-accent)' : 'var(--c-text-1)', marginBottom: '4px' }}>
                  {obj.label}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--c-text-4)', lineHeight: 1.4 }}>{obj.desc}</div>
              </RadioCard>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   PASSO 2 — PÚBLICO
══════════════════════════════════════════ */

function Step2Audience({ locations, setLocations, ageRange, setAgeRange, gender, setGender, languages, setLanguages, interests, setInterests }) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [searching, setSearching] = useState(false);
  const [radius, setRadius]       = useState(10);
  const [newLang, setNewLang]     = useState('');
  const [newInt, setNewInt]       = useState('');
  const debounceRef               = useRef(null);

  const mapCenter = locations.length > 0
    ? [locations[locations.length - 1].lat, locations[locations.length - 1].lng]
    : null;

  async function search(q) {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
        { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'TrafficManager/1.0' } }
      );
      setResults(await r.json());
    } catch { setResults([]); }
    setSearching(false);
  }

  function onQueryChange(e) {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 400);
  }

  function addFromResult(r) {
    setLocations(prev => [...prev, {
      id: Date.now(),
      name: r.display_name.split(',').slice(0, 2).join(',').trim(),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      radius,
    }]);
    setQuery(''); setResults([]);
  }

  function removeLocation(id) { setLocations(prev => prev.filter(l => l.id !== id)); }

  function updateRadius(id, r) {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, radius: r } : l));
  }

  function addLang(v) {
    const t = v.trim();
    if (t && !languages.includes(t)) setLanguages(prev => [...prev, t]);
    setNewLang('');
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
        <SectionLabel sub="Busque cidades, bairros ou clique diretamente no mapa para adicionar regiões.">
          Localização
        </SectionLabel>

        {/* Barra de busca + raio */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', padding: '8px 12px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--c-text-4)', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Ex: Blumenau, Santa Catarina..."
                value={query}
                onChange={onQueryChange}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--c-text-1)', fontFamily: 'inherit', width: '100%' }}
              />
              {searching && <span style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>...</span>}
            </div>
            {/* Dropdown de resultados */}
            {results.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '10px', zIndex: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                {results.map(r => (
                  <div
                    key={r.place_id}
                    onMouseDown={() => addFromResult(r)}
                    style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '12px', color: 'var(--c-text-1)', borderBottom: '1px solid var(--c-border-lt)', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    📍 {r.display_name.split(',').slice(0, 3).join(',')}
                  </div>
                ))}
              </div>
            )}
          </div>

          <select
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            {RADIUS_KM.map(r => <option key={r} value={r}>{r} km de raio</option>)}
          </select>
        </div>

        {/* Tags de localizações selecionadas */}
        {locations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {locations.map(loc => (
              <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'rgba(193,53,132,.08)', border: '1px solid rgba(193,53,132,.25)', borderRadius: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--c-accent)', fontWeight: 600, flex: 1, minWidth: '100px' }}>📍 {loc.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>Raio:</span>
                  <select
                    value={loc.radius}
                    onChange={e => updateRadius(loc.id, Number(e.target.value))}
                    style={{ padding: '2px 6px', border: '1px solid var(--c-border)', borderRadius: '6px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '11px', fontFamily: 'inherit' }}
                  >
                    {RADIUS_KM.map(r => <option key={r} value={r}>{r} km</option>)}
                  </select>
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
          <MapContainer center={JOINVILLE_CENTER} zoom={10} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onAdd={loc => setLocations(prev => [...prev, loc])} radius={radius} />
            <MapFlyTo center={mapCenter} />
            {locations.map(loc => (
              <Circle
                key={loc.id}
                center={[loc.lat, loc.lng]}
                radius={loc.radius * 1000}
                pathOptions={{ color: '#C13584', fillColor: '#C13584', fillOpacity: 0.18, weight: 2 }}
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

      {/* ── Idiomas ── */}
      <div>
        <SectionLabel sub="Deixe vazio para atingir todos os idiomas.">Idiomas</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {languages.map(l => (
            <div key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(193,53,132,.08)', border: '1px solid rgba(193,53,132,.25)', borderRadius: '20px', fontSize: '12px', color: 'var(--c-accent)', fontWeight: 600 }}>
              {l}
              <span onClick={() => setLanguages(prev => prev.filter(x => x !== l))} style={{ cursor: 'pointer', fontWeight: 700, marginLeft: '1px' }}>×</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Adicionar idioma..."
            value={newLang}
            onChange={e => setNewLang(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addLang(newLang)}
            style={{ flex: 1, padding: '8px 12px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
          />
          <button onClick={() => addLang(newLang)} style={{ padding: '8px 14px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', fontSize: '12px', color: 'var(--c-text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Adicionar
          </button>
        </div>
      </div>

      {/* ── Interesses ── */}
      <div>
        <SectionLabel sub="Segmente por interesses, comportamentos e dados demográficos.">
          Interesses e comportamentos
        </SectionLabel>
        {/* Sugestões */}
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
        {/* Selecionados */}
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
    </div>
  );
}

/* ══════════════════════════════════════════
   PASSO 3 — POSICIONAMENTOS
══════════════════════════════════════════ */

function Step3Placements({ placementMode, setPlacementMode, selectedPlacements, setSelectedPlacements }) {
  function toggle(platform, item) {
    const key = `${platform}|${item}`;
    setSelectedPlacements(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAll(platform, items) {
    const allSelected = items.every(i => selectedPlacements[`${platform}|${i}`]);
    const update = {};
    items.forEach(i => { update[`${platform}|${i}`] = !allSelected; });
    setSelectedPlacements(prev => ({ ...prev, ...update }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>Onde o anúncio vai aparecer?</h2>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>Escolha onde seu anúncio será exibido nas plataformas Meta.</p>
      </div>

      {/* Toggle automático / manual */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {[
          { v: 'auto',   l: 'Automático (Advantage+)', d: 'O Meta escolhe os melhores posicionamentos para seu objetivo e audiência.' },
          { v: 'manual', l: 'Manual',                  d: 'Você decide exatamente onde o anúncio aparece.' },
        ].map(opt => (
          <RadioCard key={opt.v} selected={placementMode === opt.v} onClick={() => setPlacementMode(opt.v)} style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${placementMode === opt.v ? 'var(--c-accent)' : 'var(--c-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {placementMode === opt.v && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-accent)' }} />}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: placementMode === opt.v ? 'var(--c-accent)' : 'var(--c-text-1)' }}>{opt.l}</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--c-text-4)', margin: 0, paddingLeft: '24px' }}>{opt.d}</p>
          </RadioCard>
        ))}
      </div>

      {placementMode === 'auto' && (
        <div style={{ padding: '14px 16px', background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)', borderRadius: '12px', fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>
          <b>Recomendado para a maioria das campanhas.</b> O Advantage+ testa múltiplos posicionamentos automaticamente e direciona o orçamento para os que performam melhor — Facebook, Instagram, Messenger e Audience Network.
        </div>
      )}

      {placementMode === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {META_PLACEMENTS.map(({ platform, icon, items }) => {
            const allSel = items.every(i => selectedPlacements[`${platform}|${i}`]);
            const someSel = items.some(i => selectedPlacements[`${platform}|${i}`]);
            return (
              <div key={platform} style={{ background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '12px', overflow: 'hidden' }}>
                {/* Header da plataforma */}
                <label style={{ padding: '11px 16px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allSel}
                    ref={el => { if (el) el.indeterminate = !allSel && someSel; }}
                    onChange={() => toggleAll(platform, items)}
                    style={{ accentColor: '#C13584', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '16px' }}>{icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)' }}>{platform}</span>
                  <span style={{ fontSize: '11px', color: 'var(--c-text-4)', marginLeft: 'auto' }}>
                    {items.filter(i => selectedPlacements[`${platform}|${i}`]).length}/{items.length} selecionados
                  </span>
                </label>
                {/* Itens */}
                <div style={{ padding: '6px' }}>
                  {items.map(item => (
                    <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={!!selectedPlacements[`${platform}|${item}`]}
                        onChange={() => toggle(platform, item)}
                        style={{ accentColor: '#C13584', width: '14px', height: '14px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--c-text-2)' }}>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   PASSO 4 — ORÇAMENTO
══════════════════════════════════════════ */

function Step4Budget({ campaignName, setCampaignName, budgetType, setBudgetType, budgetValue, setBudgetValue, startDate, setStartDate, endDate, setEndDate, bidStrategy, setBidStrategy }) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>Orçamento e programação</h2>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>Defina quanto investir e por quanto tempo o anúncio ficará ativo.</p>
      </div>

      {/* Nome da campanha */}
      <div>
        <SectionLabel>Nome da campanha</SectionLabel>
        <input
          type="text"
          placeholder="Ex: Promo Verão — Estética — Jul 2026"
          value={campaignName}
          onChange={e => setCampaignName(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Tipo de orçamento */}
      <div>
        <SectionLabel>Tipo de orçamento</SectionLabel>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[{ v: 'daily', l: 'Diário', d: 'Gaste até X reais por dia' }, { v: 'total', l: 'Total da campanha', d: 'Gaste X reais no período total' }].map(t => (
            <RadioCard key={t.v} selected={budgetType === t.v} onClick={() => setBudgetType(t.v)} style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: budgetType === t.v ? 'var(--c-accent)' : 'var(--c-text-1)', marginBottom: '2px' }}>{t.l}</div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>{t.d}</div>
            </RadioCard>
          ))}
        </div>
      </div>

      {/* Valor */}
      <div>
        <SectionLabel>{budgetType === 'daily' ? 'Orçamento diário' : 'Orçamento total'}</SectionLabel>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', padding: '0 16px' }}>
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
        {budgetValue && budgetType === 'daily' && (
          <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '6px' }}>
            Estimativa mensal: <b>R$ {(Number(budgetValue) * 30).toFixed(2).replace('.', ',')}</b>
          </p>
        )}
      </div>

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

      {/* Estratégia de lance */}
      <div>
        <SectionLabel sub="Define como o Meta vai competir nos leilões de anúncios.">Estratégia de lance</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {BID_STRATEGIES.map(s => (
            <RadioCard key={s.id} selected={bidStrategy === s.id} onClick={() => setBidStrategy(s.id)}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${bidStrategy === s.id ? 'var(--c-accent)' : 'var(--c-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  {bidStrategy === s.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-accent)' }} />}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: bidStrategy === s.id ? 'var(--c-accent)' : 'var(--c-text-1)', marginBottom: '2px' }}>{s.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>{s.desc}</div>
                </div>
              </div>
            </RadioCard>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   PASSO 5 — CRIATIVO
══════════════════════════════════════════ */

function Step5Creative({ adName, setAdName, adFormat, setAdFormat, mediaFiles, setMediaFiles, primaryText, setPrimaryText, headline, setHeadline, adDescription, setAdDescription, destUrl, setDestUrl, ctaButton, setCtaButton }) {
  const fileRef  = useRef(null);
  const [drag, setDrag] = useState(false);

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

      {/* Nome do anúncio */}
      <div>
        <SectionLabel sub="Identificação interna, não aparece para o público.">Nome do anúncio</SectionLabel>
        <input
          type="text"
          placeholder="Ex: Promoção Esmalte Gel — Imagem 1"
          value={adName}
          onChange={e => setAdName(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
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
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
        />
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

      {/* Descrição */}
      <div>
        <SectionLabel sub="Texto adicional opcional, exibido em alguns posicionamentos.">Descrição</SectionLabel>
        <input
          type="text"
          placeholder="Ex: Especialistas em estética há mais de 10 anos."
          value={adDescription}
          onChange={e => setAdDescription(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--c-border)', borderRadius: '10px', background: 'var(--c-surface)', color: 'var(--c-text-1)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* URL de destino */}
      <div>
        <SectionLabel>URL de destino *</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--c-surface)', border: `1.5px solid ${destUrl && !destUrl.startsWith('http') ? '#EF4444' : 'var(--c-border)'}`, borderRadius: '10px', padding: '0 14px', transition: 'border-color .15s' }}>
          <span style={{ fontSize: '13px', color: 'var(--c-text-4)', flexShrink: 0 }}>🔗</span>
          <input
            type="url"
            placeholder="https://www.criscostabeleza.com.br"
            value={destUrl}
            onChange={e => setDestUrl(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--c-text-1)', fontFamily: 'inherit', padding: '10px 0', width: '100%' }}
          />
          {destUrl && destUrl.startsWith('http') && <span style={{ color: '#22C55E', fontSize: '14px' }}>✓</span>}
        </div>
        {destUrl && !destUrl.startsWith('http') && <p style={{ fontSize: '11px', color: '#EF4444', marginTop: '4px' }}>URL deve começar com https://</p>}
      </div>

      {/* CTA */}
      <div>
        <SectionLabel sub="Texto do botão que aparece no anúncio.">Botão de chamada para ação (CTA)</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {CTA_OPTIONS.map(cta => (
            <Pill key={cta} selected={ctaButton === cta} onClick={() => setCtaButton(cta)}>{cta}</Pill>
          ))}
        </div>
      </div>

      {/* Preview simplificado */}
      {(mediaFiles.length > 0 || primaryText || headline) && (
        <div>
          <SectionLabel sub="Visualização aproximada no feed do Instagram.">Pré-visualização</SectionLabel>
          <div style={{ maxWidth: '320px', border: '1px solid var(--c-border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--c-card-bg)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--c-border-lt)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#E8A4C8,#C13584)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700 }}>CC</div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-1)' }}>Cris Costa Beauty</div>
                <div style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>Patrocinado · 🌐</div>
              </div>
            </div>
            {/* Texto */}
            {primaryText && <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--c-text-1)', lineHeight: 1.4 }}>{primaryText}</div>}
            {/* Mídia */}
            {mediaFiles.length > 0 && (
              mediaFiles[0].type === 'video'
                ? <video src={mediaFiles[0].url} style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }} />
                : <img src={mediaFiles[0].url} alt="preview" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }} />
            )}
            {/* Rodapé */}
            <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--c-border-lt)' }}>
              <div>
                {headline && <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-1)' }}>{headline}</div>}
                {destUrl && <div style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>{destUrl.replace(/https?:\/\//,'').split('/')[0]}</div>}
              </div>
              <div style={{ padding: '5px 12px', background: 'var(--c-accent)', color: '#fff', borderRadius: '6px', fontSize: '11px', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>
                {ctaButton}
              </div>
            </div>
          </div>
        </div>
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
        data.languages.length ? `🌐 ${data.languages.join(', ')}` : null,
        data.interests.length ? `🎯 ${data.interests.slice(0, 3).join(', ')}${data.interests.length > 3 ? ` +${data.interests.length - 3}` : ''}` : null,
      ].filter(Boolean),
    },
    {
      step: 2,
      label: 'Posicionamentos',
      rows: [
        data.placementMode === 'auto'
          ? '⚡ Automático (Advantage+)'
          : `Manual · ${Object.values(data.selectedPlacements).filter(Boolean).length} posicionamentos`,
      ],
    },
    {
      step: 3,
      label: 'Orçamento',
      rows: [
        data.campaignName ? `📌 ${data.campaignName}` : null,
        data.budgetValue ? `💰 R$ ${Number(data.budgetValue).toFixed(2).replace('.', ',')} / ${data.budgetType === 'daily' ? 'dia' : 'campanha'}` : '💰 — valor não definido',
        `📅 Início: ${data.startDate || 'hoje'} ${data.endDate ? `· Término: ${data.endDate}` : '· Sem data de término'}`,
        `🎯 Lance: ${BID_STRATEGIES.find(s => s.id === data.bidStrategy)?.label || 'Menor custo'}`,
      ].filter(Boolean),
    },
    {
      step: 4,
      label: 'Criativo',
      rows: [
        data.adName ? `📝 ${data.adName}` : null,
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

function SummaryPanel({ step, objective, locations, budgetType, budgetValue, adFormat, campaignName }) {
  const obj = META_OBJECTIVES.flatMap(g => g.items).find(o => o.id === objective);
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="wizard-summary-panel" style={{ background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '14px', padding: '18px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--c-text-4)', marginBottom: '16px' }}>Resumo</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {obj && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '3px' }}>OBJETIVO</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)' }}>{obj.icon} {obj.label}</div>
          </div>
        )}

        {campaignName && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '3px' }}>CAMPANHA</div>
            <div style={{ fontSize: '12px', color: 'var(--c-text-2)' }}>{campaignName}</div>
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
              <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--c-text-4)' }}> /{budgetType === 'daily' ? 'dia' : 'total'}</span>
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
   COMPONENTE PRINCIPAL
══════════════════════════════════════════ */

export default function CreateAd() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  /* ── Estado do formulário ── */
  const [objective,          setObjective]          = useState('');
  const [locations,          setLocations]          = useState([]);
  const [ageRange,           setAgeRange]           = useState([18, 65]);
  const [gender,             setGender]             = useState('all');
  const [languages,          setLanguages]          = useState(['Português']);
  const [interests,          setInterests]          = useState([]);
  const [placementMode,      setPlacementMode]      = useState('auto');
  const [selectedPlacements, setSelectedPlacements] = useState({});
  const [campaignName,       setCampaignName]       = useState('');
  const [budgetType,         setBudgetType]         = useState('daily');
  const [budgetValue,        setBudgetValue]        = useState('');
  const [startDate,          setStartDate]          = useState('');
  const [endDate,            setEndDate]            = useState('');
  const [bidStrategy,        setBidStrategy]        = useState('lowest_cost');
  const [adName,             setAdName]             = useState('');
  const [adFormat,           setAdFormat]           = useState('image');
  const [mediaFiles,         setMediaFiles]         = useState([]);
  const [primaryText,        setPrimaryText]        = useState('');
  const [headline,           setHeadline]           = useState('');
  const [adDescription,      setAdDescription]      = useState('');
  const [destUrl,            setDestUrl]            = useState('');
  const [ctaButton,          setCtaButton]          = useState('Saiba mais');

  function handlePublish() {
    // TODO: integrar com POST /api/campaigns
    alert('✅ Anúncio enviado para revisão do Meta!\n\nVocê será notificado quando for aprovado.');
    navigate('/anuncios');
  }

  const reviewData = { objective, locations, ageRange, gender, languages, interests, placementMode, selectedPlacements, campaignName, budgetType, budgetValue, startDate, endDate, bidStrategy, adName, adFormat, mediaFiles, primaryText, headline, adDescription, destUrl, ctaButton };

  const stepComponents = [
    <Step1Objective objective={objective} setObjective={setObjective} />,
    <Step2Audience  locations={locations} setLocations={setLocations} ageRange={ageRange} setAgeRange={setAgeRange} gender={gender} setGender={setGender} languages={languages} setLanguages={setLanguages} interests={interests} setInterests={setInterests} />,
    <Step3Placements placementMode={placementMode} setPlacementMode={setPlacementMode} selectedPlacements={selectedPlacements} setSelectedPlacements={setSelectedPlacements} />,
    <Step4Budget campaignName={campaignName} setCampaignName={setCampaignName} budgetType={budgetType} setBudgetType={setBudgetType} budgetValue={budgetValue} setBudgetValue={setBudgetValue} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} bidStrategy={bidStrategy} setBidStrategy={setBidStrategy} />,
    <Step5Creative adName={adName} setAdName={setAdName} adFormat={adFormat} setAdFormat={setAdFormat} mediaFiles={mediaFiles} setMediaFiles={setMediaFiles} primaryText={primaryText} setPrimaryText={setPrimaryText} headline={headline} setHeadline={setHeadline} adDescription={adDescription} setAdDescription={setAdDescription} destUrl={destUrl} setDestUrl={setDestUrl} ctaButton={ctaButton} setCtaButton={setCtaButton} />,
    <Step6Review data={reviewData} onGoTo={setStep} />,
  ];

  return (
    <div className="page-container">
      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px' }}>Criar anúncio</h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>Meta Ads · Configure sua campanha de tráfego pago em 6 passos.</p>
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
          {stepComponents[step]}

          {/* Navegação */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--c-border-lt)' }}>
            <button
              onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/anuncios')}
              style={{ padding: '10px 20px', border: '1.5px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-2)', borderRadius: '10px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              {step === 0 ? 'Cancelar' : '← Voltar'}
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                style={{ padding: '10px 26px', background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Próximo →
              </button>
            ) : (
              <button
                onClick={handlePublish}
                style={{ padding: '11px 28px', background: 'linear-gradient(135deg,#E0429C,#C13584)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(193,53,132,.35)' }}
              >
                🚀 Publicar campanha
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
          campaignName={campaignName}
        />
      </div>
    </div>
  );
}
