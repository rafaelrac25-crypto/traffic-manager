import React, { useEffect, useState, useCallback } from 'react';
import { useAppState } from '../contexts/AppStateContext';

/* ============================================================
   Visão Meta — Campanhas em 3 níveis (Campanha > Conjunto > Anúncio)
   Página NOVA, isolada da /anuncios. Lê hierarquia ao vivo do Meta
   via /api/campaigns/:id/hierarchy.

   Ações por nível:
   - Conjunto: duplicar (testar outro público), editar orçamento ±20%
   - Anúncio: criar anúncio novo no conjunto (avisa que reseta aprendizado)

   Avisos visuais:
   - Verde ✓ "Seguro — não reseta aprendizado"
   - Vermelho ⚠ "Reseta aprendizado do conjunto"
   ============================================================ */

const COLOR_SAFE   = { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', icon: '✓' };
const COLOR_RESET  = { bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C', icon: '⚠' };
const COLOR_INFO   = { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8', icon: 'ℹ' };

function fmtBRL(n) {
  if (n == null) return '—';
  return `R$ ${Number(n).toFixed(2).replace('.', ',')}`;
}
function statusLabel(s) {
  const map = {
    ACTIVE: { txt: 'Rodando', color: '#22C55E' },
    PAUSED: { txt: 'Pausado', color: '#9CA3AF' },
    PENDING_REVIEW: { txt: 'Em análise', color: '#F59E0B' },
    DISAPPROVED: { txt: 'Reprovado', color: '#EF4444' },
    WITH_ISSUES: { txt: 'Com avisos', color: '#F59E0B' },
    CAMPAIGN_PAUSED: { txt: 'Campanha pausada', color: '#9CA3AF' },
    ADSET_PAUSED: { txt: 'Conjunto pausado', color: '#9CA3AF' },
    AD_PAUSED: { txt: 'Anúncio pausado', color: '#9CA3AF' },
  };
  return map[s] || { txt: s || '—', color: '#9CA3AF' };
}

function Banner({ kind = 'info', title, children }) {
  const c = kind === 'safe' ? COLOR_SAFE : kind === 'reset' ? COLOR_RESET : COLOR_INFO;
  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: '10px',
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      fontSize: '12.5px',
      color: c.text,
      lineHeight: 1.5,
    }}>
      <span style={{ fontSize: '16px', flexShrink: 0, fontWeight: 700 }}>{c.icon}</span>
      <div>
        {title && <div style={{ fontWeight: 700, marginBottom: '2px' }}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.5)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--c-card-bg)',
          borderRadius: '14px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,.3)',
          border: '1px solid var(--c-border)',
        }}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--c-border-lt)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)' }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              cursor: 'pointer', fontSize: '20px',
              color: 'var(--c-text-3)', padding: '0 6px', lineHeight: 1,
            }}
          >×</button>
        </div>
        <div style={{ padding: '20px' }}>
          {children}
        </div>
        {footer && (
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--c-border-lt)',
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, danger, ...rest }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: danger ? '#EF4444' : 'var(--c-accent)',
        color: '#fff',
        border: 'none',
        borderRadius: '9px',
        padding: '9px 18px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'transform .12s, box-shadow .12s',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(214,141,143,.3)'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
      {...rest}
    >
      {children}
    </button>
  );
}
function GhostButton({ children, onClick, disabled, ...rest }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        color: 'var(--c-text-2)',
        border: '1px solid var(--c-border)',
        borderRadius: '9px',
        padding: '9px 16px',
        fontSize: '13px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--c-text-2)', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '4px', lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '9px 12px',
        border: '1.5px solid var(--c-border)',
        borderRadius: '9px',
        fontSize: '13px',
        fontFamily: 'inherit',
        background: 'var(--c-surface)',
        color: 'var(--c-text-1)',
        outline: 'none',
        ...(props.style || {}),
      }}
    />
  );
}

