import React, { useState } from 'react';
import { useAppState } from '../contexts/AppStateContext';

/**
 * Audiences — CRUD de públicos salvos.
 * Permite criar, editar, remover e reutilizar segmentações em CreateAd.
 */

const BCAMBORIU_CITIES = [
  'Balneário Camboriú', 'Itajaí', 'Itapema', 'Camboriú',
  'Navegantes', 'Penha', 'Porto Belo', 'Bombinhas', 'Brusque',
];

const INTEREST_SUGGESTIONS = [
  'Estética', 'Skincare', 'Autocuidado', 'Beleza', 'Bem-estar',
  'Casamento', 'Eventos', 'Maquiagem', 'Cabelo', 'Unhas',
  'Depilação', 'Massagem', 'Spa', 'Yoga', 'Fitness',
  'Moda', 'Shopping', 'Viagens', 'Gastronomia', 'Noiva',
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
  return {
    name: '',
    description: '',
    gender: 'F',
    ageMin: 25,
    ageMax: 45,
    locations: ['Balneário Camboriú'],
    interests: [],
  };
}

function Chip({ label, onRemove, active = true }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '20px',
      background: active ? 'var(--c-active-bg)' : 'var(--c-surface)',
      border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
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

function AudienceCard({ audience, onEdit, onRemove }) {
  return (
    <div className="ccb-card" style={{
      background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
      borderRadius: '14px', padding: '18px',
      display: 'flex', flexDirection: 'column', gap: '10px',
      boxShadow: '0 2px 8px var(--c-shadow)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '3px' }}>
            {audience.name}
          </div>
          {audience.description && (
            <div style={{ fontSize: '11px', color: 'var(--c-text-3)', lineHeight: 1.5 }}>
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
            style={{ ...iconBtnStyle, color: '#DC2626' }}
          >
            <IconTrash />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Chip label={audience.gender === 'F' ? '♀ Mulheres' : audience.gender === 'M' ? '♂ Homens' : '⚥ Todos'} />
        <Chip label={`${audience.ageMin}–${audience.ageMax} anos`} />
      </div>

      {audience.locations?.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Localização
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {audience.locations.map(l => <Chip key={l} label={`📍 ${l}`} active={false} />)}
          </div>
        </div>
      )}

      {audience.interests?.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Interesses
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {audience.interests.map(i => <Chip key={i} label={i} active={false} />)}
          </div>
        </div>
      )}
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
    if (!v || data.locations.includes(v)) return;
    update({ locations: [...data.locations, v] });
    setLocInput('');
  }
  function removeLocation(loc) {
    update({ locations: data.locations.filter(l => l !== loc) });
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
    <div style={{
      background: 'var(--c-card-bg)', border: '1.5px solid var(--c-accent)',
      borderRadius: '16px', padding: '22px',
      display: 'flex', flexDirection: 'column', gap: '14px',
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
                  border: `1.5px solid ${data.gender === id ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  background: data.gender === id ? 'var(--c-active-bg)' : 'var(--c-surface)',
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
          {data.locations.map(l => (
            <Chip key={l} label={`📍 ${l}`} onRemove={() => removeLocation(l)} />
          ))}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '4px' }}>Sugestões:</div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {BCAMBORIU_CITIES.filter(c => !data.locations.includes(c)).map(c => (
            <button
              key={c}
              onClick={() => addLocation(c)}
              style={suggestionBtn}
            >
              + {c}
            </button>
          ))}
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

export default function Audiences() {
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

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            Públicos salvos
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)', margin: 0 }}>
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
  width: '100%', padding: '10px 14px', fontSize: '13px',
  border: '1.5px solid var(--c-border)', borderRadius: '10px',
  background: 'var(--c-surface)', color: 'var(--c-text-1)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 700,
  color: 'var(--c-text-3)', marginBottom: '6px',
  textTransform: 'uppercase', letterSpacing: '.4px',
};
const btnPrimary = {
  flex: 1, padding: '12px', fontSize: '13px', fontWeight: 700,
  background: 'var(--c-accent)', color: '#fff',
  border: 'none', borderRadius: '10px', cursor: 'pointer',
};
const btnPrimaryInline = {
  padding: '10px 16px', fontSize: '12px', fontWeight: 700,
  background: 'var(--c-accent)', color: '#fff',
  border: 'none', borderRadius: '10px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: '6px',
};
const btnSecondary = {
  padding: '10px 14px', fontSize: '12px', fontWeight: 600,
  background: 'var(--c-surface)', color: 'var(--c-accent)',
  border: '1.5px solid var(--c-accent)', borderRadius: '10px', cursor: 'pointer',
  display: 'flex', alignItems: 'center',
};
const btnGhost = {
  padding: '12px 18px', fontSize: '13px', fontWeight: 600,
  background: 'var(--c-surface)', color: 'var(--c-text-3)',
  border: '1.5px solid var(--c-border)', borderRadius: '10px', cursor: 'pointer',
};
const iconBtnStyle = {
  padding: '6px 8px', background: 'var(--c-surface)',
  border: '1px solid var(--c-border)', borderRadius: '8px',
  cursor: 'pointer', color: 'var(--c-text-3)',
  display: 'flex', alignItems: 'center',
};
const suggestionBtn = {
  padding: '4px 9px', fontSize: '10px', fontWeight: 600,
  background: 'var(--c-surface)', color: 'var(--c-text-3)',
  border: '1px dashed var(--c-border)', borderRadius: '14px', cursor: 'pointer',
};
const emptyState = {
  background: 'var(--c-card-bg)', border: '1px dashed var(--c-border)',
  borderRadius: '18px', padding: '56px 24px', textAlign: 'center',
  color: 'var(--c-text-3)',
};
