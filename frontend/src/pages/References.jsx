import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AD_REFERENCES, REFERENCE_FILTERS, isRelevantForCris } from '../data/adReferences';

const FORMAT_META = {
  reels:    { label: 'Reels',     emoji: '🎬', color: '#E91E63' },
  carousel: { label: 'Carrossel', emoji: '🔄', color: '#3B82F6' },
  image:    { label: 'Imagem',    emoji: '🖼️', color: '#16A34A' },
};

const OBJECTIVE_LABEL = {
  messages:   'Mensagens',
  traffic:    'Tráfego',
  engagement: 'Engajamento',
};

const SORT_OPTIONS = [
  { id: 'score',      label: 'Ranking (melhor → pior)' },
  { id: 'activeDays', label: 'Dias ativo (maior → menor)' },
  { id: 'engagement', label: 'Engajamento (maior → menor)' },
  { id: 'favorites',  label: 'Favoritas primeiro' },
];

const FAV_KEY = 'ccb_reference_favorites';

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveFavorites(favs) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch {}
}

// converte "4.8%" -> 4.8
function engagementNumeric(str) {
  const n = parseFloat(String(str).replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

function ScoreBadge({ score }) {
  const tier = score >= 90 ? 'ouro' : score >= 85 ? 'prata' : 'bronze';
  const bg = tier === 'ouro' ? '#FEF3C7' : tier === 'prata' ? '#E5E7EB' : '#FDE2CC';
  const color = tier === 'ouro' ? '#A16207' : tier === 'prata' ? '#4B5563' : '#9A3412';
  const icon = tier === 'ouro' ? '🏆' : tier === 'prata' ? '🥈' : '🥉';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 9px', borderRadius: '999px',
      background: bg, color,
      fontSize: '11px', fontWeight: 700,
    }}>
      {icon} {score}
    </span>
  );
}

function FavoriteButton({ active, onClick, size = 18 }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={active ? 'Remover dos favoritos' : 'Favoritar'}
      aria-label={active ? 'Remover dos favoritos' : 'Favoritar'}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: `${size}px`,
        lineHeight: 1,
        padding: '4px',
        color: active ? '#F59E0B' : 'var(--c-text-4)',
        transition: 'transform .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {active ? '★' : '☆'}
    </button>
  );
}

function ReferenceCard({ item, position, onOpen, isFavorite, onToggleFavorite }) {
  const fmt = FORMAT_META[item.format] || FORMAT_META.image;
  return (
    <div
      onClick={() => onOpen(item)}
      style={{
        background: 'var(--c-card-bg)',
        border: '1px solid var(--c-border)',
        borderRadius: '14px',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all .18s',
        display: 'flex', flexDirection: 'column', gap: '10px',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--c-accent)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(214,141,143,.18)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--c-border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header: posição + marca + favorito + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: 'var(--c-surface)', border: '1.5px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700, color: 'var(--c-text-3)',
          flexShrink: 0,
        }}>
          #{position}
        </span>
        <span style={{ fontSize: '20px' }}>{item.brandLogo}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-4)', letterSpacing: '.3px', textTransform: 'uppercase' }}>
            {item.brand}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.3 }}>
            {item.title}
          </div>
        </div>
        <FavoriteButton active={isFavorite} onClick={onToggleFavorite} />
        <ScoreBadge score={item.score} />
      </div>

      {/* Preview visual: placeholder com paleta */}
      <div style={{
        height: '120px', borderRadius: '10px', overflow: 'hidden',
        position: 'relative',
        background: `linear-gradient(135deg, ${item.colorPalette.join(', ')})`,
      }}>
        <div style={{
          position: 'absolute', top: '8px', left: '10px',
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '20px',
          background: 'rgba(255,255,255,.85)', color: fmt.color,
          fontSize: '10px', fontWeight: 700,
        }}>
          {fmt.emoji} {fmt.label}
        </div>
        <div style={{
          position: 'absolute', bottom: '8px', right: '10px',
          padding: '2px 7px', borderRadius: '8px',
          background: 'rgba(0,0,0,.55)', color: '#fff',
          fontSize: '9px', fontWeight: 600,
        }}>
          {item.activeDays}d ativo · {item.engagementRate}
        </div>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: '34px', opacity: .85,
        }}>
          {item.brandLogo}
        </div>
      </div>

      {/* Hook */}
      <div style={{
        padding: '8px 10px', borderRadius: '8px',
        background: 'var(--c-surface)',
        fontSize: '11.5px', color: 'var(--c-text-2)', lineHeight: 1.45,
      }}>
        <strong style={{ color: 'var(--c-accent)' }}>Gancho:</strong> {item.hook}
      </div>

      {/* Footer: objetivo + biblioteca Meta + CTA visual */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--c-text-3)', gap: '8px' }}>
        <span>🎯 {OBJECTIVE_LABEL[item.objective]}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {item.adLibraryUrl && (
            <a
              href={item.adLibraryUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="Abrir na Meta Ad Library"
              style={{
                color: 'var(--c-text-3)', textDecoration: 'none', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: '3px',
              }}
            >
              🔗 Ver anúncio
            </a>
          )}
          <span style={{ color: 'var(--c-accent)', fontWeight: 700 }}>Detalhes →</span>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text, label = 'Copiar' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        padding: '4px 10px', borderRadius: '7px',
        border: '1px solid var(--c-border)', background: 'var(--c-card-bg)',
        fontSize: '10.5px', fontWeight: 600, color: copied ? 'var(--c-accent)' : 'var(--c-text-3)',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
        transition: 'all .15s',
      }}
    >
      {copied ? '✓ Copiado!' : `📋 ${label}`}
    </button>
  );
}

