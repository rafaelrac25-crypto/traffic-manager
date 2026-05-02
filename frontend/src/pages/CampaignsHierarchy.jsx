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
/* Link pro Meta Ads Manager focando direto no recurso clicado.
   Mesmo padrão usado em /anuncios — colunas customizadas pra Cris. */
function metaAdsManagerUrl({ campaignId, adsetId, adId } = {}) {
  const base = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1330468201431069&business_id=468086242175775&global_scope_id=468086242175775&columns=name%2Cdelivery%2Crecommendations_guidance%2Cresults%2Ccost_per_result%2Cbudget%2Cspend%2Cimpressions%2Creach%2Cactions%3Aonsite_conversion.total_messaging_connection%2Cactions%3Aonsite_conversion.messaging_first_reply%2Cschedule%2Cend_time%2Cattribution_setting&attribution_windows=default';
  const isValid = (v) => v && /^\d{6,}$/.test(String(v));
  let url = base;
  if (isValid(campaignId)) url += `&selected_campaign_ids=${campaignId}`;
  if (isValid(adsetId))    url += `&selected_adset_ids=${adsetId}`;
  if (isValid(adId))       url += `&selected_ad_ids=${adId}`;
  return url;
}
function MetaLinkButton({ campaignId, adsetId, adId, label = 'Abrir no Meta', size = 'sm', variant = 'outline' }) {
  const url = metaAdsManagerUrl({ campaignId, adsetId, adId });
  const FS = size === 'lg' ? '12px' : '11px';
  const PAD = size === 'lg' ? '7px 12px' : '5px 9px';
  const styles = variant === 'solid' ? {
    background: '#1877F2', color: '#fff', border: 'none',
  } : {
    background: 'transparent', color: '#1877F2', border: '1px solid #1877F2',
  };
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Abrir este recurso direto no Meta Ads Manager"
      style={{
        ...styles,
        borderRadius: '7px',
        padding: PAD,
        fontSize: FS,
        fontWeight: 600,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap',
      }}
    >
      ↗ {label}
    </a>
  );
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
          <PrimaryButton onClick={handleSave} disabled={loading}>
            {loading ? 'Criando...' : 'Criar anúncio'}
          </PrimaryButton>
        </>
      }
    >

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

/* ─── Toggle/Play visual reutilizável ─── */
function PlayPauseButton({ status, onToggle, disabled, size = 'sm' }) {
  const isActive = status === 'ACTIVE';
  const W = size === 'lg' ? 32 : 26;
  const FS = size === 'lg' ? '14px' : '11.5px';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle?.(!isActive); }}
      disabled={disabled}
      title={isActive ? 'Pausar' : 'Ativar'}
      style={{
        width: W, height: W,
        borderRadius: '50%',
        border: 'none',
        background: isActive ? '#22C55E' : '#9CA3AF',
        color: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: FS,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
        transition: 'transform .12s, box-shadow .12s, background .15s',
        boxShadow: isActive ? '0 2px 6px rgba(34,197,94,.35)' : 'none',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'scale(1.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {isActive ? '⏸' : '▶'}
    </button>
  );
}

