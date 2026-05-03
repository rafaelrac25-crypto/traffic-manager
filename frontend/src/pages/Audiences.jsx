import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';
import Icon from '../components/Icon';
import {
  DISTRICT_COORDS,
  DISTRICT_NAMES_FOR_SUGGESTION,
  analyzeDistrict,
  DISTRICTS,
  HOME_DISTRICT,
  HOME_RADIUS_KM,
} from '../data/joinvilleDistricts';

/**
 * Audiences — CRUD de públicos salvos.
 * Permite criar, editar, remover e reutilizar segmentações em CreateAd.
 */

/* Joinville/SC — Cris Costa Beauty atende apenas Joinville (regra de negócio).
   Fonte única dos bairros (coords, renda, tier, análise) vem de
   data/joinvilleDistricts.js. */
const JOINVILLE_LOCATIONS = DISTRICT_NAMES_FOR_SUGGESTION;
const CITY_COORDS = DISTRICT_COORDS;

/* Extrai o nome de uma localização (aceita string legada ou objeto novo) */
function locName(l) { return typeof l === 'string' ? l : (l?.name || ''); }

/* Rótulo amigável de gênero — aceita schema antigo (F/M/A) e novo (female/male/all) */
function genderLabel(g) {
  if (g === 'F' || g === 'female') return '♀ Mulheres';
  if (g === 'M' || g === 'male') return '♂ Homens';
  return '⚥ Todos';
}

const INTEREST_SUGGESTIONS = [
  /* Serviços da Cris */
  'Sobrancelhas', 'Maquiagem permanente', 'Brow lamination', 'Lash lifting',
  'Extensão de cílios', 'Cílios', 'Lábios', 'Henna',
  'Limpeza de pele', 'Skincare', 'Microagulhamento', 'Peeling',
  'Anti-idade', 'Dermatologia estética', 'Tricopigmentação',
  /* Genéricos */
  'Estética', 'Autocuidado', 'Beleza', 'Bem-estar', 'Maquiagem',
  'Casamento', 'Noiva', 'Cabelo', 'Barba', 'Cuidados pessoais',
];

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
  </svg>
);
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconUsers = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

function emptyAudience() {
  const jv = CITY_COORDS['Joinville'];
  return {
    name: '',
    description: '',
    gender: 'F',
    ageMin: 25,
    ageMax: 45,
    locations: [{ id: `loc-${Date.now()}`, name: 'Joinville', lat: jv.lat, lng: jv.lng, radius: 5 }],
    interests: [],
  };
}

function buildLocation(name) {
  const v = name.trim();
  if (!v) return null;
  const coords = CITY_COORDS[v];
  return coords
    ? { id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: v, lat: coords.lat, lng: coords.lng, radius: 5 }
    : { id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: v, lat: null, lng: null, radius: 5 };
}

function Chip({ label, onRemove, active = true }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '999px',
      background: active ? 'var(--c-accent-soft)' : 'var(--c-surface)',
      border: `1px solid ${active ? 'rgba(193,53,132,.4)' : 'var(--c-border)'}`,
      fontSize: '11px', fontWeight: 600,
      color: active ? 'var(--c-accent)' : 'var(--c-text-3)',
    }}>
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: '14px', lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </span>
  );
}

