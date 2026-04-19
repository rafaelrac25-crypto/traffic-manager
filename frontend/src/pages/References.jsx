import React, { useState, useMemo } from 'react';
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

function ReferenceCard({ ref, position, onOpen }) {
  const fmt = FORMAT_META[ref.format] || FORMAT_META.image;
  return (
    <div
      onClick={() => onOpen(ref)}
      style={{
        background: 'var(--c-card-bg)',
        border: '1px solid var(--c-border)',
        borderRadius: '14px',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all .18s',
        display: 'flex', flexDirection: 'column', gap: '10px',
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
      {/* Header: posição + marca + score */}
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
        <span style={{ fontSize: '20px' }}>{ref.brandLogo}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-4)', letterSpacing: '.3px', textTransform: 'uppercase' }}>
            {ref.brand}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.3 }}>
            {ref.title}
          </div>
        </div>
        <ScoreBadge score={ref.score} />
      </div>

      {/* Preview visual: placeholder com paleta */}
      <div style={{
        height: '120px', borderRadius: '10px', overflow: 'hidden',
        position: 'relative',
        background: `linear-gradient(135deg, ${ref.colorPalette.join(', ')})`,
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
          {ref.activeDays}d ativo · {ref.engagementRate}
        </div>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: '34px', opacity: .85,
        }}>
          {ref.brandLogo}
        </div>
      </div>

      {/* Hook */}
      <div style={{
        padding: '8px 10px', borderRadius: '8px',
        background: 'var(--c-surface)',
        fontSize: '11.5px', color: 'var(--c-text-2)', lineHeight: 1.45,
      }}>
        <strong style={{ color: 'var(--c-accent)' }}>Gancho:</strong> {ref.hook}
      </div>

      {/* Footer: objetivo + CTA visual */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--c-text-3)' }}>
        <span>🎯 {OBJECTIVE_LABEL[ref.objective]}</span>
        <span style={{ color: 'var(--c-accent)', fontWeight: 700 }}>Ver detalhes →</span>
      </div>
    </div>
  );
}

function ReferenceModal({ ref, onClose, onUse }) {
  if (!ref) return null;
  const fmt = FORMAT_META[ref.format] || FORMAT_META.image;

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
          background: `linear-gradient(135deg, ${ref.colorPalette.join(', ')})`,
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
            {ref.brandLogo}
          </div>
        </div>

        {/* Corpo */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-4)', letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: '2px' }}>
                {ref.brand}
              </div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--c-text-1)', margin: 0, lineHeight: 1.3 }}>
                {ref.title}
              </h2>
            </div>
            <ScoreBadge score={ref.score} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '16px' }}>
            <Stat label="Engajamento" value={ref.engagementRate} />
            <Stat label="Dias ativo" value={`${ref.activeDays}d`} />
            <Stat label="Objetivo" value={OBJECTIVE_LABEL[ref.objective]} />
          </div>

          <Section title="Por que funciona">
            <p style={{ fontSize: '12.5px', color: 'var(--c-text-2)', lineHeight: 1.65, margin: 0 }}>
              {ref.whyWorks}
            </p>
          </Section>

          <Section title="Texto do anúncio">
            <div style={{
              padding: '12px 14px', borderRadius: '10px',
              background: 'var(--c-surface)', border: '1px solid var(--c-border-lt)',
              fontSize: '12.5px', color: 'var(--c-text-1)', lineHeight: 1.55,
            }}>
              {ref.primaryText}
            </div>
          </Section>

          <Section title="Título">
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              background: 'var(--c-surface)', border: '1px solid var(--c-border-lt)',
              fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)',
            }}>
              {ref.headline}
            </div>
          </Section>

          <Section title="Botão CTA">
            <span style={{
              display: 'inline-block', padding: '6px 14px', borderRadius: '8px',
              background: 'var(--c-accent)', color: '#fff',
              fontSize: '12px', fontWeight: 700,
            }}>
              {ref.cta}
            </span>
          </Section>

          <Section title="Público-alvo sugerido">
            <p style={{ fontSize: '12px', color: 'var(--c-text-3)', margin: 0, lineHeight: 1.55 }}>
              {ref.targetAudience}
            </p>
          </Section>

          <Section title="Estilo visual">
            <p style={{ fontSize: '12px', color: 'var(--c-text-3)', margin: '0 0 8px', lineHeight: 1.55 }}>
              {ref.mediaStyle}
            </p>
            <div style={{ display: 'flex', gap: '6px' }}>
              {ref.colorPalette.map(c => (
                <div key={c} style={{
                  width: '32px', height: '32px', borderRadius: '6px',
                  background: c, border: '1px solid var(--c-border)',
                  display: 'flex', alignItems: 'end', justifyContent: 'center',
                  fontSize: '8px', color: 'rgba(0,0,0,.5)', fontWeight: 600,
                  padding: '2px',
                }} title={c}>
                  {c}
                </div>
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
          <button
            onClick={() => onUse(ref)}
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

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)',
        letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: '6px',
      }}>
        {title}
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
  const [selected, setSelected] = useState(null);
  const [visibleCount, setVisibleCount] = useState(9);

  const filtered = useMemo(() => {
    let list = [...AD_REFERENCES];
    if (format !== 'all') list = list.filter(r => r.format === format);
    if (objective !== 'all') list = list.filter(r => r.objective === objective);
    if (onlyCris) list = list.filter(isRelevantForCris);
    return list.sort((a, b) => b.score - a.score);
  }, [format, objective, onlyCris]);

  const visible = filtered.slice(0, visibleCount);

  function handleUseReference(ref) {
    navigate('/criar-anuncio', {
      state: {
        referenceRef: {
          id: ref.id,
          brand: ref.brand,
          title: ref.title,
          primaryText: ref.primaryText,
          headline: ref.headline,
          cta: ref.cta,
          objective: ref.objective,
          targetAudience: ref.targetAudience,
          format: ref.format,
        },
      },
    });
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
          Referências
        </h1>
        <p style={{ fontSize: '12.5px', color: 'var(--c-text-3)', lineHeight: 1.5, maxWidth: '640px' }}>
          Anúncios de marcas renomadas de estética e beleza que estão performando muito bem na biblioteca de anúncios do Meta.
          Ranking do melhor pro pior. Clique em um card para ver o criativo completo e criar um anúncio inspirado nele.
        </p>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
        padding: '10px 12px', marginBottom: '16px',
        background: 'var(--c-card-bg)', border: '1px solid var(--c-border)', borderRadius: '12px',
      }}>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--c-text-2)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={onlyCris}
            onChange={e => setOnlyCris(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Apenas relevantes para Cris Costa Beauty
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--c-text-4)' }}>
          {filtered.length} referências
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
          <div style={{ fontSize: '13px', color: 'var(--c-text-3)', fontWeight: 600 }}>
            Nenhuma referência com esses filtros.
          </div>
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
            {visible.map((ref, i) => (
              <ReferenceCard key={ref.id} ref={ref} position={i + 1} onOpen={setSelected} />
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
        ref={selected}
        onClose={() => setSelected(null)}
        onUse={handleUseReference}
      />
    </div>
  );
}