/* ─── Card de Conjunto (AdSet) ─── */
function AdSetCard({ adset, campaignLocalId, onAction, onSelect, selected, onStatusChange, onAdvantageToggle, busy }) {
  const status = statusLabel(adset.effective_status || adset.status);
  const adsCount = adset.ads?.length || 0;
  const advantageOn = adset.targeting?.targeting_automation?.advantage_audience === 1;

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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <PlayPauseButton
            status={adset.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'}
            onToggle={(toActive) => onStatusChange?.(adset, toActive ? 'active' : 'paused')}
            disabled={busy}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {adset.name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '2px' }}>
              ID: {adset.id}
            </div>
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

      {/* Toggle Advantage+ Público */}
      <div
        onClick={(e) => { e.stopPropagation(); onAdvantageToggle?.(adset, !advantageOn); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 10px',
          background: advantageOn ? '#FFFBEB' : 'var(--c-surface)',
          border: `1px solid ${advantageOn ? '#FCD34D' : 'var(--c-border-lt)'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '10px',
          transition: 'all .15s',
        }}
        title={advantageOn
          ? 'Advantage+ ligado: Meta pode expandir o público fora dos bairros configurados'
          : 'Clique pra deixar o Meta otimizar o público automaticamente'}
      >
        <div style={{
          width: '32px', height: '18px',
          borderRadius: '20px',
          background: advantageOn ? '#F59E0B' : 'var(--c-border)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background .2s',
        }}>
          <div style={{
            position: 'absolute',
            width: '14px', height: '14px',
            background: '#fff',
            borderRadius: '50%',
            top: '2px',
            left: advantageOn ? '16px' : '2px',
            transition: 'left .2s',
            boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: advantageOn ? '#92400E' : 'var(--c-text-2)' }}>
            Advantage+ Público {advantageOn ? '· LIGADO' : ''}
          </div>
          <div style={{ fontSize: '10px', color: advantageOn ? '#B45309' : 'var(--c-text-4)', marginTop: '1px' }}>
            {advantageOn
              ? 'Meta pode expandir além de Joinville pra achar conversões'
              : 'Meta otimiza o público sozinho (pode entregar fora de Joinville)'}
          </div>
        </div>
      </div>

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
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            color: 'var(--c-text-2)', borderRadius: '7px',
            padding: '6px 10px', fontSize: '11.5px', fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Cria anúncio novo neste conjunto"
        >
          + Anúncio novo
        </button>
        <MetaLinkButton adsetId={adset.id} label="Abrir no Meta" />
        <button
          onClick={e => { e.stopPropagation(); onAction('delete', adset); }}
          style={{
            background: 'transparent', border: '1px solid #FCA5A5',
            color: '#B91C1C', borderRadius: '7px',
            padding: '6px 10px', fontSize: '11.5px', fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Excluir este conjunto e seus anúncios"
        >
          🗑️ Excluir
        </button>
      </div>
    </div>
  );
}

/* ─── Card de Anúncio (Ad) ─── */
function AdCard({ ad, onStatusChange, onDelete, busy }) {
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
        <PlayPauseButton
          status={ad.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'}
          onToggle={(toActive) => onStatusChange?.(ad, toActive ? 'active' : 'paused')}
          disabled={busy}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ad.name}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)' }}>ID: {ad.id}</div>
        </div>
        <MetaLinkButton adId={ad.id} label="Meta" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(ad); }}
          disabled={busy}
          title="Excluir este anúncio"
          style={{
            background: 'transparent', border: '1px solid #FCA5A5',
            color: '#B91C1C', borderRadius: '6px',
            padding: '4px 8px', fontSize: '11px', fontWeight: 600,
            cursor: 'pointer', opacity: busy ? 0.5 : 1,
          }}
        >🗑️</button>
        <span style={{
          fontSize: '10px', fontWeight: 700, color: '#fff',
          background: status.color,
          padding: '2px 7px', borderRadius: '999px',
        }}>{status.txt}</span>
      </div>
    </div>
  );
}

/* ─── Modal: Criar Teste A/B ─── */
function CreateABTestModal({ open, onClose, campaign, hierarchy, onSaved }) {
  const [variable, setVariable]       = useState('audience');
  const [sourceAdSetId, setSourceAdSet] = useState('');
  const [duration, setDuration]       = useState(7);
  const [splitA, setSplitA]           = useState(50);
  const [variantAgeMin, setVariantAgeMin] = useState('');
  const [variantAgeMax, setVariantAgeMax] = useState('');
  const [variantPlacements, setVariantPlacements] = useState('reels-only');
  const [autoPauseLoser, setAutoPauseLoser] = useState(true);
  const [loading, setLoading]         = useState(false);
  const [errMsg, setErrMsg]           = useState(null);

  useEffect(() => {
    if (!open) return;
    if (hierarchy?.adsets?.[0]) setSourceAdSet(hierarchy.adsets[0].id);
    setErrMsg(null);
    setVariable('audience');
    setDuration(7);
    setSplitA(50);
    setAutoPauseLoser(true);
  }, [open, hierarchy]);

  const campaignActive = hierarchy?.campaign?.status === 'ACTIVE';

  async function handleSave() {
    setLoading(true); setErrMsg(null);
    try {
      const variantOverrides = {};
      if (variable === 'audience') {
        if (variantAgeMin) variantOverrides.age_min = Number(variantAgeMin);
        if (variantAgeMax) variantOverrides.age_max = Number(variantAgeMax);
      } else if (variable === 'placement') {
        if (variantPlacements === 'reels-only') {
          variantOverrides.publisher_platforms = ['instagram'];
          variantOverrides.instagram_positions = ['reels'];
        } else if (variantPlacements === 'feed-only') {
          variantOverrides.publisher_platforms = ['instagram', 'facebook'];
          variantOverrides.instagram_positions = ['stream'];
          variantOverrides.facebook_positions = ['feed'];
        } else if (variantPlacements === 'stories-only') {
          variantOverrides.publisher_platforms = ['instagram', 'facebook'];
          variantOverrides.instagram_positions = ['story'];
          variantOverrides.facebook_positions = ['story'];
        }
      }

      const r = await fetch(`/api/campaigns/${campaign.id}/ab-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variable,
          sourceAdSetId,
          durationDays: Number(duration),
          splitPercent: Number(splitA),
          variantOverrides,
          autoPauseLoser,
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
      title="🧪 Criar teste A/B"
      footer={
        <>
          <GhostButton onClick={onClose} disabled={loading}>Cancelar</GhostButton>
          <PrimaryButton onClick={handleSave} disabled={loading || !sourceAdSetId || !campaignActive}>
            {loading ? 'Criando teste...' : 'Criar teste A/B'}
          </PrimaryButton>
        </>
      }
    >
      {!campaignActive && (
        <Banner kind="reset" title="Campanha precisa estar ativa">
          O Meta só aceita criar teste A/B em campanhas que estão rodando. Ative a campanha primeiro.
        </Banner>
      )}

      <div style={{ marginTop: '14px' }}>
        <Banner kind="info" title="Como funciona">
          O Meta divide o público em 2 grupos sem sobreposição (cada pessoa só vê 1 dos 2 conjuntos). Mais limpo que duplicar manual. Duração mínima é 4 dias por exigência do Meta.
        </Banner>
      </div>

      <div style={{ marginTop: '16px' }}>
        <Field label="O que você quer testar?">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { v: 'audience', label: '👤 Público', desc: 'Idade ou interesses diferentes' },
              { v: 'placement', label: '📱 Posicionamento', desc: 'Reels, Feed, Stories' },
              { v: 'creative', label: '🎬 Criativo', desc: 'Mesmo público, vídeos diferentes' },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => setVariable(opt.v)}
                style={{
                  flex: '1 1 30%',
                  padding: '10px 12px',
                  border: `1.5px solid ${variable === opt.v ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  background: variable === opt.v ? 'var(--c-active-bg)' : 'var(--c-surface)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: variable === opt.v ? 'var(--c-accent)' : 'var(--c-text-1)' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '3px' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Conjunto base (controle)" hint="O conjunto que serve de referência. Sistema duplica e cria a variante.">
          <select
            value={sourceAdSetId}
            onChange={(e) => setSourceAdSet(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px',
              border: '1.5px solid var(--c-border)',
              borderRadius: '9px', fontSize: '13px',
              background: 'var(--c-surface)', color: 'var(--c-text-1)',
            }}
          >
            {(hierarchy?.adsets || []).map(as => (
              <option key={as.id} value={as.id}>
                {as.name} — {as.status}
              </option>
            ))}
          </select>
        </Field>

        {variable === 'audience' && (
          <Field label="Variante: nova faixa de idade" hint="Será aplicada na cópia do conjunto. Deixe vazio pra herdar.">
            <div style={{ display: 'flex', gap: '8px' }}>
              <TextInput type="number" min="13" max="65" value={variantAgeMin}
                onChange={e => setVariantAgeMin(e.target.value)} placeholder="Mín" />
              <TextInput type="number" min="13" max="65" value={variantAgeMax}
                onChange={e => setVariantAgeMax(e.target.value)} placeholder="Máx" />
            </div>
          </Field>
        )}

        {variable === 'placement' && (
          <Field label="Variante: posicionamento" hint="O conjunto base mantém o atual. A variante usa esse novo.">
            <select
              value={variantPlacements}
              onChange={(e) => setVariantPlacements(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px',
                border: '1.5px solid var(--c-border)',
                borderRadius: '9px', fontSize: '13px',
                background: 'var(--c-surface)', color: 'var(--c-text-1)',
              }}
            >
              <option value="reels-only">Só Reels (Instagram)</option>
              <option value="feed-only">Só Feed (Instagram + Facebook)</option>
              <option value="stories-only">Só Stories (Instagram + Facebook)</option>
            </select>
          </Field>
        )}

        {variable === 'creative' && (
          <Banner kind="info">
            Sistema vai duplicar o conjunto. Depois de criar o teste, edite o anúncio do conjunto variante pra colocar o criativo novo.
          </Banner>
        )}

        <Field label={`Duração: ${duration} dias`} hint="Mínimo 4, máximo 30. Recomendado 7-14 pra dar significância estatística.">
          <input
            type="range" min="4" max="30" value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </Field>

        <Field label={`Divisão: ${splitA}% controle / ${100 - splitA}% variante`} hint="Recomendado 50/50.">
          <input
            type="range" min="10" max="90" step="10" value={splitA}
            onChange={(e) => setSplitA(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </Field>

        <label
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '10px 12px',
            background: autoPauseLoser ? '#F0FDF4' : 'var(--c-surface)',
            border: `1px solid ${autoPauseLoser ? '#86EFAC' : 'var(--c-border-lt)'}`,
            borderRadius: '10px', cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          <input
            type="checkbox"
            checked={autoPauseLoser}
            onChange={(e) => setAutoPauseLoser(e.target.checked)}
            style={{ marginTop: '2px', flexShrink: 0, accentColor: '#15803D' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: autoPauseLoser ? '#15803D' : 'var(--c-text-2)' }}>
              Pausar o perdedor automaticamente quando o teste terminar
            </div>
            <div style={{ fontSize: '11px', color: autoPauseLoser ? '#166534' : 'var(--c-text-4)', marginTop: '3px', lineHeight: 1.5 }}>
              No fim do teste, o sistema compara as métricas (custo por mensagem ou CPC), pausa o conjunto pior e te avisa no sino. Se diferença for menor que 5%, considera empate e não pausa nenhum.
            </div>
          </div>
        </label>

        {errMsg && <Banner kind="reset" title="Erro">{errMsg}</Banner>}
      </div>
    </Modal>
  );
}

/* ─── Card de Teste A/B em andamento ─── */
function ABTestCard({ test, onStop }) {
  const now = Math.floor(Date.now() / 1000);
  const totalDur = test.end_time - test.start_time;
  const elapsed = Math.max(0, Math.min(totalDur, now - test.start_time));
  const pct = totalDur > 0 ? Math.round((elapsed / totalDur) * 100) : 0;
  const isFinished = now >= test.end_time;
  const liveStatus = test.live?.status || (isFinished ? 'COMPLETED' : 'RUNNING');

  return (
    <div style={{
      background: 'var(--c-card-bg)',
      border: '1.5px solid var(--c-border-lt)',
      borderRadius: '12px',
      padding: '14px 16px',
      marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-accent)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '2px' }}>
            🧪 Teste A/B · {test.variable}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {test.name}
          </div>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 700, color: '#fff',
          background: isFinished ? '#22C55E' : '#F59E0B',
          padding: '3px 8px', borderRadius: '999px',
        }}>{isFinished ? 'Finalizado' : liveStatus}</span>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{
          height: '8px', background: 'var(--c-surface)', borderRadius: '4px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: isFinished ? '#22C55E' : 'var(--c-accent)',
            transition: 'width .3s',
          }} />
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '4px' }}>
          {Math.floor(elapsed / 86400)} de {Math.floor(totalDur / 86400)} dias · {pct}%
        </div>
      </div>

      <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', marginBottom: '8px' }}>
        Controle (A): {test.split_percent_a}% · Variante (B): {100 - test.split_percent_a}%
      </div>

      {!isFinished && (
        <button
          onClick={() => onStop?.(test)}
          style={{
            background: 'transparent', border: '1px solid var(--c-border)',
            color: 'var(--c-text-3)', borderRadius: '7px',
            padding: '5px 10px', fontSize: '11px', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Encerrar antes
        </button>
      )}
      {test.live_error && (
        <div style={{ fontSize: '10.5px', color: '#B91C1C', marginTop: '6px' }}>
          Erro ao ler do Meta: {test.live_error}
        </div>
      )}
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
  const { ads, addNotification } = useAppState();
  const [selectedCamp, setSelectedCamp] = useState(null);
  const [hierarchy, setHierarchy]       = useState(null);
  const [loadingHier, setLoadingHier]   = useState(false);
  const [errHier, setErrHier]           = useState(null);
  const [selectedAdSet, setSelectedAdSet] = useState(null);

  /* Modais */
  const [budgetModal, setBudgetModal]       = useState({ open: false, level: null, target: null, adsetId: null });
  const [duplicateModal, setDuplicateModal] = useState({ open: false, adset: null });
  const [newAdModal, setNewAdModal]         = useState({ open: false, adset: null });
  const [abTestModal, setABTestModal]       = useState(false);
  const [toast, setToast]                   = useState(null);
  const [errToast, setErrToast]             = useState(null);

  /* IDs em ação (play/pause/advantage) — desativa botão durante request */
  const [busyIds, setBusyIds] = useState(() => new Set());
  function markBusy(id, on) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  /* A/B tests da campanha selecionada */
  const [abTests, setABTests] = useState([]);

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
    else if (kind === 'delete') handleDeleteAdSet(adset);
  }

  async function handleDeleteAdSet(adset) {
    const adsCount = adset.ads?.length || 0;
    const msg = `EXCLUIR conjunto "${adset.name}"?\n\nIsso vai apagar TAMBÉM ${adsCount} anúncio(s) dentro dele, sem volta.\n\nDigite "EXCLUIR" pra confirmar.`;
    const confirm1 = window.prompt(msg);
    if (confirm1 !== 'EXCLUIR') return;
    markBusy(adset.id, true);
    try {
      const r = await fetch(`/api/campaigns/adsets/${adset.id}`, { method: 'DELETE' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      handleSaved({ note: data.note || 'Conjunto excluído' });
    } catch (e) {
      showError(`Falha ao excluir conjunto: ${e.message}`);
    } finally {
      markBusy(adset.id, false);
    }
  }
  async function handleDeleteAd(ad) {
    const ok = window.confirm(`Excluir o anúncio "${ad.name}"?\n\nVai apagar do Meta sem volta.`);
    if (!ok) return;
    markBusy(ad.id, true);
    try {
      const r = await fetch(`/api/campaigns/ads/${ad.id}`, { method: 'DELETE' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      handleSaved({ note: data.note || 'Anúncio excluído' });
    } catch (e) {
      showError(`Falha ao excluir anúncio: ${e.message}`);
    } finally {
      markBusy(ad.id, false);
    }
  }
  function handleSaved(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
    if (selectedCamp?.id) {
      refreshHierarchy(selectedCamp.id);
      refreshABTests(selectedCamp.id);
    }
  }
  function showError(msg) {
    setErrToast(msg);
    setTimeout(() => setErrToast(null), 6000);
  }

  async function handleAdSetStatus(adset, newStatus) {
    if (busyIds.has(adset.id)) return;
    if (newStatus === 'paused') {
      const ok = window.confirm(`Pausar o conjunto "${adset.name}"?\n\nO conjunto vai parar de entregar até você reativar.`);
      if (!ok) return;
    }
    markBusy(adset.id, true);
    try {
      const r = await fetch(`/api/campaigns/adsets/${adset.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      handleSaved({ note: data.warning || `Conjunto ${newStatus === 'active' ? 'ativado' : 'pausado'}` });
    } catch (e) {
      showError(`Falha ao mudar status do conjunto: ${e.message}`);
    } finally {
      markBusy(adset.id, false);
    }
  }

  async function handleAdStatus(ad, newStatus) {
    if (busyIds.has(ad.id)) return;
    if (newStatus === 'paused') {
      const ok = window.confirm(`Pausar o anúncio "${ad.name}"?`);
      if (!ok) return;
    }
    markBusy(ad.id, true);
    try {
      const r = await fetch(`/api/campaigns/ads/${ad.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      handleSaved({ note: data.warning || `Anúncio ${newStatus === 'active' ? 'ativado' : 'pausado'}` });
    } catch (e) {
      showError(`Falha ao mudar status do anúncio: ${e.message}`);
    } finally {
      markBusy(ad.id, false);
    }
  }

  async function handleAdvantageToggle(adset, enabled) {
    if (busyIds.has(adset.id)) return;
    const msg = enabled
      ? `Ligar Advantage+ Público no conjunto "${adset.name}"?\n\n⚠ Atenção:\n- Pode entregar fora dos bairros que você configurou\n- Vai resetar o aprendizado do conjunto\n\nContinuar?`
      : `Desligar Advantage+ Público no conjunto "${adset.name}"?\n\nVai voltar ao targeting estrito (só seus bairros). O aprendizado também reseta.\n\nContinuar?`;
    const ok = window.confirm(msg);
    if (!ok) return;
    markBusy(adset.id, true);
    try {
      const r = await fetch(`/api/campaigns/${selectedCamp.id}/adsets/${adset.id}/advantage-audience`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      handleSaved({ note: data.note || (enabled ? 'Advantage+ ligado' : 'Advantage+ desligado') });
    } catch (e) {
      showError(`Falha ao alterar Advantage+: ${e.message}`);
    } finally {
      markBusy(adset.id, false);
    }
  }

  async function refreshABTests(campLocalId) {
    if (!campLocalId) { setABTests([]); return; }
    try {
      const r = await fetch(`/api/campaigns/${campLocalId}/ab-tests`);
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        const tests = data?.tests || [];
        setABTests(tests);
        /* Auto-finalize: pra cada teste com end_time vencido e ainda não finalizado, dispara finalize */
        const nowSec = Math.floor(Date.now() / 1000);
        const expired = tests.filter(t => !t.finalized && t.end_time <= nowSec);
        for (const t of expired) {
          try {
            const fr = await fetch(`/api/campaigns/${campLocalId}/ab-tests/${t.study_id}/finalize`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ autoPauseLoser: true }),
            });
            const fd = await fr.json().catch(() => ({}));
            if (fr.ok && fd.notification && !fd.already_finalized) {
              addNotification?.({
                kind: 'info',
                title: fd.notification.title,
                message: fd.notification.message,
                link: '/campanhas-v2',
              });
            }
          } catch (e) {
            console.warn('[ab-test auto-finalize] erro:', e.message);
          }
        }
        if (expired.length > 0) {
          /* Refresh outra vez pra refletir resultado finalizado nos cards */
          setTimeout(() => refreshABTests(campLocalId), 500);
        }
      }
    } catch {}
  }
  useEffect(() => {
    if (selectedCamp?.id) refreshABTests(selectedCamp.id);
    else setABTests([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamp?.id]);

  async function handleStopABTest(test) {
    const ok = window.confirm(`Encerrar o teste A/B "${test.name}" agora?\n\nResultados parciais ficam disponíveis no Meta.`);
    if (!ok) return;
    try {
      const r = await fetch(`/api/campaigns/ab-tests/${test.study_id}/stop`, { method: 'POST' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      handleSaved({ note: 'Teste A/B encerrado' });
    } catch (e) {
      showError(`Falha ao encerrar teste: ${e.message}`);
    }
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
        <Banner kind="info" title="Dica rápida">
          Mexer no orçamento até <strong>20%</strong> é a única edição que não zera o aprendizado do conjunto. Pra testar outro público ou criativo, prefira <strong>duplicar</strong> em vez de editar.
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
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <MetaLinkButton
                        campaignId={hierarchy.campaign?.platform_id}
                        size="lg"
                      />
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
                      <button
                        onClick={() => setABTestModal(true)}
                        style={{
                          background: 'var(--c-accent)', border: 'none',
                          color: '#fff', borderRadius: '8px',
                          padding: '7px 12px', fontSize: '12px', fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(214,141,143,.25)',
                        }}
                        title="Cria teste A/B oficial Meta com divisão automática de público"
                      >
                        🧪 Criar teste A/B
                      </button>
                    </div>
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
                      onStatusChange={handleAdSetStatus}
                      onAdvantageToggle={handleAdvantageToggle}
                      busy={busyIds.has(as.id)}
                    />
                  ))}
                </div>

                {/* A/B tests dessa campanha */}
                {abTests.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{
                      fontSize: '11px', fontWeight: 700, letterSpacing: '.6px',
                      color: 'var(--c-text-4)', textTransform: 'uppercase', marginBottom: '8px',
                      padding: '0 4px',
                    }}>
                      Testes A/B ({abTests.length})
                    </div>
                    {abTests.map(t => (
                      <ABTestCard key={t.study_id} test={t} onStop={handleStopABTest} />
                    ))}
                  </div>
                )}

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
                      selectedAdSet.ads.map(ad => (
                        <AdCard key={ad.id} ad={ad}
                          onStatusChange={handleAdStatus}
                          onDelete={handleDeleteAd}
                          busy={busyIds.has(ad.id)} />
                      ))
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
      <CreateABTestModal
        open={abTestModal}
        onClose={() => setABTestModal(false)}
        campaign={selectedCamp}
        hierarchy={hierarchy}
        onSaved={(d) => { handleSaved({ note: 'Teste A/B criado com sucesso' }); }}
      />

      {errToast && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: '#B91C1C', color: '#fff',
          padding: '12px 18px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,.2)',
          zIndex: 1100, maxWidth: '420px',
        }}>
          ⚠ {errToast}
        </div>
      )}
    </div>
  );
}