function AudienceCard({ audience, onEdit, onRemove, onReuseQuick, onReuseAdjust }) {
  return (
    <div className="ccb-card" style={{
      padding: '18px', borderRadius: '18px',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '3px' }}>
            {audience.name}
          </div>
          {audience.description && (
            <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', lineHeight: 1.5, fontWeight: 400 }}>
              {audience.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={() => onEdit(audience)}
            title="Editar"
            style={iconBtnStyle}
          >
            <IconEdit />
          </button>
          <button
            onClick={() => onRemove(audience.id)}
            title="Remover"
            style={{ ...iconBtnStyle, color: '#F87171' }}
          >
            <IconTrash />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Chip label={genderLabel(audience.gender)} />
        <Chip label={`${audience.ageMin}–${audience.ageMax} anos`} />
      </div>

      {audience.locations?.length > 0 && (
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--c-text-3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1.2px' }}>
            Localização
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {audience.locations.map((l, i) => {
              const label = locName(l);
              return <Chip key={l.id || `loc-${i}-${label}`} label={<><Icon name="pin" size={11} /> {label}</>} active={false} />;
            })}
          </div>
        </div>
      )}

      {audience.interests?.length > 0 && (
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--c-text-3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1.2px' }}>
            Interesses
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {audience.interests.map(i => <Chip key={i} label={i} active={false} />)}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex', gap: '6px', marginTop: '4px',
        paddingTop: '10px', borderTop: '1px solid var(--c-border)',
      }}>
        <button
          onClick={() => onReuseQuick(audience)}
          title="Abre a criação direto na revisão, com texto e orçamento padrão já preenchidos"
          style={{
            flex: 1, padding: '10px 12px',
            background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
            color: '#fff',
            border: 0, borderRadius: '10px',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            boxShadow: '0 6px 18px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
          }}
        >
          <Icon name="rocket" size={14} /> Publicar rápido
        </button>
        <button
          onClick={() => onReuseAdjust(audience)}
          title="Abre a criação com este público selecionado, mas com o passo a passo completo"
          style={{
            flex: 1, padding: '10px 12px',
            background: 'var(--c-surface)', color: 'var(--c-text-2)',
            border: '1px solid var(--c-border)', borderRadius: '10px',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          <Icon name="edit" size={14} /> Usar e ajustar
        </button>
      </div>
    </div>
  );
}

function AudienceForm({ initial, onSave, onCancel }) {
  const [data, setData] = useState(initial || emptyAudience());
  const [locInput, setLocInput] = useState('');
  const [intInput, setIntInput] = useState('');

  function update(patch) { setData(prev => ({ ...prev, ...patch })); }

  function addLocation(loc) {
    const v = (loc || locInput).trim();
    if (!v) return;
    const existingNames = data.locations.map(locName);
    if (existingNames.includes(v)) return;
    const newLoc = buildLocation(v);
    if (!newLoc) return;
    update({ locations: [...data.locations, newLoc] });
    setLocInput('');
  }
  function removeLocation(loc) {
    const target = locName(loc);
    update({ locations: data.locations.filter(l => locName(l) !== target) });
  }
  function addInterest(it) {
    const v = (it || intInput).trim();
    if (!v || data.interests.includes(v)) return;
    update({ interests: [...data.interests, v] });
    setIntInput('');
  }
  function removeInterest(it) {
    update({ interests: data.interests.filter(i => i !== it) });
  }

  function handleSave() {
    if (!data.name.trim()) return;
    onSave(data);
  }

  return (
    <div className="ccb-card" style={{
      borderRadius: '18px', padding: '22px',
      display: 'flex', flexDirection: 'column', gap: '14px',
      borderColor: 'rgba(193,53,132,.55)',
      boxShadow: '0 8px 30px rgba(0,0,0,.4), 0 0 36px rgba(193,53,132,.16), inset 0 1px 0 rgba(255,194,228,.18), inset 0 0 18px rgba(193,53,132,.08)',
    }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>
        {initial ? 'Editar público' : 'Novo público'}
      </h3>

      <div>
        <label style={labelStyle}>Nome do público *</label>
        <input
          type="text"
          placeholder="Ex.: Mulheres 25-45 — estética"
          value={data.name}
          onChange={e => update({ name: e.target.value })}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Descrição</label>
        <textarea
          placeholder="Para que serve este público?"
          value={data.description}
          onChange={e => update({ description: e.target.value })}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Gênero</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'F', label: '♀ Mulheres' },
              { id: 'M', label: '♂ Homens' },
              { id: 'A', label: '⚥ Todos' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => update({ gender: id })}
                style={{
                  flex: 1, padding: '9px', fontSize: '12px', fontWeight: 600,
                  border: `1px solid ${data.gender === id ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  background: data.gender === id ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                  color: data.gender === id ? 'var(--c-accent)' : 'var(--c-text-2)',
                  borderRadius: '10px', cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Idade: {data.ageMin}–{data.ageMax} anos</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number" min="13" max="65"
              value={data.ageMin}
              onChange={e => update({ ageMin: Math.min(Number(e.target.value), data.ageMax) })}
              style={{ ...inputStyle, width: '70px' }}
            />
            <span style={{ color: 'var(--c-text-4)' }}>até</span>
            <input
              type="number" min="13" max="65"
              value={data.ageMax}
              onChange={e => update({ ageMax: Math.max(Number(e.target.value), data.ageMin) })}
              style={{ ...inputStyle, width: '70px' }}
            />
          </div>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Localização</label>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Adicionar cidade"
            value={locInput}
            onChange={e => setLocInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLocation(); } }}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => addLocation()} style={btnSecondary}>
            <IconPlus />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {data.locations.map((l, i) => {
            const label = locName(l);
            return <Chip key={l.id || `loc-${i}-${label}`} label={<><Icon name="pin" size={11} /> {label}</>} onRemove={() => removeLocation(l)} />;
          })}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '4px' }}>Sugestões:</div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {(() => {
            const current = data.locations.map(locName);
            return JOINVILLE_LOCATIONS.filter(c => !current.includes(c)).map(c => (
              <button
                key={c}
                onClick={() => addLocation(c)}
                style={suggestionBtn}
              >
                + {c}
              </button>
            ));
          })()}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Interesses</label>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Adicionar interesse"
            value={intInput}
            onChange={e => setIntInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => addInterest()} style={btnSecondary}>
            <IconPlus />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {data.interests.map(i => (
            <Chip key={i} label={i} onRemove={() => removeInterest(i)} />
          ))}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '4px' }}>Sugestões:</div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {INTEREST_SUGGESTIONS.filter(s => !data.interests.includes(s)).slice(0, 12).map(s => (
            <button
              key={s}
              onClick={() => addInterest(s)}
              style={suggestionBtn}
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button onClick={handleSave} style={btnPrimary} disabled={!data.name.trim()}>
          {initial ? 'Salvar alterações' : 'Criar público'}
        </button>
        <button onClick={onCancel} style={btnGhost}>Cancelar</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Analisador de bairro — Joinville
   Cris digita um bairro e recebe: distância do Boa Vista, perfil de renda,
   ticket esperado, faixa etária, orçamento sugerido.
══════════════════════════════════════════ */

function DistrictAnalyzer() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [noMatch, setNoMatch] = useState(false);

  function runAnalyze(name) {
    const target = (name || query).trim();
    if (!target) return;
    const a = analyzeDistrict(target);
    if (!a) {
      setResult(null);
      setNoMatch(true);
      return;
    }
    setResult(a);
    setNoMatch(false);
  }

  function fmtBRL(n) { return `R$\u00A0${Number(n).toFixed(2).replace('.', ',')}`; }

  return (
    <div className="ccb-card" style={{
      borderLeft: '2px solid var(--c-accent)',
      borderRadius: '18px',
      padding: '18px 20px',
      marginBottom: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '3px' }}>
          <Icon name="target" size={16} /> Analisador de bairro
        </div>
        <div style={{ fontSize: '12px', color: 'var(--c-text-3)', lineHeight: 1.5, fontWeight: 400 }}>
          Digite um bairro de Joinville. Retorna distância do <strong>{HOME_DISTRICT}</strong> (clínica),
          perfil de renda, ticket médio esperado e faixa etária ideal do público.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Digite um bairro de Joinville…"
          value={query}
          onChange={e => { setQuery(e.target.value); setNoMatch(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runAnalyze(); } }}
          list="joinville-districts-datalist"
          style={{
            flex: 1, minWidth: '180px', padding: '9px 12px',
            border: '1px solid var(--c-border)', borderRadius: '10px',
            background: 'var(--c-surface)', color: 'var(--c-text-1)',
            fontSize: '12px', fontFamily: 'inherit', outline: 'none',
          }}
        />
        <datalist id="joinville-districts-datalist">
          {DISTRICTS.map(d => <option key={d.name} value={d.name} />)}
        </datalist>
        <button
          onClick={() => runAnalyze()}
          style={{
            padding: '9px 14px', borderRadius: '10px',
            border: '1px solid var(--c-border)', background: 'var(--c-surface)',
            color: 'var(--c-text-2)', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Analisar
        </button>
      </div>

      {noMatch && (
        <div style={{
          padding: '12px 14px', borderRadius: '10px',
          background: 'rgba(248,113,113,.16)', border: '1px solid rgba(248,113,113,.3)',
          fontSize: '12px', color: '#F87171', lineHeight: 1.5,
        }}>
          Bairro <strong>"{query}"</strong> não está no nosso catálogo de Joinville. Verifique a grafia ou me avise que adicionamos.
          Catálogo atual tem {DISTRICTS.length} bairros.
        </div>
      )}

      {result && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
        }}>
          <StatBlock label="Bairro" value={result.name} sub={result.note} />
          <StatBlock
            label="Distância do Boa Vista"
            value={`${result.distKm.toFixed(1)} km`}
            sub={result.ring.label}
            accent={result.ring.color}
          />
          <StatBlock
            label="Renda familiar estimada"
            value={`${fmtBRL(result.incomeRange.min)} – ${fmtBRL(result.incomeRange.max)}`}
            sub={`Tier: ${result.tier.replace('-', ' ')}`}
          />
          <StatBlock
            label="Ticket esperado (por visita)"
            value={`${fmtBRL(result.ticket.min)} – ${fmtBRL(result.ticket.max)}`}
            sub={result.ticket.mainProcedures.join(' · ')}
          />
          <StatBlock
            label="Faixa etária ideal"
            value={`${result.ageRange[0]}–${result.ageRange[1]} anos`}
            sub="Core Meta Ads"
          />
          <StatBlock
            label="Orçamento diário sugerido"
            value={`${fmtBRL(result.budget.min)} – ${fmtBRL(result.budget.max)}/dia`}
            sub="Para teste inicial"
          />
        </div>
      )}
    </div>
  );
}

function StatBlock({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: `1px solid ${accent || 'var(--c-border)'}`,
      borderRadius: '12px',
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: accent || 'var(--c-text-1)', lineHeight: 1.25, marginBottom: '3px', wordBreak: 'keep-all', fontFeatureSettings: "'tnum'" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '10.5px', color: 'var(--c-text-3)', lineHeight: 1.4, fontWeight: 400 }}>{sub}</div>}
    </div>
  );
}

export default function Audiences() {
  const navigate = useNavigate();
  const { audiences, addAudience, updateAudience, removeAudience } = useAppState();
  const [mode, setMode] = useState('list');
  const [editing, setEditing] = useState(null);

  function handleSave(data) {
    if (editing) {
      updateAudience(editing.id, data);
    } else {
      addAudience(data);
    }
    setMode('list');
    setEditing(null);
  }

  function handleEdit(audience) {
    setEditing(audience);
    setMode('edit');
  }

  function handleCancel() {
    setMode('list');
    setEditing(null);
  }

  function handleReuseQuick(audience) {
    navigate('/criar-anuncio', { state: { reuseAudience: audience, reviewMode: true } });
  }

  function handleReuseAdjust(audience) {
    navigate('/criar-anuncio', { state: { reuseAudience: audience, reviewMode: false } });
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px', letterSpacing: '-0.01em' }}>
            Públicos salvos
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)', margin: 0, fontWeight: 400 }}>
            Crie e reutilize segmentações de público. Use ao montar um anúncio para agilizar o processo.
          </p>
        </div>
        {mode === 'list' && (
          <button onClick={() => { setEditing(null); setMode('edit'); }} style={btnPrimaryInline}>
            <IconPlus /> Novo público
          </button>
        )}
      </div>

      {mode === 'edit' ? (
        <AudienceForm
          initial={editing}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <>
          <DistrictAnalyzer />
          {audiences.length === 0 ? (
            <div style={emptyState}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>
                <IconUsers />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>
                Nenhum público salvo
              </div>
              <div style={{ fontSize: '12px', color: 'var(--c-text-3)', marginBottom: '16px' }}>
                Crie um público para reutilizar em vários anúncios.
              </div>
              <button onClick={() => { setEditing(null); setMode('edit'); }} style={btnPrimaryInline}>
                <IconPlus /> Criar primeiro público
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '14px',
            }}>
              {audiences.map(a => (
                <AudienceCard
                  key={a.id}
                  audience={a}
                  onEdit={handleEdit}
                  onRemove={removeAudience}
                  onReuseQuick={handleReuseQuick}
                  onReuseAdjust={handleReuseAdjust}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '11px 14px', fontSize: '13px',
  border: '1px solid var(--c-border)', borderRadius: '10px',
  background: 'var(--c-surface)', color: 'var(--c-text-1)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block', fontSize: '10.5px', fontWeight: 500,
  color: 'var(--c-text-3)', marginBottom: '6px',
  textTransform: 'uppercase', letterSpacing: '1.2px',
};
const btnPrimary = {
  flex: 1, padding: '12px', fontSize: '13px', fontWeight: 700,
  background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
  color: '#fff',
  border: 0, borderRadius: '12px', cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
};
const btnPrimaryInline = {
  padding: '11px 18px', fontSize: '13px', fontWeight: 700,
  background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
  color: '#fff',
  border: 0, borderRadius: '12px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
};
const btnSecondary = {
  padding: '11px 14px', fontSize: '13px', fontWeight: 700,
  background: 'rgba(193,53,132,.10)', color: 'var(--c-accent)',
  border: '1.5px solid rgba(193,53,132,.65)', borderRadius: '11px', cursor: 'pointer',
  display: 'flex', alignItems: 'center',
  textShadow: '0 0 12px rgba(193,53,132,.4)',
  boxShadow: '0 0 22px rgba(193,53,132,.18), inset 0 0 14px rgba(193,53,132,.08)',
};
const btnGhost = {
  padding: '11px 18px', fontSize: '13px', fontWeight: 600,
  background: 'var(--c-surface)', color: 'var(--c-text-2)',
  border: '1px solid var(--c-border)', borderRadius: '10px', cursor: 'pointer',
};
const iconBtnStyle = {
  padding: '6px 8px', background: 'var(--c-surface)',
  border: '1px solid var(--c-border)', borderRadius: '8px',
  cursor: 'pointer', color: 'var(--c-text-3)',
  display: 'flex', alignItems: 'center',
};
const suggestionBtn = {
  padding: '4px 10px', fontSize: '10.5px', fontWeight: 500,
  background: 'var(--c-surface)', color: 'var(--c-text-3)',
  border: '1px dashed var(--c-border)', borderRadius: '999px', cursor: 'pointer',
};
const emptyState = {
  background: 'var(--c-card-bg)', border: '1px dashed var(--c-border)',
  borderRadius: '18px', padding: '56px 24px', textAlign: 'center',
  color: 'var(--c-text-3)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
};
