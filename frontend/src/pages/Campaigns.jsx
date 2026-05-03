/**
 * IMPORTANT:
 * All displayed data is fictional placeholder data.
 * Real data will be loaded later from Meta Ads API.
 * Do not persist mock values.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';
import { updateAdTargeting, searchInterests } from '../services/adsApi';
import Icon from '../components/Icon';


/* ── Configurações visuais ── */
const PLAT = {
  instagram: { label: 'Instagram', bg: 'var(--c-accent-soft)', color: 'var(--c-accent)' },
  meta:      { label: 'Meta Ads',  bg: 'rgba(59,130,246,.16)', color: '#60A5FA' },
  google:    { label: 'Google Ads', bg: 'rgba(251,191,36,.16)', color: '#FBBF24' },
};

const STATUS = {
  active:  { label: 'Ativo',       dot: '#22C55E', bg: 'rgba(52,211,153,.16)', color: '#34D399' },
  paused:  { label: 'Pausado',     dot: '#F97316', bg: 'rgba(251,191,36,.16)', color: '#FBBF24' },
  review:  { label: 'Em revisão',  dot: '#8B5CF6', bg: 'rgba(139,92,246,.16)', color: '#A78BFA' },
  draft:   { label: 'Rascunho',    dot: '#94A3B8', bg: 'rgba(148,163,184,.16)', color: 'var(--c-text-3)' },
  ended:   { label: 'Inativo',     dot: '#94A3B8', bg: 'var(--c-surface)', color: 'var(--c-text-4)' },
};

/* Estado efetivo vindo do Meta — qual o REAL status de entrega.
   O Meta retorna effective_status via Graph API (sync-meta-status a cada 90s). */
const DELIVERY_STATUS = {
  ACTIVE:               { label: '🟢 Entregando',      color: '#34D399', bg: 'rgba(52,211,153,.16)', help: 'Ad está rodando e gastando orçamento no Meta.' },
  PAUSED:               { label: '⏸️ Pausado no Meta',  color: '#FBBF24', bg: 'rgba(251,191,36,.16)', help: 'Pausado — não está entregando.' },
  PENDING_REVIEW:       { label: '🟡 Aguardando Meta',  color: '#FBBF24', bg: 'rgba(251,191,36,.16)', help: 'Meta ainda está analisando o ad. Não entrega até aprovar (pode levar até 24h).' },
  PREAPPROVED:          { label: '🟡 Quase liberado',   color: '#FBBF24', bg: 'rgba(251,191,36,.16)', help: 'Aprovação preliminar do Meta — entrega em breve.' },
  WITH_ISSUES:          { label: '🔴 Com problema',     color: '#F87171', bg: 'rgba(248,113,113,.16)', help: 'Meta detectou algo que impede a entrega. Veja detalhes no Ads Manager.' },
  DISAPPROVED:          { label: '🔴 Reprovado',        color: '#F87171', bg: 'rgba(248,113,113,.16)', help: 'Meta rejeitou o ad.' },
  CAMPAIGN_PAUSED:      { label: '⏸️ Campanha pausada', color: '#FBBF24', bg: 'rgba(251,191,36,.16)', help: 'A campanha inteira foi pausada.' },
  ADSET_PAUSED:         { label: '⏸️ Conjunto pausado', color: '#FBBF24', bg: 'rgba(251,191,36,.16)', help: 'O ad set (anel) específico está pausado.' },
  PENDING_BILLING_INFO: { label: '💳 Aguardando pagto', color: '#FBBF24', bg: 'rgba(251,191,36,.16)', help: 'Problema no método de pagamento — resolva no Ads Manager.' },
  IN_PROCESS:           { label: '⏳ Processando',       color: 'var(--c-text-3)', bg: 'var(--c-surface)', help: 'Meta está processando o ad.' },
  ARCHIVED:             { label: '📦 Arquivado',        color: 'var(--c-text-4)', bg: 'var(--c-surface)', help: 'Campanha arquivada no Meta.' },
  DELETED:              { label: '🗑️ Deletado no Meta', color: 'var(--c-text-4)', bg: 'var(--c-surface)', help: 'Campanha foi deletada no Meta.' },
};

/* ── Ícones ── */
const PauseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
);
const PlayIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
  </svg>
);
const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
);
const CalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