/* ─── Modal: Editar orçamento ─── */
function BudgetEditModal({ open, onClose, level, target, campaignLocalId, adsetId, onSaved }) {
  const [newBudget, setNewBudget] = useState('');
  const [loading, setLoading]     = useState(false);
  const [errMsg, setErrMsg]       = useState(null);

  useEffect(() => {
    if (open && target?.daily_budget != null) setNewBudget(String(target.daily_budget.toFixed(2)));
    setErrMsg(null);
  }, [open, target]);

  const current = target?.daily_budget ?? target?.lifetime_budget ?? null;
  const newVal = Number(String(newBudget).replace(',', '.'));
  const safe = current != null && Number.isFinite(newVal) && newVal > 0
    && Math.abs((newVal - current) / current) * 100 <= 20;
  const min = current != null ? (current * 0.8).toFixed(2) : '—';
  const max = current != null ? (current * 1.2).toFixed(2) : '—';

  async function handleSave() {
    if (!safe) return;
    setLoading(true); setErrMsg(null);
    try {
      const r = await fetch(`/api/campaigns/${campaignLocalId}/budget-safe`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newBudget: newVal,
          level,
          adsetId: level === 'adset' ? adsetId : undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      onSaved?.(data);
      onClose();
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar orçamento ${level === 'campaign' ? 'da campanha' : 'do conjunto'}`}
      footer={
        <>
          <GhostButton onClick={onClose} disabled={loading}>Cancelar</GhostButton>
          <PrimaryButton onClick={handleSave} disabled={!safe || loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </PrimaryButton>
        </>
      }
    >
      <Banner kind="safe" title="Mudança até 20% não reseta o aprendizado">
        Você pode subir ou baixar o orçamento até 20% e o conjunto continua aprendendo. Acima disso, o sistema bloqueia e te avisa.
      </Banner>
      <div style={{ marginTop: '16px' }}>
        <Field label="Orçamento atual" hint={`Mínimo seguro: ${fmtBRL(min)} · Máximo seguro: ${fmtBRL(max)}`}>
          <TextInput value={fmtBRL(current)} disabled />
        </Field>
        <Field label="Novo orçamento (R$/dia)" hint="Digite o valor em reais. O sistema valida antes de aplicar.">
          <TextInput
            type="text"
            value={newBudget}
            onChange={e => setNewBudget(e.target.value)}
            placeholder="Ex: 12,00"
          />
        </Field>
        {!safe && newBudget && Number.isFinite(newVal) && current != null && (
          <Banner kind="reset" title="Mudança maior que 20% — bloqueada">
            Esse valor está fora da margem segura. Os limites são {fmtBRL(min)} a {fmtBRL(max)}.
          </Banner>
        )}
        {errMsg && (
          <div style={{ marginTop: '12px' }}>
            <Banner kind="reset" title="Erro">{errMsg}</Banner>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ─── Modal: Duplicar conjunto ─── */
function DuplicateAdSetModal({ open, onClose, adset, campaignLocalId, onSaved }) {
  const [name, setName]               = useState('');
  const [dailyBudget, setDailyBudget] = useState('');
  const [ageMin, setAgeMin]           = useState('');
  const [ageMax, setAgeMax]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [errMsg, setErrMsg]           = useState(null);

  useEffect(() => {
    if (!open) return;
    setName((adset?.name || '') + ' — v2');
    setDailyBudget(adset?.daily_budget != null ? String(adset.daily_budget.toFixed(2)) : '');
    setAgeMin(adset?.targeting?.age_min != null ? String(adset.targeting.age_min) : '');
    setAgeMax(adset?.targeting?.age_max != null ? String(adset.targeting.age_max) : '');
    setErrMsg(null);
  }, [open, adset]);

  async function handleSave() {
    setLoading(true); setErrMsg(null);
    try {
      const overrides = {};
      if (name && name !== adset?.name) overrides.name = name;
      if (dailyBudget) {
        const v = Number(String(dailyBudget).replace(',', '.'));
        if (Number.isFinite(v) && v > 0) overrides.daily_budget = v;
      }
      if (ageMin) overrides.age_min = Number(ageMin);
      if (ageMax) overrides.age_max = Number(ageMax);

      const r = await fetch(`/api/campaigns/${campaignLocalId}/duplicate-adset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceAdSetId: adset.id, overrides }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      onSaved?.(data);
      onClose();
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Duplicar conjunto pra testar variação"
      footer={
        <>
          <GhostButton onClick={onClose} disabled={loading}>Cancelar</GhostButton>
          <PrimaryButton onClick={handleSave} disabled={loading}>
            {loading ? 'Duplicando...' : 'Duplicar conjunto'}
          </PrimaryButton>
        </>
      }
    >
      <Banner kind="info" title="Como funciona">
        O conjunto novo começa o aprendizado do zero. O conjunto original continua intacto rodando em paralelo. Use isto pra testar outro público sem perder o que já aprendeu.
      </Banner>

      <div style={{ marginTop: '16px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 700, color: '#15803D',
          background: '#F0FDF4', border: '1px solid #86EFAC',
          padding: '6px 10px', borderRadius: '6px', display: 'inline-block', marginBottom: '12px',
          letterSpacing: '.3px', textTransform: 'uppercase',
        }}>
          ✓ Edições seguras
        </div>

        <Field label="Nome do conjunto novo" hint="Renomeie pra identificar a variação (ex: 'Cravos — público amplo')">
          <TextInput value={name} onChange={e => setName(e.target.value)} />
        </Field>

        <Field label="Orçamento diário (R$)" hint="Pode ajustar livremente — conjunto novo já não tem aprendizado pra resetar.">
          <TextInput
            type="text"
            value={dailyBudget}
            onChange={e => setDailyBudget(e.target.value)}
            placeholder="Ex: 15,00"
          />
        </Field>

        <Field label="Faixa de idade" hint="Deixe vazio pra herdar do conjunto original.">
          <div style={{ display: 'flex', gap: '8px' }}>
            <TextInput
              type="number" min="13" max="65"
              value={ageMin}
              onChange={e => setAgeMin(e.target.value)}
              placeholder="Mín"
            />
            <TextInput
              type="number" min="13" max="65"
              value={ageMax}
              onChange={e => setAgeMax(e.target.value)}
              placeholder="Máx"
            />
          </div>
        </Field>

        <div style={{ marginTop: '8px', marginBottom: '12px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 600, color: 'var(--c-text-4)',
            padding: '6px 0',
          }}>
            Bairros e interesses específicos: edite pelo Meta Ads Manager depois (link no card do conjunto novo).
          </div>
        </div>

        {errMsg && <Banner kind="reset" title="Erro">{errMsg}</Banner>}
      </div>
    </Modal>
  );
}

/* ─── Modal: Criar anúncio novo no conjunto ─── */
function NewAdInAdSetModal({ open, onClose, adset, campaignLocalId, onSaved }) {
  const [adName, setAdName]   = useState('');
  const [message, setMessage] = useState('');
  const [title, setTitle]     = useState('');
  const [link, setLink]       = useState('');
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg]   = useState(null);

  useEffect(() => {
    if (!open) return;
    setAdName('Anúncio novo');
    setMessage(''); setTitle(''); setLink('');
    setErrMsg(null);
  }, [open]);

  async function handleSave() {
    setLoading(true); setErrMsg(null);
    try {
      const overrides = {};
      if (message) overrides.message = message;
      if (title) overrides.title = title;
      if (link) overrides.link = link;

      const r = await fetch(`/api/campaigns/${campaignLocalId}/adsets/${adset.id}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newAdName: adName || 'Anúncio novo',
          overrides: Object.keys(overrides).length > 0 ? overrides : null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      onSaved?.(data);
      onClose();
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar anúncio novo neste conjunto"
      footer={
        <>
          <GhostButton onClick={onClose} disabled={loading}>Cancelar</GhostButton>
          <PrimaryButton onClick={handleSave} disabled={loading} danger>
            {loading ? 'Criando...' : 'Criar anúncio (vai resetar aprendizado)'}
          </PrimaryButton>
        </>
      }
    >
      <Banner kind="reset" title="Atenção: vai resetar o aprendizado deste conjunto">
        Adicionar anúncio novo num conjunto que já está rodando reseta a fase de aprendizado (regra do Meta). Se o conjunto está performando bem, considere <strong>duplicar o conjunto</strong> em vez disso e testar lá.
      </Banner>

      <div style={{ marginTop: '16px' }}>
        <Field label="Nome do anúncio" hint="Pra você identificar depois.">
          <TextInput value={adName} onChange={e => setAdName(e.target.value)} />
        </Field>

        <Field label="Texto principal" hint="Deixe vazio pra reusar o texto do anúncio atual.">
          <TextInput value={message} onChange={e => setMessage(e.target.value)} placeholder="Ex: Adeus cravos! Limpeza profunda..." />
        </Field>

        <Field label="Título / Headline" hint="Deixe vazio pra reusar.">
          <TextInput value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: 3x R$ 60" />
        </Field>

        <Field label="Link de destino" hint="Use wa.me/55479XXXXXXXX?text=mensagem pra WhatsApp pré-preenchido. Vazio = reusa o link atual.">
          <TextInput value={link} onChange={e => setLink(e.target.value)} placeholder="https://wa.me/..." />
        </Field>

        {errMsg && <Banner kind="reset" title="Erro">{errMsg}</Banner>}

        <div style={{
          fontSize: '11px', color: 'var(--c-text-4)', marginTop: '8px', lineHeight: 1.5,
        }}>
          O anúncio novo será criado <strong>pausado</strong>. Após o Meta aprovar, você pode ativar manualmente.
        </div>
      </div>
    </Modal>
  );
}

/* ─── Card de Conjunto (AdSet) ─── */
function AdSetCard({ adset, campaignLocalId, onAction, onSelect, selected }) {
  const status = statusLabel(adset.effective_status || adset.status);
  const adsCount = adset.ads?.length || 0;

  return (
    <div
      onClick={() => onSelect?.(adset)}
      style={{
        background: 'var(--c-card-bg)',
        border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border-lt)'}`,
        borderRadius: '12px',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all .15s',
        boxShadow: selected ? '0 6px 16px rgba(214,141,143,.18)' : 'none',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--c-border)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--c-border-lt)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {adset.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '2px' }}>
            ID Meta: {adset.id}
          </div>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 700, color: '#fff',
          background: status.color,
          padding: '3px 8px', borderRadius: '999px', flexShrink: 0,
        }}>{status.txt}</span>
      </div>

      <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--c-text-3)', marginBottom: '10px' }}>
        <div>💰 {fmtBRL(adset.daily_budget)} /dia</div>
        <div>📢 {adsCount} {adsCount === 1 ? 'anúncio' : 'anúncios'}</div>
      </div>

      {adset.targeting && (
        <div style={{
          fontSize: '11px', color: 'var(--c-text-4)',
          background: 'var(--c-surface)', borderRadius: '8px',
          padding: '6px 10px', marginBottom: '10px', lineHeight: 1.5,
        }}>
          {adset.targeting.age_min && adset.targeting.age_max && (
            <span>👤 {adset.targeting.age_min}-{adset.targeting.age_max} anos</span>
          )}
          {Array.isArray(adset.targeting.interests) && adset.targeting.interests.length > 0 && (
            <span> · 🎯 {adset.targeting.interests.length} interesse{adset.targeting.interests.length > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          onClick={e => { e.stopPropagation(); onAction('duplicate', adset); }}
          style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            color: 'var(--c-text-2)', borderRadius: '7px',
            padding: '6px 10px', fontSize: '11.5px', fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Cria um conjunto novo idêntico — bom pra testar outro público"
        >
          📋 Duplicar conjunto
        </button>
        <button
          onClick={e => { e.stopPropagation(); onAction('budget', adset); }}
          style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            color: 'var(--c-text-2)', borderRadius: '7px',
            padding: '6px 10px', fontSize: '11.5px', fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Mude o orçamento até 20% sem resetar aprendizado"
        >
          💰 Editar orçamento
        </button>
        <button
          onClick={e => { e.stopPropagation(); onAction('newAd', adset); }}
          style={{
            background: 'transparent', border: '1px dashed #FCA5A5',
            color: '#B91C1C', borderRadius: '7px',
            padding: '6px 10px', fontSize: '11.5px', fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Cria anúncio novo neste conjunto (atenção: reseta aprendizado)"
        >
          + Anúncio novo ⚠
        </button>
      </div>
    </div>
  );
}

/* ─── Card de Anúncio (Ad) ─── */
function AdCard({ ad }) {
  const status = statusLabel(ad.effective_status || ad.status);
  return (
    <div style={{
      background: 'var(--c-card-bg)',
      border: '1px solid var(--c-border-lt)',
      borderRadius: '10px',
      padding: '10px 14px',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ad.name}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)' }}>ID: {ad.id}</div>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 700, color: '#fff',
          background: status.color,
          padding: '2px 7px', borderRadius: '999px',
        }}>{status.txt}</span>
      </div>
    </div>
  );
}

/* ─── Card de Campanha (lista esquerda) ─── */
function CampaignTile({ camp, selected, onSelect }) {
  const status = statusLabel(camp.status);
  return (
    <div
      onClick={() => onSelect(camp)}
      style={{
        padding: '12px 14px',
        background: selected ? 'var(--c-active-bg)' : 'var(--c-card-bg)',
        border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border-lt)'}`,
        borderRadius: '10px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'all .12s',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 700, color: selected ? 'var(--c-accent)' : 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
        {camp.name}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
          {fmtBRL(camp.budget)} /dia
        </span>
        <span style={{
          fontSize: '9.5px', fontWeight: 700, color: '#fff',
          background: status.color,
          padding: '2px 7px', borderRadius: '999px',
        }}>{status.txt}</span>
      </div>
    </div>
  );
}

/* ============================================================
   Página principal
   ============================================================ */
export default function CampaignsHierarchy() {
  const { ads } = useAppState();
  const [selectedCamp, setSelectedCamp] = useState(null);
  const [hierarchy, setHierarchy]       = useState(null);
  const [loadingHier, setLoadingHier]   = useState(false);
  const [errHier, setErrHier]           = useState(null);
  const [selectedAdSet, setSelectedAdSet] = useState(null);

  /* Modais */
  const [budgetModal, setBudgetModal]       = useState({ open: false, level: null, target: null, adsetId: null });
  const [duplicateModal, setDuplicateModal] = useState({ open: false, adset: null });
  const [newAdModal, setNewAdModal]         = useState({ open: false, adset: null });
  const [toast, setToast]                   = useState(null);

  /* Lista de campanhas Meta publicadas */
  const metaCamps = (ads || []).filter(a =>
    (a.platform === 'meta' || a.platform === 'instagram') && a.platform_campaign_id
  );

  const refreshHierarchy = useCallback(async (campLocalId) => {
    if (!campLocalId) return;
    setLoadingHier(true); setErrHier(null);
    try {
      const r = await fetch(`/api/campaigns/${campLocalId}/hierarchy`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setHierarchy(data);
      /* Mantém o adset selecionado se ele ainda existir */
      if (selectedAdSet) {
        const stillExists = data.adsets?.find(a => a.id === selectedAdSet.id);
        setSelectedAdSet(stillExists || null);
      }
    } catch (e) {
      setErrHier(e.message);
      setHierarchy(null);
    } finally {
      setLoadingHier(false);
    }
  }, [selectedAdSet]);

  useEffect(() => {
    if (selectedCamp?.id) refreshHierarchy(selectedCamp.id);
    else { setHierarchy(null); setSelectedAdSet(null); }
  }, [selectedCamp?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAdSetAction(kind, adset) {
    if (kind === 'duplicate') setDuplicateModal({ open: true, adset });
    else if (kind === 'newAd') setNewAdModal({ open: true, adset });
    else if (kind === 'budget') setBudgetModal({ open: true, level: 'adset', target: adset, adsetId: adset.id });
  }
  function handleSaved(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
    if (selectedCamp?.id) refreshHierarchy(selectedCamp.id);
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '.8px',
          color: 'var(--c-accent)', textTransform: 'uppercase', marginBottom: '4px',
        }}>
          Visão Meta · Beta
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>
          Campanha → Conjunto → Anúncio
        </h1>
        <div style={{ fontSize: '13px', color: 'var(--c-text-3)', marginTop: '4px' }}>
          Mesma estrutura que o Meta Ads Manager. Aqui você duplica conjuntos, cria anúncios novos e edita orçamentos com aviso visual quando algo reseta o aprendizado.
        </div>
      </div>

      {/* Aviso geral */}
      <div style={{ marginBottom: '20px' }}>
        <Banner kind="info" title="Como funciona o aprendizado">
          O Meta precisa de cerca de <strong>50 conversões em 7 dias por conjunto</strong> pra calibrar a entrega. Edições "pesadas" (público, criativo, evento de otimização) zeram esse contador. Aqui o sistema te avisa <span style={{ color: '#15803D', fontWeight: 700 }}>verde ✓</span> ou <span style={{ color: '#B91C1C', fontWeight: 700 }}>vermelho ⚠</span> antes de cada ação.
        </Banner>
      </div>

      {metaCamps.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: 'var(--c-card-bg)',
          border: '1px dashed var(--c-border)',
          borderRadius: '14px',
          color: 'var(--c-text-3)',
        }}>
          <div style={{ fontSize: '34px', marginBottom: '8px' }}>📭</div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Nenhuma campanha Meta publicada ainda</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Publique pelo menos uma campanha em "Criar anúncio" pra ver a hierarquia aqui.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'flex-start' }}>
          {/* Coluna esquerda: lista campanhas */}
          <div>
            <div style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '.6px',
              color: 'var(--c-text-4)', textTransform: 'uppercase', marginBottom: '8px',
              padding: '0 4px',
            }}>
              Campanhas Meta ({metaCamps.length})
            </div>
            {metaCamps.map(c => (
              <CampaignTile
                key={c.id}
                camp={c}
                selected={selectedCamp?.id === c.id}
                onSelect={setSelectedCamp}
              />
            ))}
          </div>

          {/* Coluna direita: hierarquia da campanha selecionada */}
          <div>
            {!selectedCamp ? (
              <div style={{
                padding: '40px', textAlign: 'center',
                background: 'var(--c-card-bg)',
                border: '1px dashed var(--c-border)', borderRadius: '14px',
                color: 'var(--c-text-3)',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👈</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Selecione uma campanha</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Clica numa campanha à esquerda pra ver os conjuntos e anúncios.</div>
              </div>
            ) : loadingHier ? (
              <div style={{
                padding: '40px', textAlign: 'center', color: 'var(--c-text-3)',
              }}>
                Carregando hierarquia direto do Meta...
              </div>
            ) : errHier ? (
              <Banner kind="reset" title="Erro ao carregar">{errHier}</Banner>
            ) : hierarchy ? (
              <>
                {/* Breadcrumb */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '12px', color: 'var(--c-text-4)', marginBottom: '14px',
                }}>
                  <span>{hierarchy.campaign?.name}</span>
                  {selectedAdSet && (
                    <>
                      <span>›</span>
                      <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>{selectedAdSet.name}</span>
                    </>
                  )}
                </div>

                {/* Resumo da campanha + ação */}
                <div style={{
                  background: 'var(--c-card-bg)',
                  border: '1px solid var(--c-border-lt)',
                  borderRadius: '12px', padding: '14px 16px', marginBottom: '16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                        {hierarchy.campaign?.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--c-text-3)', marginTop: '4px' }}>
                        Objetivo: {hierarchy.campaign?.objective || '—'} · {fmtBRL(hierarchy.campaign?.daily_budget)} /dia
                      </div>
                    </div>
                    {hierarchy.campaign?.daily_budget != null && (
                      <button
                        onClick={() => setBudgetModal({
                          open: true, level: 'campaign',
                          target: { daily_budget: hierarchy.campaign.daily_budget },
                          adsetId: null,
                        })}
                        style={{
                          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                          color: 'var(--c-text-2)', borderRadius: '8px',
                          padding: '7px 12px', fontSize: '12px', fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        💰 Editar orçamento
                      </button>
                    )}
                  </div>
                </div>

                {/* Conjuntos */}
                <div style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '.6px',
                  color: 'var(--c-text-4)', textTransform: 'uppercase', marginBottom: '8px',
                  padding: '0 4px',
                }}>
                  Conjuntos ({hierarchy.adsets?.length || 0})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(hierarchy.adsets || []).map(as => (
                    <AdSetCard
                      key={as.id}
                      adset={as}
                      campaignLocalId={selectedCamp.id}
                      onAction={handleAdSetAction}
                      onSelect={setSelectedAdSet}
                      selected={selectedAdSet?.id === as.id}
                    />
                  ))}
                </div>

                {/* Anúncios do conjunto selecionado */}
                {selectedAdSet && (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{
                      fontSize: '11px', fontWeight: 700, letterSpacing: '.6px',
                      color: 'var(--c-text-4)', textTransform: 'uppercase', marginBottom: '8px',
                      padding: '0 4px',
                    }}>
                      Anúncios em "{selectedAdSet.name}" ({selectedAdSet.ads?.length || 0})
                    </div>
                    {(selectedAdSet.ads || []).length === 0 ? (
                      <div style={{ padding: '14px', fontSize: '12px', color: 'var(--c-text-4)' }}>
                        Nenhum anúncio neste conjunto.
                      </div>
                    ) : (
                      selectedAdSet.ads.map(ad => <AdCard key={ad.id} ad={ad} />)
                    )}
                  </div>
                )}

                <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '14px', textAlign: 'right' }}>
                  Atualizado em: {new Date(hierarchy.fetched_at).toLocaleString('pt-BR')}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: '#15803D', color: '#fff',
          padding: '12px 18px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,.2)',
          zIndex: 1100, maxWidth: '400px',
        }}>
          ✓ {toast.note || 'Pronto'}
        </div>
      )}

      {/* Modais */}
      <BudgetEditModal
        open={budgetModal.open}
        onClose={() => setBudgetModal({ open: false, level: null, target: null, adsetId: null })}
        level={budgetModal.level}
        target={budgetModal.target}
        adsetId={budgetModal.adsetId}
        campaignLocalId={selectedCamp?.id}
        onSaved={handleSaved}
      />
      <DuplicateAdSetModal
        open={duplicateModal.open}
        onClose={() => setDuplicateModal({ open: false, adset: null })}
        adset={duplicateModal.adset}
        campaignLocalId={selectedCamp?.id}
        onSaved={handleSaved}
      />
      <NewAdInAdSetModal
        open={newAdModal.open}
        onClose={() => setNewAdModal({ open: false, adset: null })}
        adset={newAdModal.adset}
        campaignLocalId={selectedCamp?.id}
        onSaved={handleSaved}
      />
    </div>
  );
}