function ReferenceModal({ item, onClose, onUse, isFavorite, onToggleFavorite }) {
  if (!item) return null;
  const fmt = FORMAT_META[item.format] || FORMAT_META.image;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--c-card-bg)',
          borderRadius: '18px',
          border: '1px solid var(--c-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,.4)',
          width: '100%', maxWidth: '720px',
          maxHeight: '90vh', overflow: 'auto',
        }}
      >
        {/* Hero */}
        <div style={{
          height: '180px',
          background: `linear-gradient(135deg, ${item.colorPalette.join(', ')})`,
          position: 'relative', borderRadius: '18px 18px 0 0',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '14px', right: '14px',
              width: '32px', height: '32px', borderRadius: '10px',
              background: 'rgba(255,255,255,.85)', border: 'none',
              cursor: 'pointer', fontSize: '18px', lineHeight: 1,
              color: 'var(--c-text-1)',
            }}
          >×</button>
          <div style={{
            position: 'absolute', top: '14px', left: '14px',
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '999px',
            background: 'rgba(255,255,255,.85)', color: fmt.color,
            fontSize: '11px', fontWeight: 700,
          }}>
            {fmt.emoji} {fmt.label}
          </div>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            fontSize: '64px', opacity: .9,
          }}>
            {item.brandLogo}
          </div>
        </div>

        {/* Corpo */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-4)', letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: '2px' }}>
                {item.brand}
              </div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--c-text-1)', margin: 0, lineHeight: 1.3 }}>
                {item.title}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FavoriteButton active={isFavorite} onClick={onToggleFavorite} size={22} />
              <ScoreBadge score={item.score} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '16px' }}>
            <Stat label="Engajamento" value={item.engagementRate} />
            <Stat label="Dias ativo" value={`${item.activeDays}d`} />
            <Stat label="Objetivo" value={OBJECTIVE_LABEL[item.objective]} />
          </div>

          <Section title="Por que funciona">
            <p style={{ fontSize: '12.5px', color: 'var(--c-text-2)', lineHeight: 1.65, margin: 0 }}>
              {item.whyWorks}
            </p>
          </Section>

          <Section title="Texto do anúncio" action={<CopyButton text={item.primaryText} label="Copiar texto" />}>
            <div style={{
              padding: '12px 14px', borderRadius: '10px',
              background: 'var(--c-surface)', border: '1px solid var(--c-border-lt)',
              fontSize: '12.5px', color: 'var(--c-text-1)', lineHeight: 1.55,
            }}>
              {item.primaryText}
            </div>
          </Section>

          <Section title="Título" action={<CopyButton text={item.headline} label="Copiar título" />}>
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              background: 'var(--c-surface)', border: '1px solid var(--c-border-lt)',
              fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)',
            }}>
              {item.headline}
            </div>
          </Section>

          <Section title="Botão CTA">
            <span style={{
              display: 'inline-block', padding: '6px 14px', borderRadius: '8px',
              background: 'var(--c-accent)', color: '#fff',
              fontSize: '12px', fontWeight: 700,
            }}>
              {item.cta}
            </span>
          </Section>

          <Section title="Público-alvo sugerido">
            <p style={{ fontSize: '12px', color: 'var(--c-text-3)', margin: 0, lineHeight: 1.55 }}>
              {item.targetAudience}
            </p>
          </Section>

          <Section title="Estilo visual">
            <p style={{ fontSize: '12px', color: 'var(--c-text-3)', margin: '0 0 8px', lineHeight: 1.55 }}>
              {item.mediaStyle}
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {item.colorPalette.map(c => (
                <button
                  key={c}
                  onClick={() => navigator.clipboard?.writeText(c)}
                  title={`Clique pra copiar ${c}`}
                  style={{
                    width: '44px', height: '44px', borderRadius: '8px',
                    background: c, border: '1px solid var(--c-border)',
                    display: 'flex', alignItems: 'end', justifyContent: 'center',
                    fontSize: '8px', color: 'rgba(0,0,0,.65)', fontWeight: 700,
                    padding: '2px', cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Rodapé fixo */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--c-border)',
          background: 'var(--c-surface)',
          display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 14px', borderRadius: '9px',
              border: '1.5px solid var(--c-border)', background: 'var(--c-card-bg)',
              fontSize: '12px', fontWeight: 600, color: 'var(--c-text-2)', cursor: 'pointer',
            }}
          >
            Fechar
          </button>
          {item.adLibraryUrl && (
            <a
              href={item.adLibraryUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '9px 14px', borderRadius: '9px',
                border: '1.5px solid var(--c-border)', background: 'var(--c-card-bg)',
                fontSize: '12px', fontWeight: 600, color: 'var(--c-text-2)',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}
            >
              🔗 Ver anúncio real
            </a>
          )}
          <button
            onClick={() => onUse(item)}
            style={{
              padding: '9px 18px', borderRadius: '9px',
              border: 'none', background: 'var(--c-accent)',
              fontSize: '12px', fontWeight: 700, color: '#fff', cursor: 'pointer',
            }}
          >
            🚀 Criar anúncio a partir desta referência
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: '8px',
      background: 'var(--c-surface)', border: '1px solid var(--c-border-lt)',
    }}>
      <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px', marginBottom: '6px',
      }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)',
          letterSpacing: '.5px', textTransform: 'uppercase',
        }}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function References() {
  const navigate = useNavigate();
  const [format, setFormat] = useState('all');
  const [objective, setObjective] = useState('all');
  const [onlyCris, setOnlyCris] = useState(false);
  const [sortBy, setSortBy] = useState('score');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [visibleCount, setVisibleCount] = useState(9);
  const [favorites, setFavorites] = useState(() => loadFavorites());

  useEffect(() => { saveFavorites(favorites); }, [favorites]);

  const toggleFavorite = useCallback((id) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFormat('all'); setObjective('all'); setOnlyCris(false); setQuery('');
  }, []);

  const filtered = useMemo(() => {
    let list = [...AD_REFERENCES];
    if (format !== 'all') list = list.filter(r => r.format === format);
    if (objective !== 'all') list = list.filter(r => r.objective === objective);
    if (onlyCris) list = list.filter(isRelevantForCris);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.brand.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.hook.toLowerCase().includes(q) ||
        r.headline.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case 'activeDays':
        list.sort((a, b) => b.activeDays - a.activeDays);
        break;
      case 'engagement':
        list.sort((a, b) => engagementNumeric(b.engagementRate) - engagementNumeric(a.engagementRate));
        break;
      case 'favorites':
        list.sort((a, b) => {
          const fa = favorites.has(a.id) ? 1 : 0;
          const fb = favorites.has(b.id) ? 1 : 0;
          if (fa !== fb) return fb - fa;
          return b.score - a.score;
        });
        break;
      case 'score':
      default:
        list.sort((a, b) => b.score - a.score);
    }
    return list;
  }, [format, objective, onlyCris, sortBy, query, favorites]);

  const visible = filtered.slice(0, visibleCount);
  const favoriteCount = favorites.size;

  function handleUseReference(item) {
    navigate('/criar-anuncio', {
      state: {
        referenceRef: {
          id: item.id,
          brand: item.brand,
          title: item.title,
          primaryText: item.primaryText,
          headline: item.headline,
          cta: item.cta,
          objective: item.objective,
          targetAudience: item.targetAudience,
          format: item.format,
        },
      },
    });
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            Referências
          </h1>
          <p style={{ fontSize: '12.5px', color: 'var(--c-text-3)', lineHeight: 1.5, maxWidth: '640px' }}>
            Anúncios de marcas renomadas de estética e beleza que estão performando muito bem na biblioteca de anúncios do Meta.
            Ranking do melhor pro pior. Clique em um card para ver o criativo completo e criar um anúncio inspirado nele.
          </p>
        </div>
        {favoriteCount > 0 && (
          <div style={{
            padding: '8px 14px', borderRadius: '10px',
            background: '#FEF3C7', color: '#A16207',
            fontSize: '11.5px', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>
            ★ {favoriteCount} favorita{favoriteCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Barra de busca + filtros */}
      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
        padding: '10px 12px', marginBottom: '16px',
        background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '12px',
      }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
          <span style={{
            position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '12px', color: 'var(--c-text-4)', pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por marca, gancho, título..."
            style={{
              width: '100%', padding: '7px 10px 7px 30px', borderRadius: '7px',
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              color: 'var(--c-text-1)', fontSize: '11.5px', fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
        <select
          value={format}
          onChange={e => setFormat(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: '7px',
            border: '1px solid var(--c-border)', background: 'var(--c-surface)',
            color: 'var(--c-text-2)', fontSize: '11.5px', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {REFERENCE_FILTERS.format.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select
          value={objective}
          onChange={e => setObjective(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: '7px',
            border: '1px solid var(--c-border)', background: 'var(--c-surface)',
            color: 'var(--c-text-2)', fontSize: '11.5px', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {REFERENCE_FILTERS.objective.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: '7px',
            border: '1px solid var(--c-border)', background: 'var(--c-surface)',
            color: 'var(--c-text-2)', fontSize: '11.5px', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--c-text-2)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={onlyCris}
            onChange={e => setOnlyCris(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Relevantes p/ Cris
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--c-text-4)' }}>
          {filtered.length} referência{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid de cards */}
      {filtered.length === 0 ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
          background: 'var(--c-card-bg)', border: '1px dashed var(--c-border)',
          borderRadius: '14px',
        }}>
          <div style={{ fontSize: '34px', marginBottom: '8px', opacity: .6 }}>🔍</div>
          <div style={{ fontSize: '13px', color: 'var(--c-text-3)', fontWeight: 600, marginBottom: '12px' }}>
            Nenhuma referência com esses filtros.
          </div>
          <button
            onClick={resetFilters}
            style={{
              padding: '8px 16px', borderRadius: '8px',
              border: '1.5px solid var(--c-accent)', background: 'transparent',
              color: 'var(--c-accent)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            🧹 Limpar filtros
          </button>
        </div>
      ) : (
        <>
          <div
            className="grid-compact-mobile"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '14px',
              marginBottom: '18px',
            }}
          >
            {visible.map((item, i) => (
              <ReferenceCard
                key={item.id}
                item={item}
                position={i + 1}
                onOpen={setSelected}
                isFavorite={favorites.has(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
              />
            ))}
          </div>

          {visible.length < filtered.length && (
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setVisibleCount(c => c + 9)}
                style={{
                  padding: '9px 18px', borderRadius: '9px',
                  border: '1.5px solid var(--c-border)', background: 'var(--c-card-bg)',
                  color: 'var(--c-text-2)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Carregar mais ({filtered.length - visible.length} restantes)
              </button>
            </div>
          )}
        </>
      )}

      <ReferenceModal
        item={selected}
        onClose={() => setSelected(null)}
        onUse={handleUseReference}
        isFavorite={selected ? favorites.has(selected.id) : false}
        onToggleFavorite={() => selected && toggleFavorite(selected.id)}
      />
    </div>
  );
}