/* ── Thumbnail (miniatura do criativo) ── */
function AdThumb({ ad }) {
  const grad = ad.thumbGrad || 'linear-gradient(135deg,#FECDD3,#FDA4AF,#FB7185)';
  const format = ad.adFormat || ad.format;
  const mediaUrl = ad.mediaFiles?.[0]?.url || ad.mediaUrl;
  const FORMAT_ICON_NAME = {
    reels: 'video', stories: 'phone', carousel: 'refresh', video: 'play', image: 'image',
  };
  const iconName = FORMAT_ICON_NAME[format] || 'sparkles';

  return (
    <div style={{
      width: '42px', height: '42px', borderRadius: '9px',
      background: mediaUrl ? `url(${mediaUrl}) center/cover` : grad,
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: 0.95,
      position: 'relative', overflow: 'hidden',
    }}>
      {!mediaUrl && <Icon name={iconName} size={16} color="#fff" />}
      {format && mediaUrl && (
        <span style={{
          position: 'absolute', bottom: '2px', right: '2px',
          background: 'rgba(0,0,0,.55)', color: '#fff',
          width: '14px', height: '14px', borderRadius: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name={iconName} size={10} color="#fff" /></span>
      )}
    </div>
  );
}

/* ── Helpers de formatação e tradução pro modal de detalhes ── */
const OBJECTIVE_PT = {
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_AWARENESS: 'Reconhecimento de Marca',
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_LEADS: 'Leads / Cadastros',
  OUTCOME_SALES: 'Vendas',
  OUTCOME_APP_PROMOTION: 'Promoção de App',
  MESSAGES: 'Mensagens (Direct/WhatsApp)',
  LINK_CLICKS: 'Cliques em Link',
  CONVERSIONS: 'Conversões',
  POST_ENGAGEMENT: 'Engajamento de Publicação',
  REACH: 'Alcance',
  BRAND_AWARENESS: 'Reconhecimento da Marca',
  PAGE_LIKES: 'Curtidas de Página',
  VIDEO_VIEWS: 'Visualizações de Vídeo',
};
function objectivePt(obj) { return obj ? (OBJECTIVE_PT[obj] || obj) : null; }
function fmtInt(v)    { return v != null ? Number(v).toLocaleString('pt-BR') : '—'; }
function fmtBRL(v)    { return v != null ? `R$ ${Number(v).toFixed(2).replace('.', ',')}` : '—'; }
function fmtPct(v)    { return v != null ? `${Number(v).toFixed(2).replace('.', ',')}%` : '—'; }
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* URL do Meta Ads Manager — sempre presente, mesmo sem ID Meta válido.
   Quando tem campanha publicada, foca direto nela (selected_campaign_ids).
   Quando tem ad publicado, foca também nele (selected_ad_ids).
   Fallback: link genérico pra lista de campanhas da conta. */
function metaAdsManagerUrl(ad) {
  const base = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1330468201431069&business_id=468086242175775&global_scope_id=468086242175775&columns=name%2Cdelivery%2Crecommendations_guidance%2Cresults%2Ccost_per_result%2Cbudget%2Cspend%2Cimpressions%2Creach%2Cactions%3Aonsite_conversion.total_messaging_connection%2Cactions%3Aonsite_conversion.messaging_first_reply%2Cactions%3Aomni_purchase%2Cschedule%2Cend_time%2Cattribution_setting%2Cbid%2Clast_significant_edit%2Cquality_score_organic%2Cquality_score_ectr%2Cquality_score_ecvr%2Ccampaign_name%2Ccost_per_action_type%3Aomni_purchase&attribution_windows=default';
  const isValidMetaId = (v) => v && /^\d{6,}$/.test(String(v));
  const cid = ad?.platform_campaign_id || ad?.metaCampaignId;
  const aid = ad?.metaAdId || ad?.platform_ad_id;
  let url = base;
  if (isValidMetaId(cid)) url += `&selected_campaign_ids=${cid}`;
  if (isValidMetaId(aid)) url += `&selected_ad_ids=${aid}`;
  return url;
}
function genderPt(g) {
  if (g == null || g === 'all' || g === 0) return 'Todos';
  if (g === 1 || g === '1' || g === 'men'   || g === 'male')   return 'Homens';
  if (g === 2 || g === '2' || g === 'women' || g === 'female') return 'Mulheres';
  return String(g);
}

/* ── Modal de detalhes completos do anúncio ── */
function AdPreviewModal({ ad, onClose, onDuplicate, onEdit }) {
  if (!ad) return null;
  const platLabel = PLAT[ad.platform]?.label || 'Meta';
  const statusInfo = STATUS[ad.status] || STATUS.review;
  const format = ad.adFormat || ad.format || 'image';
  const media = ad.mediaFiles || [];
  const grad = ad.thumbGrad || 'linear-gradient(135deg,#FECDD3,#FDA4AF,#FB7185)';

  const formatLabel = {
    reels: '🎬 Reels', stories: '📱 Stories', carousel: '🔄 Carrossel',
    video: '▶ Vídeo', image: '🖼️ Imagem',
  }[format] || format;

  const hasTargeting = ad.locations?.length > 0 || ad.interests?.length > 0 || ad.ageRange || ad.gender;
  const ageLabel = ad.ageRange ? `${ad.ageRange[0] || ad.ageRange.min || '?'}–${ad.ageRange[1] || ad.ageRange.max || '?'} anos` : null;

  const row   = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: '12px' };
  const label = { color: 'var(--c-text-4)', fontWeight: 500 };
  const val   = { color: 'var(--c-text-1)', fontWeight: 600, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' };
  const sectionH = {
    fontSize: '10.5px', fontWeight: 700, color: 'var(--c-text-3)',
    letterSpacing: '.5px', textTransform: 'uppercase',
    margin: '16px 0 8px',
  };

  const metrics = [
    { k: 'Impressões',         v: fmtInt(ad.impressions) },
    { k: 'Alcance',            v: fmtInt(ad.reach) },
    { k: 'Cliques',            v: fmtInt(ad.clicks) },
    { k: 'CTR',                v: fmtPct(ad.ctr) },
    { k: 'Conversões',         v: fmtInt(ad.conversions ?? ad.results) },
    { k: 'CPC',                v: fmtBRL(ad.cpc) },
    { k: 'CPM',                v: fmtBRL(ad.cpm) },
    { k: 'Custo/Resultado',    v: fmtBRL(ad.costPerResult) },
    ...(ad.messagesStarted != null ? [
      { k: 'Mensagens iniciadas', v: fmtInt(ad.messagesStarted) },
      { k: 'Custo/Mensagem',      v: fmtBRL(ad.costPerMessage) },
    ] : []),
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ccb-card ccb-modal"
        style={{
          borderRadius: '18px',
          width: '100%', maxWidth: '520px',
          maxHeight: '90vh', overflow: 'auto',
          padding: 0,
          boxShadow: '0 20px 60px rgba(0,0,0,.55)',
        }}
      >
        {/* Header com nome, plataforma, status */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'flex-start', gap: '12px', position: 'sticky', top: 0,
          background: 'var(--c-card-bg)', backdropFilter: 'var(--c-blur-strong)',
          WebkitBackdropFilter: 'var(--c-blur-strong)',
          zIndex: 2,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.25, wordBreak: 'break-word' }}>
              {ad.name || 'Anúncio sem nome'}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '10.5px', fontWeight: 700,
                background: PLAT[ad.platform]?.bg || 'rgba(59,130,246,.16)',
                color: PLAT[ad.platform]?.color || '#60A5FA',
                padding: '4px 9px', borderRadius: '999px',
                letterSpacing: '.3px',
              }}>{platLabel}</span>
              <span style={{
                fontSize: '10.5px', fontWeight: 700,
                background: statusInfo.bg, color: statusInfo.color,
                padding: '4px 9px', borderRadius: '999px',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                letterSpacing: '.3px',
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusInfo.dot }} />
                {statusInfo.label}
              </span>
              <span style={{
                fontSize: '10.5px', fontWeight: 400, color: 'var(--c-text-3)',
                padding: '4px 8px',
              }}>{formatLabel}</span>
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '4px', fontWeight: 400 }}>
              ID: {ad.adId || ad.id} {ad.createdAt && `· Criado em ${fmtDate(ad.createdAt)}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              fontSize: '22px', lineHeight: 1, color: 'var(--c-text-3)',
              cursor: 'pointer', padding: '0 4px', flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Preview estilo Instagram */}
        <div style={{
          width: '100%',
          aspectRatio: format === 'stories' || format === 'reels' ? '9/16' : '1',
          maxHeight: '480px',
          background: media.length > 0 ? '#000' : grad,
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {media.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.85)' }}>
              <div style={{ fontSize: '56px', marginBottom: '8px' }}>{formatLabel.split(' ')[0]}</div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,.4)' }}>
                Criativo não disponível — importado do Meta
              </div>
            </div>
          )}
          {media.length > 0 && media[0].type?.startsWith('video') ? (
            <video src={media[0].url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : media[0] ? (
            <img src={media[0].url} alt={ad.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : null}
          {format === 'carousel' && media.length > 1 && (
            <div style={{
              position: 'absolute', top: '10px', right: '10px',
              background: 'rgba(0,0,0,.6)', color: '#fff',
              padding: '3px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 600,
            }}>1 / {media.length}</div>
          )}
        </div>

        {/* Conteúdo detalhado */}
        <div style={{ padding: '4px 18px 18px' }}>

          {/* Copy do anúncio */}
          {(ad.primaryText || ad.headline || ad.ctaButton) && (
            <>
              <div style={sectionH}><Icon name="edit" size={13} /> Texto do anúncio</div>
              {ad.primaryText && (
                <div style={{ fontSize: '12.5px', color: 'var(--c-text-1)', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: '8px' }}>
                  {ad.primaryText}
                </div>
              )}
              {ad.headline && (
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                  {ad.headline}
                </div>
              )}
              {ad.ctaButton && (
                <div style={{
                  marginTop: '10px', padding: '8px 14px', borderRadius: '8px',
                  background: 'var(--c-accent)', color: '#fff',
                  fontSize: '12px', fontWeight: 700, textAlign: 'center', display: 'inline-block',
                }}>{ad.ctaButton}</div>
              )}
              {ad.destUrl && (
                <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '8px', wordBreak: 'break-all' }}>
                  Link: {ad.destUrl}
                </div>
              )}
            </>
          )}

          {/* Desempenho */}
          <div style={sectionH}><Icon name="chart-bar" size={13} /> Desempenho</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px',
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: '12px', padding: '10px',
          }}>
            {metrics.map(m => (
              <div key={m.k} style={{ padding: '4px 8px' }}>
                <div style={{ fontSize: '10px', color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.6px', fontWeight: 500 }}>{m.k}</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--c-text-1)', marginTop: '2px', fontFeatureSettings: "'tnum'" }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* Investimento */}
          <div style={sectionH}><Icon name="money" size={13} /> Investimento</div>
          <div>
            <div style={row}><span style={label}>Orçamento diário</span><span style={val}>{fmtBRL(ad.budget ?? ad.budgetValue)}</span></div>
            <div style={row}><span style={label}>Total gasto</span><span style={val}>{fmtBRL(ad.spent)}</span></div>
            <div style={row}><span style={label}>Início</span><span style={val}>{fmtDate(ad.startDate ?? ad.start_date ?? ad.created_at)}</span></div>
            <div style={row}><span style={label}>Término</span><span style={val}>{fmtDate(ad.endDate ?? ad.end_date) !== '—' ? fmtDate(ad.endDate ?? ad.end_date) : 'Sem data fim'}</span></div>
          </div>

          {/* Objetivo */}
          {(ad.objective || ad.effective_status) && (
            <>
              <div style={sectionH}><Icon name="target" size={13} /> Objetivo</div>
              <div>
                {ad.objective && <div style={row}><span style={label}>Objetivo Meta</span><span style={val}>{objectivePt(ad.objective)}</span></div>}
                {ad.effective_status && <div style={row}><span style={label}>Estado Meta</span><span style={val}>{ad.effective_status}</span></div>}
                {ad.synced_at && <div style={row}><span style={label}>Sincronizado</span><span style={val}>{fmtDate(ad.synced_at)}</span></div>}
              </div>
            </>
          )}

          {/* Público */}
          {hasTargeting && (
            <>
              <div style={sectionH}><Icon name="users" size={13} /> Público</div>
              <div>
                {ageLabel && <div style={row}><span style={label}>Idade</span><span style={val}>{ageLabel}</span></div>}
                {ad.gender != null && <div style={row}><span style={label}>Gênero</span><span style={val}>{genderPt(ad.gender)}</span></div>}
                {ad.locations?.length > 0 && (
                  <div style={row}>
                    <span style={label}>Bairros ({ad.locations.length})</span>
                    <span style={val}>{ad.locations.map(l => l.name || l.district || l).join(', ')}</span>
                  </div>
                )}
                {ad.interests?.length > 0 && (
                  <div style={row}>
                    <span style={label}>Interesses ({ad.interests.length})</span>
                    <span style={val}>{ad.interests.map(i => i.name || i).join(', ')}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* IDs Meta */}
          {(ad.platform_campaign_id || ad.metaCampaignId || ad.metaAdSetId || ad.metaAdId || ad.metaCreativeId) && (
            <>
              <div style={sectionH}><Icon name="link" size={13} /> IDs Meta</div>
              <div>
                {(ad.platform_campaign_id || ad.metaCampaignId) && (
                  <div style={row}><span style={label}>Campaign ID</span><span style={{ ...val, fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>{ad.platform_campaign_id || ad.metaCampaignId}</span></div>
                )}
                {ad.metaAdSetId && <div style={row}><span style={label}>Ad Set ID</span><span style={{ ...val, fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>{ad.metaAdSetId}</span></div>}
                {ad.metaCreativeId && <div style={row}><span style={label}>Creative ID</span><span style={{ ...val, fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>{ad.metaCreativeId}</span></div>}
                {ad.metaAdId && <div style={row}><span style={label}>Ad ID</span><span style={{ ...val, fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>{ad.metaAdId}</span></div>}
                <a
                  href={metaAdsManagerUrl(ad)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', marginTop: '8px',
                    fontSize: '11px', color: 'var(--c-accent)', fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >Abrir no Meta Ads Manager ↗</a>
              </div>
            </>
          )}

          {/* Ações */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '18px', borderTop: '1px solid var(--c-border)', paddingTop: '14px' }}>
            {onDuplicate && (
              <button
                onClick={() => { onDuplicate(ad); onClose(); }}
                style={{
                  flex: 1, padding: '11px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
                  color: '#fff',
                  border: 'none', fontSize: '12.5px', fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
                }}
              ><Icon name="clipboard" size={13} /> Duplicar como novo</button>
            )}
            {onEdit && (
              <button
                onClick={() => { onEdit(ad); onClose(); }}
                style={{
                  flex: 1, padding: '11px', borderRadius: '12px',
                  background: 'var(--c-surface)', color: 'var(--c-text-2)',
                  border: '1px solid var(--c-border)', fontSize: '12.5px', fontWeight: 700,
                  cursor: 'pointer',
                }}
              ><Icon name="edit" size={13} /> Editar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Cálculo de CPC e baixa performance ── */
function getCpc(ad) {
  if (!ad.clicks || ad.clicks === 0) return null;
  const spent = Number(ad.spent ?? ad.budget) || 0;
  return spent / ad.clicks;
}

function getAvgCpc(ads) {
  const valid = ads.map(getCpc).filter(v => v != null);
  if (!valid.length) return 0;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

function getPerformanceIssues(ad, avgCostPerResult) {
  const issues = [];
  if (ad.status !== 'active') return issues;

  const ageDays = ad.createdAt
    ? (Date.now() - new Date(ad.createdAt).getTime()) / 86_400_000
    : 0;

  // Sinais críticos (sempre alertam, mesmo em aprendizado)
  if (ageDays >= 1 && (!ad.clicks || ad.clicks === 0)) {
    issues.push('Zero cliques após 24h. Verifique se a campanha foi aprovada e se o anúncio está sendo entregue.');
  }
  if (ad.clicks > 100 && ad.results && (ad.results / ad.clicks) < 0.01) {
    issues.push('Taxa de conversão baixa (<1%) com volume relevante. Revise oferta e destino.');
  }

  // Fase de aprendizado Meta (~7 dias) — não sugerir ajustes que resetam aprendizado
  if (ageDays < 7) {
    const dias = Math.max(1, Math.ceil(7 - ageDays));
    issues.push(`Em fase de aprendizado (${dias} dia${dias > 1 ? 's' : ''} restante${dias > 1 ? 's' : ''}). Não altere orçamento, criativo ou público — reseta o aprendizado do Meta.`);
    return issues;
  }

  // Pós-aprendizado: avalia proporcionalmente
  const cpc = getCpc(ad);
  if (cpc && cpc > 2) {
    issues.push(`CPC alto (R$ ${cpc.toFixed(2)}). Teste novo criativo (CTR pode estar baixo) ou refine público.`);
  }
  if (ad.costPerResult && avgCostPerResult && ad.costPerResult > avgCostPerResult * 1.3) {
    issues.push('Custo por resultado 30% acima da média da conta. Teste novo criativo ou público.');
  }

  return issues;
}

/* ── Linha da tabela (compacta — clique abre preview) ── */
function AdRow({ ad, isLast, highCpc, onPreview, onToggle, onDuplicate, onEdit, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const plat   = PLAT[ad.platform]   || PLAT.instagram;
  /* Status desconhecido do Meta (ex: sync retornou estado intermediário) → assume "Em revisão" */
  const status = STATUS[ad.status]   || STATUS.review;
  const isActive = ad.status === 'active';
  const isEnded  = ad.status === 'ended';

  const fmt = v => v != null ? v.toLocaleString('pt-BR') : '—';
  const fmtCurrency = v => v != null ? `R$\u00A0${v.toFixed(2).replace('.', ',')}` : '—';

  const rowBg = isEnded
    ? (hovered ? 'var(--c-hover)' : 'transparent')
    : highCpc
      ? (hovered ? 'rgba(248,113,113,.12)' : 'rgba(248,113,113,.06)')
      : (hovered ? 'var(--c-hover)' : 'transparent');

  const btn = {
    width: '28px', height: '28px', borderRadius: '8px',
    border: '1px solid var(--c-border)', background: 'var(--c-surface)',
    color: 'var(--c-text-2)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all .12s',
  };

  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPreview && onPreview(ad)}
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--c-border)',
        background: rowBg,
        transition: 'background .12s',
        borderLeft: highCpc ? '3px solid #F87171' : '3px solid transparent',
        opacity: isEnded ? 0.55 : 1,
        color: isEnded ? 'var(--c-text-4)' : undefined,
        filter: isEnded ? 'grayscale(1)' : 'none',
        cursor: onPreview ? 'pointer' : 'default',
      }}
    >
      {/* Anúncio */}
      <td style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AdThumb ad={ad} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--c-text-1)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.name}</span>
              {ad.budgetOptimization === 'campaign' && (
                <span
                  title="CBO — Meta otimiza orçamento entre anéis automaticamente"
                  style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '.3px',
                    padding: '2px 5px', borderRadius: '4px',
                    background: 'rgba(96,165,250,.16)', color: '#60A5FA',
                    flexShrink: 0,
                  }}
                >CBO</span>
              )}
              {ad.budgetOptimization === 'adset' && (
                <span
                  title="ABO — Você controla o orçamento manualmente por anel"
                  style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '.3px',
                    padding: '2px 5px', borderRadius: '4px',
                    background: 'rgba(167,139,250,.16)', color: '#A78BFA',
                    flexShrink: 0,
                  }}
                >ABO</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '9.5px', color: 'var(--c-text-4)', fontWeight: 400 }}>ID: {ad.adId}</div>
              {(() => {
                const es = ad.effective_status;
                const meta = es && DELIVERY_STATUS[es];
                if (!meta) return null;
                return (
                  <span
                    title={meta.help}
                    style={{
                      fontSize: '9.5px', fontWeight: 700,
                      padding: '1px 6px', borderRadius: '4px',
                      background: meta.bg, color: meta.color,
                      border: `1px solid ${meta.color}33`,
                    }}
                  >{meta.label}</span>
                );
              })()}
            </div>
          </div>
        </div>
      </td>

      {/* Plataforma */}
      <td style={{ padding: '8px 10px' }}>
        <span style={{
          fontSize: '10.5px', fontWeight: 700, letterSpacing: '.3px',
          background: plat.bg, color: plat.color,
          padding: '4px 9px', borderRadius: '999px',
          display: 'inline-block',
          border: `1px solid ${plat.color === 'var(--c-accent)' ? 'rgba(193,53,132,.4)' : plat.color + '40'}`,
        }}>
          {plat.label}
        </span>
      </td>

      {/* Situação */}
      <td style={{ padding: '8px 10px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '10.5px', fontWeight: 700, letterSpacing: '.3px',
          background: status.bg, color: status.color,
          padding: '4px 9px', borderRadius: '999px',
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: status.dot, display: 'inline-block', flexShrink: 0 }} />
          {status.label}
        </span>
      </td>

      {/* Investimento */}
      <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--c-text-2)', whiteSpace: 'nowrap', fontFeatureSettings: "'tnum'" }}>
        {ad.budget ? `R$ ${Number(ad.budget).toFixed(2).replace('.', ',')} / dia` : '—'}
      </td>

      {/* Resultados */}
      <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--c-text-2)', fontWeight: ad.results ? 700 : 400, fontFeatureSettings: "'tnum'" }}>
        {fmt(ad.results)}
      </td>

      {/* Cliques */}
      <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--c-text-2)', fontWeight: ad.clicks ? 700 : 400, fontFeatureSettings: "'tnum'" }}>
        {fmt(ad.clicks)}
      </td>

      {/* Custo por resultado */}
      <td style={{ padding: '8px 10px', fontSize: '12px', whiteSpace: 'nowrap', fontFeatureSettings: "'tnum'" }}>
        <span style={{ color: highCpc ? '#F87171' : 'var(--c-text-2)', fontWeight: highCpc ? 700 : 400 }}>
          {fmtCurrency(ad.costPerResult)}
        </span>
        {highCpc && <span title="Custo por resultado acima da média" style={{ marginLeft: '4px', color: '#F87171', display: 'inline-flex', verticalAlign: 'middle' }}><Icon name="alert" color="danger" size={13} /></span>}
      </td>

      {/* Ações — sempre visíveis pra deixar claro */}
      <td style={{ padding: '8px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button title="Ver criativo" onClick={stop(() => onPreview && onPreview(ad))} style={btn}><EyeIcon /></button>
          {(isActive || ad.status === 'paused' || ad.status === 'review') && onToggle && (
            <button
              title={
                isActive
                  ? 'Pausar no Meta'
                  : ad.status === 'review'
                    ? 'Pré-ativar — começa a entregar assim que o Meta aprovar'
                    : 'Reativar no Meta'
              }
              onClick={stop(() => {
                /* Confirm ao ativar — evita gasto acidental */
                if (!isActive) {
                  const budget = ad.budgetValue || ad.budget;
                  const msg = ad.status === 'review'
                    ? `Pré-ativar "${ad.name || 'esse anúncio'}"? Assim que o Meta aprovar, ele começa a gastar R$ ${budget || '?'}${ad.budgetType === 'daily' ? '/dia' : ''}.`
                    : `Ativar "${ad.name || 'esse anúncio'}"? Ele começa a gastar R$ ${budget || '?'}${ad.budgetType === 'daily' ? '/dia' : ''} imediatamente.`;
                  if (!confirm(msg)) return;
                }
                onToggle(ad);
              })}
              style={btn}
            >
              {isActive ? <PauseIcon /> : <PlayIcon />}
            </button>
          )}
          {onEdit && <button title="Editar" onClick={stop(() => onEdit(ad))} style={btn}><EditIcon /></button>}
          {onDuplicate && <button title="Duplicar" onClick={stop(() => onDuplicate(ad))} style={btn}><CopyIcon /></button>}
          <a
            title="Abrir no Meta Ads Manager"
            href={metaAdsManagerUrl(ad)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ ...btn, textDecoration: 'none', color: '#60A5FA', borderColor: 'rgba(96,165,250,.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', lineHeight: 1 }}
          >ⓜ</a>
          {onRemove && (
            <button
              title="Remover"
              onClick={stop(() => { if (confirm(`Remover "${ad.name}"?`)) onRemove(ad); })}
              style={{ ...btn, color: '#F87171', borderColor: 'rgba(248,113,113,.4)' }}
            ><TrashIcon /></button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Select dropdown estilizado ── */
function FilterSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none',
          padding: '9px 32px 9px 14px',
          borderRadius: '10px',
          border: '1px solid var(--c-border)',
          background: 'var(--c-surface)',
          fontSize: '13px', fontWeight: 500, color: 'var(--c-text-2)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
      <span style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: 'var(--c-text-3)' }}>
        <ChevronDown />
      </span>
    </div>
  );
}

/* ── Relatório de baixa performance ── */
function PerformanceReport({ ads, avgCostPerResult }) {
  const problematic = ads
    .map(ad => ({ ad, issues: getPerformanceIssues(ad, avgCostPerResult) }))
    .filter(x => x.issues.length > 0);

  if (!problematic.length) {
    return (
      <div className="ccb-card" style={{
        borderRadius: '14px',
        padding: '16px 20px',
        marginBottom: '16px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <Icon name="check-circle" color="success" size={18} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#34D399' }}>Todos os anúncios performando bem</div>
          <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', fontWeight: 400, marginTop: '2px' }}>Nenhum alerta de performance no momento.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ccb-card" style={{
      borderRadius: '14px',
      padding: '16px 20px',
      marginBottom: '16px',
      borderColor: 'rgba(248,113,113,.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Icon name="chart-bar" size={18} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
            Relatório de performance — {problematic.length} {problematic.length === 1 ? 'anúncio precisa' : 'anúncios precisam'} de atenção
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', fontWeight: 400, marginTop: '2px' }}>
            Custo médio por resultado: R$ {avgCostPerResult.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {problematic.map(({ ad, issues }) => (
          <div key={ad.id} style={{
            background: 'rgba(248,113,113,.08)',
            border: '1px solid rgba(248,113,113,.25)',
            borderRadius: '12px',
            padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-1)' }}>{ad.name}</span>
              <span style={{ fontSize: '11px', color: '#F87171', fontWeight: 700, fontFeatureSettings: "'tnum'" }}>
                CPR: R$ {ad.costPerResult?.toFixed(2).replace('.', ',') || '—'}
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--c-text-3)', fontSize: '11.5px', lineHeight: 1.55, fontWeight: 400 }}>
              {issues.map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--c-text-4)', fontStyle: 'italic', fontWeight: 400 }}>
        💡 Integração futura com Meta Ads vai analisar também a imagem do anúncio para sugestões mais específicas.
      </div>
    </div>
  );
}

/* ── Modal de edição de PÚBLICO (idade/gênero/interesses) ──
   Aplica nos 3 anéis simultaneamente via PUT /api/campaigns/:id { targeting }.
   Bairros e raios NÃO são tocados. Só faz sentido pra campanhas Meta publicadas
   (com platform_campaign_id). */
function EditAudienceModal({ ad, onClose, onSaved }) {
  /* Lê valores atuais do payload — tenta ad_sets[0].targeting primeiro,
     depois cai pra ad_set, depois pros campos planos no topo. */
  const initial = (() => {
    const adSetsList = ad?.meta?.ad_sets || (ad?.meta?.ad_set ? [ad.meta.ad_set] : []);
    const t = adSetsList[0]?.targeting || {};
    const ageRange = ad?.ageRange || {};
    return {
      age_min: Number(t.age_min ?? ageRange.min ?? ageRange[0] ?? 25),
      age_max: Number(t.age_max ?? ageRange.max ?? ageRange[1] ?? 45),
      genders: Array.isArray(t.genders) && t.genders.length > 0
        ? t.genders.map(Number)
        : (ad?.gender === 1 || ad?.gender === 2 ? [Number(ad.gender)] : []),
      interests: Array.isArray(t.interests) && t.interests.length > 0
        ? t.interests.map(it => ({ id: String(it.id), name: it.name || '' }))
        : (Array.isArray(ad?.interests)
            ? ad.interests
                .filter(i => i?.id && !String(i.id).startsWith('interest_'))
                .map(i => ({ id: String(i.id), name: i.name || '' }))
            : []),
    };
  })();

  const [ageMin, setAgeMin] = useState(initial.age_min);
  const [ageMax, setAgeMax] = useState(initial.age_max);
  /* Genero: '' = Todos, '2' = Mulheres, '1' = Homens */
  const [genderRadio, setGenderRadio] = useState(
    initial.genders.length === 0 ? '' : String(initial.genders[0])
  );
  const [interests, setInterests] = useState(initial.interests);

  const [searchQ, setSearchQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);

  /* Busca de interesses com debounce de 400ms */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQ.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchInterests(q, { limit: 8 });
        /* Remove já adicionados */
        const filtered = results.filter(r => !interests.some(it => String(it.id) === String(r.id)));
        setSuggestions(filtered);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [searchQ, interests]);

  const addInterest = useCallback((it) => {
    setInterests(prev => prev.some(x => String(x.id) === String(it.id))
      ? prev
      : [...prev, { id: String(it.id), name: it.name }]);
    setSearchQ('');
    setSuggestions([]);
    setShowDropdown(false);
  }, []);

  const removeInterest = useCallback((id) => {
    setInterests(prev => prev.filter(x => String(x.id) !== String(id)));
  }, []);

  /* Validações leves */
  const canSave = (() => {
    if (saving) return false;
    if (ageMin < 18 || ageMin > 65) return false;
    if (ageMax < 18 || ageMax > 65) return false;
    if (ageMin > ageMax) return false;
    return true;
  })();

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    /* IDs locais do servidor — usa serverId quando disponível, senão id puro */
    const serverId = ad?.serverId || ad?.id;
    const targeting = {
      age_min: Number(ageMin),
      age_max: Number(ageMax),
      genders: genderRadio === '' ? [] : [Number(genderRadio)],
      interests: interests.map(it => ({ id: it.id, name: it.name || '' })),
    };
    try {
      const updated = await updateAdTargeting(serverId, targeting);
      setSaving(false);
      onSaved && onSaved(updated, targeting);
      onClose();
    } catch (err) {
      setSaving(false);
      /* 502 = Meta recusou — mostra mensagem do backend e MANTÉM o painel aberto */
      if (err?.status === 502) {
        setError(err.message || 'Meta recusou a alteração. Revise os campos e tente novamente.');
      } else {
        setError('Falha ao salvar público — tente novamente.');
      }
    }
  };

  /* Estilos compartilhados */
  const labelStyle = {
    display: 'block', fontSize: '10.5px', fontWeight: 700,
    color: 'var(--c-text-3)', textTransform: 'uppercase',
    letterSpacing: '1.2px', marginBottom: '8px',
  };
  const inputStyle = {
    width: '90px', padding: '11px 14px', fontSize: '13px',
    borderRadius: '10px', border: '1px solid var(--c-border)',
    background: 'var(--c-surface)', color: 'var(--c-text-1)',
    fontFamily: 'inherit',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 250, padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ccb-card ccb-modal"
        style={{
          borderRadius: '18px',
          width: '100%', maxWidth: '540px', maxHeight: '90vh', overflow: 'auto',
          padding: 0,
          boxShadow: '0 20px 60px rgba(0,0,0,.55)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          position: 'sticky', top: 0, background: 'var(--c-card-bg)',
          backdropFilter: 'var(--c-blur-strong)', WebkitBackdropFilter: 'var(--c-blur-strong)',
          zIndex: 2,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)' }}>
              Editar público
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--c-text-4)', marginTop: '2px', wordBreak: 'break-word' }}>
              {ad?.name || 'Anúncio sem nome'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              fontSize: '22px', lineHeight: 1, color: 'var(--c-text-3)',
              cursor: 'pointer', padding: '0 4px', flexShrink: 0,
            }}
          >×</button>
        </div>

        <div style={{ padding: '18px 20px' }}>

          {/* Aviso */}
          <div style={{
            background: 'var(--c-accent-soft)',
            border: '1px solid rgba(193,53,132,.4)',
            borderRadius: '12px', padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.55, fontWeight: 400,
            boxShadow: '0 0 18px rgba(193,53,132,.14)',
          }}>
            <strong style={{ color: 'var(--c-accent)' }}>Importante:</strong> mudanças
            no público aplicam aos <strong>3 anéis simultaneamente</strong>. Bairros
            e raios <strong>não são alterados</strong>.
          </div>

          {/* Faixa etária */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Faixa etária</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <input
                  type="number"
                  min={18}
                  max={65}
                  value={ageMin}
                  onChange={(e) => setAgeMin(Math.max(18, Math.min(65, Number(e.target.value) || 18)))}
                  style={inputStyle}
                />
                <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '4px', textAlign: 'center' }}>
                  Mínima
                </div>
              </div>
              <span style={{ color: 'var(--c-text-4)', fontSize: '14px', alignSelf: 'center', marginTop: '-14px' }}>até</span>
              <div>
                <input
                  type="number"
                  min={18}
                  max={65}
                  value={ageMax}
                  onChange={(e) => setAgeMax(Math.max(18, Math.min(65, Number(e.target.value) || 65)))}
                  style={inputStyle}
                />
                <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '4px', textAlign: 'center' }}>
                  Máxima
                </div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--c-text-3)', alignSelf: 'center', marginTop: '-14px' }}>
                {ageMin > ageMax
                  ? <span style={{ color: '#DC2626', fontWeight: 600 }}>Intervalo inválido</span>
                  : `${ageMax - ageMin + 1} anos de faixa`
                }
              </div>
            </div>
          </div>

          {/* Gênero */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Gênero</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { val: '',  label: 'Todos' },
                { val: '2', label: 'Mulheres' },
                { val: '1', label: 'Homens' },
              ].map(opt => {
                const isOn = genderRadio === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setGenderRadio(opt.val)}
                    style={{
                      padding: '9px 18px', borderRadius: '11px',
                      border: `1.5px solid ${isOn ? 'rgba(193,53,132,.65)' : 'var(--c-border)'}`,
                      background: isOn
                        ? 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))'
                        : 'var(--c-surface)',
                      color: isOn ? '#fff' : 'var(--c-text-2)',
                      fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'all .15s',
                      boxShadow: isOn ? '0 6px 18px rgba(193,53,132,.35), inset 0 1px 0 rgba(255,255,255,.18)' : 'none',
                    }}
                  >{opt.label}</button>
                );
              })}
            </div>
          </div>

          {/* Interesses */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Interesses</label>

            {/* Chips atuais */}
            {interests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {interests.map(it => (
                  <span
                    key={it.id}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '5px 12px', borderRadius: '999px',
                      background: 'var(--c-accent-soft)',
                      border: '1px solid rgba(193,53,132,.4)',
                      fontSize: '11.5px', color: 'var(--c-accent)', fontWeight: 600,
                    }}
                  >
                    {it.name || it.id}
                    <button
                      type="button"
                      onClick={() => removeInterest(it.id)}
                      title="Remover"
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--c-text-4)', fontSize: '14px', lineHeight: 1,
                        padding: 0, display: 'flex', alignItems: 'center',
                      }}
                    >×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Input de busca + dropdown */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Buscar interesse no Meta (ex: maquiagem, estética...)"
                style={{
                  width: '100%', padding: '11px 14px', fontSize: '13px',
                  borderRadius: '10px', border: '1px solid var(--c-border)',
                  background: 'var(--c-surface)', color: 'var(--c-text-1)',
                  fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
                }}
              />
              {showDropdown && (searching || suggestions.length > 0) && (
                <div className="ccb-card" style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  borderRadius: '12px',
                  padding: 0,
                  boxShadow: '0 8px 24px rgba(0,0,0,.45)',
                  zIndex: 5, maxHeight: '280px', overflow: 'auto',
                }}>
                  {searching && (
                    <div style={{ padding: '10px 12px', fontSize: '11.5px', color: 'var(--c-text-4)' }}>
                      Buscando…
                    </div>
                  )}
                  {!searching && suggestions.length === 0 && searchQ.trim().length >= 2 && (
                    <div style={{ padding: '10px 12px', fontSize: '11.5px', color: 'var(--c-text-4)' }}>
                      Nenhum resultado
                    </div>
                  )}
                  {!searching && suggestions.map(s => {
                    const audLabel = s.audience_size?.lower != null
                      ? ` · ~${Number(s.audience_size.lower).toLocaleString('pt-BR')} pessoas`
                      : '';
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addInterest(s)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 14px', background: 'transparent',
                          border: 'none', borderBottom: '1px solid var(--c-border)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--c-text-1)' }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '2px' }}>
                          {s.topic || (s.path && s.path.length > 0 ? s.path.slice(0, 2).join(' › ') : 'Interesse Meta')}
                          {audLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginTop: '6px' }}>
              Os interesses ficam combinados com OU (qualquer um deles dispara o anúncio).
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div style={{
              background: 'rgba(248,113,113,.16)', border: '1px solid rgba(248,113,113,.4)',
              borderRadius: '10px', padding: '10px 12px',
              fontSize: '12px', color: '#F87171', marginBottom: '14px',
              wordBreak: 'break-word', fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {/* Ações */}
          <div style={{
            display: 'flex', gap: '8px', marginTop: '8px',
            borderTop: '1px solid var(--c-border)', paddingTop: '14px',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1, padding: '11px', borderRadius: '12px',
                background: 'var(--c-surface)', color: 'var(--c-text-2)',
                border: '1px solid var(--c-border)',
                fontSize: '12.5px', fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >Cancelar</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              style={{
                flex: 2, padding: '11px', borderRadius: '12px',
                background: canSave
                  ? 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))'
                  : 'var(--c-surface)',
                color: canSave ? '#fff' : 'var(--c-text-4)',
                border: canSave ? 'none' : '1px solid var(--c-border)',
                fontSize: '12.5px', fontWeight: 700,
                cursor: canSave ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                boxShadow: canSave ? '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)' : 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {saving && (
                <span style={{
                  width: '12px', height: '12px',
                  border: '2px solid rgba(255,255,255,.4)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  display: 'inline-block', animation: 'spin .9s linear infinite',
                }} />
              )}
              {saving ? 'Salvando…' : 'Salvar público'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Página Anúncios ── */
export default function Campaigns() {
  const navigate = useNavigate();
  const { ads: userAds, toggleAdStatus, duplicateAd, removeAd, updateAd, runMetaSync, metaSyncedAt, metaSyncing } = useAppState();
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(true);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [previewAd, setPreviewAd] = useState(null);
  const [editingAudienceAd, setEditingAudienceAd] = useState(null);

  /* Força refresh do effective_status (status real Meta) ao abrir a página.
     Sem isso, tag "Pausado no Meta" pode ficar grudada em estado obsoleto até
     o próximo tick de 90s do polling. */
  useEffect(() => { runMetaSync().catch(() => {}); }, [runMetaSync]);

  const allAds = userAds;
  const TOTAL = allAds.length;

  /* Pra campanhas Meta JÁ PUBLICADAS, "Editar" abre o modal de público inline
     (rápido). Pra rascunhos/agendadas, segue o fluxo antigo: reabre o wizard
     pra editar tudo (criativo, copy, bairros, etc). */
  function handleEdit(ad) {
    const isPublishedMeta = (ad.platform === 'meta' || ad.platform === 'instagram')
      && (ad.platform_campaign_id || ad.metaCampaignId);
    if (isPublishedMeta) {
      setEditingAudienceAd(ad);
    } else {
      navigate('/criar-anuncio', { state: { editId: ad.id } });
    }
  }

  /* Sucesso no PUT /api/campaigns/:id { targeting } — atualiza estado local
     da ad pra o painel não mostrar valores antigos no próximo clique. */
  function handleAudienceSaved(_serverResp, targetingApplied) {
    if (!editingAudienceAd) return;
    const id = editingAudienceAd.id;
    /* Reflete no payload.meta.ad_sets[i].targeting + nos campos planos lidos pelo modal de preview */
    const patch = {
      ageRange: { min: targetingApplied.age_min, max: targetingApplied.age_max },
      gender: targetingApplied.genders.length === 0 ? 0 : targetingApplied.genders[0],
      interests: targetingApplied.interests,
    };
    /* Mescla também no meta.ad_sets[*].targeting pra ficar consistente caso
       o usuário reabra o modal — sem refetch, evita corrida. */
    if (editingAudienceAd.meta?.ad_sets?.length) {
      const newAdSets = editingAudienceAd.meta.ad_sets.map(as => ({
        ...as,
        targeting: {
          ...(as.targeting || {}),
          age_min: targetingApplied.age_min,
          age_max: targetingApplied.age_max,
          genders: targetingApplied.genders,
          interests: targetingApplied.interests,
        },
      }));
      patch.meta = { ...editingAudienceAd.meta, ad_sets: newAdSets };
    }
    updateAd && updateAd(id, patch);
  }

  function handleSort(key) {
    if (!key) return;
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = allAds.filter(ad => {
    if (statusFilter && ad.status !== statusFilter) return false;
    if (platformFilter && ad.platform !== platformFilter) return false;
    return true;
  });

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        const aNull = va == null;
        const bNull = vb == null;
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        let cmp;
        if (typeof va === 'number' && typeof vb === 'number') {
          cmp = va - vb;
        } else {
          cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
        }
        return sortDir === 'desc' ? -cmp : cmp;
      })
    : filtered;

  const validCostPerResult = allAds.map(a => a.costPerResult).filter(v => v != null);
  const avgCostPerResult = validCostPerResult.length
    ? validCostPerResult.reduce((s, v) => s + v, 0) / validCostPerResult.length
    : 0;
  const HIGH_CPR_THRESHOLD = avgCostPerResult * 1.3;

  return (
    <div className="page-container">

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--c-text-1)', marginBottom: '4px' }}>Anúncios</h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)', fontWeight: 400 }}>
            Gerencie seus anúncios e acompanhe os resultados.
            {metaSyncedAt && (
              <>
                {' · '}
                <span style={{ fontSize: '11.5px', color: 'var(--c-text-4)', fontWeight: 400 }}>
                  Sincronizado com Meta {(() => {
                    const m = Math.round((Date.now() - new Date(metaSyncedAt).getTime()) / 60000);
                    if (m < 1) return 'agora mesmo';
                    if (m === 1) return 'há 1 min';
                    return `há ${m} min`;
                  })()}
                </span>
                <button
                  onClick={() => runMetaSync && runMetaSync()}
                  disabled={metaSyncing}
                  title="Buscar status atual do Meta agora"
                  style={{
                    marginLeft: '6px', padding: '3px 8px',
                    background: 'var(--c-accent-soft)', border: '1px solid rgba(193,53,132,.4)',
                    borderRadius: '6px', fontSize: '11px', color: 'var(--c-accent)', fontWeight: 700,
                    cursor: metaSyncing ? 'wait' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'inline-block', animation: metaSyncing ? 'spin 0.9s linear infinite' : 'none' }}>↻</span>
                  {' Sincronizar'}
                </button>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate('/criar-anuncio')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
            color: '#fff',
            border: 'none', borderRadius: '12px',
            padding: '11px 18px', fontSize: '13px', fontWeight: 700,
            cursor: 'pointer', transition: 'transform .2s, box-shadow .2s',
            boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 14px 30px rgba(193,53,132,.5), inset 0 1px 0 rgba(255,255,255,.18)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)'; }}
        >
          <PlusIcon />
          Novo anúncio
        </button>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[['','Todos os status'],['active','Ativo'],['paused','Pausado'],['review','Em revisão'],['draft','Rascunho'],['ended','Encerrado']]}
        />
        <FilterSelect
          value={platformFilter}
          onChange={setPlatformFilter}
          options={[['','Todas as plataformas'],['instagram','Instagram'],['meta','Meta Ads'],['google','Google Ads']]}
        />
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '9px 14px', borderRadius: '10px',
          border: '1px solid var(--c-border)', background: 'var(--c-surface)',
          fontSize: '13px', fontWeight: 500, color: 'var(--c-text-2)', cursor: 'pointer',
        }}>
          <CalIcon />
          01/04/2026 - 14/04/2026
        </div>
        {(statusFilter || platformFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setPlatformFilter(''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: 700, color: 'var(--c-accent)',
            }}
          >
            Limpar filtros
          </button>
        )}
        <button
          onClick={() => setReportOpen(v => !v)}
          style={{
            marginLeft: 'auto',
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: '10px', padding: '9px 14px',
            fontSize: '13px', fontWeight: 600, color: 'var(--c-text-2)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <Icon name="chart-bar" size={13} /> {reportOpen ? 'Ocultar' : 'Ver'} relatório de performance
        </button>
      </div>

      {/* ── Relatório de performance ── */}
      {reportOpen && (
        <PerformanceReport ads={allAds} avgCostPerResult={avgCostPerResult} />
      )}

      {/* ── Tabela ── */}
      <div className="ads-table-wrapper ccb-card" style={{
        borderRadius: '18px',
        padding: 0,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
              {[
                { label: 'ANÚNCIO',           w: 'auto',   key: 'name' },
                { label: 'PLATAFORMA',        w: '120px',  key: 'platform' },
                { label: 'SITUAÇÃO',          w: '130px',  key: 'status' },
                { label: 'INVESTIMENTO',      w: '130px',  key: 'budget' },
                { label: 'RESULTADOS',        w: '110px',  key: 'results' },
                { label: 'CLIQUES',           w: '90px',   key: 'clicks' },
                { label: 'CUSTO POR RESULT.', w: '140px',  key: 'costPerResult' },
                { label: 'AÇÕES',             w: '140px',  key: null },
              ].map(({ label, w, key }) => {
                const isActive = sortKey === key && key != null;
                return (
                  <th
                    key={label}
                    onClick={() => handleSort(key)}
                    title={key ? 'Clique para ordenar' : undefined}
                    style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: '10.5px',
                      fontWeight: 500,
                      color: isActive ? 'var(--c-accent)' : 'var(--c-text-3)',
                      letterSpacing: '1.2px', whiteSpace: 'nowrap', width: w,
                      cursor: key ? 'pointer' : 'default',
                      userSelect: 'none',
                      transition: 'color .15s',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {label}
                      {key && (
                        <span style={{
                          fontSize: '11px',
                          opacity: isActive ? 1 : 0.35,
                          transition: 'opacity .15s',
                        }}>
                          {isActive ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '60px', textAlign: 'center' }}>
                  <div style={{ marginBottom: '10px', opacity: .4 }}><Icon name="bell" size={32} /></div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>Nenhum anúncio encontrado</div>
                  <div style={{ fontSize: '12px', color: 'var(--c-text-3)', fontWeight: 400 }}>Tente remover os filtros ou crie um novo anúncio.</div>
                </td>
              </tr>
            ) : (
              sorted.map((ad, i) => {
                const isUserAd = userAds.some(u => u.id === ad.id);
                return (
                  <AdRow
                    key={ad.id}
                    ad={ad}
                    isLast={i === sorted.length - 1}
                    highCpc={ad.costPerResult != null && ad.costPerResult > HIGH_CPR_THRESHOLD}
                    onPreview={setPreviewAd}
                    onToggle={isUserAd ? (a) => toggleAdStatus(a.id) : null}
                    onDuplicate={isUserAd ? (a) => duplicateAd(a.id) : null}
                    onEdit={isUserAd ? handleEdit : null}
                    onRemove={isUserAd ? (a) => removeAd(a.id) : null}
                  />
                );
              })
            )}
          </tbody>
        </table>

        {/* ── Paginação ── */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--c-text-4)', fontWeight: 400 }}>
            Mostrando {filtered.length} de {TOTAL} anúncios
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Prev */}
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                width: '32px', height: '32px', borderRadius: '8px',
                border: '1px solid var(--c-border)', background: 'var(--c-surface)',
                color: 'var(--c-text-2)', cursor: page === 1 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: page === 1 ? 0.4 : 1, fontSize: '14px',
              }}
            >‹</button>

            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  border: `1px solid ${page === n ? 'rgba(193,53,132,.65)' : 'var(--c-border)'}`,
                  background: page === n
                    ? 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))'
                    : 'var(--c-surface)',
                  color: page === n ? '#fff' : 'var(--c-text-2)',
                  fontSize: '12.5px', fontWeight: page === n ? 700 : 500,
                  cursor: 'pointer', transition: 'all .15s',
                  boxShadow: page === n ? '0 4px 14px rgba(193,53,132,.35)' : 'none',
                }}
              >{n}</button>
            ))}

            {/* Next */}
            <button
              onClick={() => setPage(p => Math.min(3, p + 1))}
              disabled={page === 3}
              style={{
                width: '32px', height: '32px', borderRadius: '8px',
                border: '1px solid var(--c-border)', background: 'var(--c-surface)',
                color: 'var(--c-text-2)', cursor: page === 3 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: page === 3 ? 0.4 : 1, fontSize: '14px',
              }}
            >›</button>
          </div>
        </div>
      </div>

      <AdPreviewModal
        ad={previewAd}
        onClose={() => setPreviewAd(null)}
        onDuplicate={previewAd && userAds.some(u => u.id === previewAd.id) ? (a) => duplicateAd(a.id) : null}
        onEdit={previewAd && userAds.some(u => u.id === previewAd.id) ? handleEdit : null}
      />

      {editingAudienceAd && (
        <EditAudienceModal
          ad={editingAudienceAd}
          onClose={() => setEditingAudienceAd(null)}
          onSaved={handleAudienceSaved}
        />
      )}
    </div>
  );
}
