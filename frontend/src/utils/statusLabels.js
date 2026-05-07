/**
 * Util único de status para todo o sistema.
 *
 * Regra visual (definida pelo Rafa):
 *   verde   → ativo / ok / running / completed
 *   amarelo → pausado / em revisão / aguardando / publicando
 *   vermelho→ erro / falhou / reprovado / com problema
 *   cinza   → encerrado / arquivado / rascunho / deletado / em processamento
 *
 * Uso típico:
 *   import { statusOf } from '../utils/statusLabels';
 *   const s = statusOf(ad.status);   // { label, color, bg, border, dot, tone, icon }
 *   <span style={{ color: s.color, background: s.bg }}>{s.label}</span>
 */

/* Tons → cores (mapeia em variáveis CSS já existentes em index.css) */
const TONE = {
  success: { color: 'var(--c-success)',   bg: 'rgba(46,187,122,.18)',  border: 'var(--c-success)' },
  warning: { color: 'var(--c-warning)',   bg: 'rgba(251,191,36,.18)',  border: 'var(--c-warning)' },
  danger:  { color: 'var(--c-attention)', bg: 'rgba(248,113,113,.16)', border: 'var(--c-attention)' },
  neutral: { color: 'var(--c-text-3)',    bg: 'var(--c-surface)',      border: 'var(--c-border)' },
};

/* Mapa único: chave → { label PT-BR, tone, icon, help opcional } */
export const STATUS_MAP = {
  /* Locais (lowercase do nosso DB) */
  active:     { label: 'Ativo',         tone: 'success', icon: '🟢' },
  paused:     { label: 'Pausado',       tone: 'warning', icon: '⏸️' },
  review:     { label: 'Em revisão',    tone: 'warning', icon: '🟡' },
  publishing: { label: 'Em publicação', tone: 'warning', icon: '⏳' },
  completed:  { label: 'Concluído',     tone: 'success', icon: '✅' },
  failed:     { label: 'Falhou',        tone: 'danger',  icon: '❌' },
  draft:      { label: 'Rascunho',      tone: 'neutral', icon: '📝' },
  ended:      { label: 'Encerrado',     tone: 'neutral', icon: '⏹️' },

  /* Estados Meta (UPPERCASE — Graph API effective_status) */
  ACTIVE:               { label: 'Entregando',         tone: 'success', icon: '🟢', help: 'Ad rodando e gastando orçamento no Meta.' },
  PAUSED:               { label: 'Pausado no Meta',    tone: 'warning', icon: '⏸️', help: 'Pausado — não está entregando.' },
  PENDING_REVIEW:       { label: 'Aguardando Meta',    tone: 'warning', icon: '🟡', help: 'Meta ainda está analisando o ad. Pode levar até 24h.' },
  PREAPPROVED:          { label: 'Quase liberado',     tone: 'warning', icon: '🟡', help: 'Aprovação preliminar do Meta — entrega em breve.' },
  WITH_ISSUES:          { label: 'Com problema',       tone: 'danger',  icon: '🔴', help: 'Meta detectou algo que impede a entrega.' },
  DISAPPROVED:          { label: 'Reprovado',          tone: 'danger',  icon: '🔴', help: 'Meta rejeitou o ad.' },
  CAMPAIGN_PAUSED:      { label: 'Campanha pausada',   tone: 'warning', icon: '⏸️', help: 'A campanha inteira foi pausada.' },
  ADSET_PAUSED:         { label: 'Conjunto pausado',   tone: 'warning', icon: '⏸️', help: 'O ad set específico está pausado.' },
  AD_PAUSED:            { label: 'Anúncio pausado',    tone: 'warning', icon: '⏸️' },
  PENDING_BILLING_INFO: { label: 'Aguardando pagto',   tone: 'warning', icon: '💳', help: 'Problema no método de pagamento.' },
  IN_PROCESS:           { label: 'Processando',        tone: 'neutral', icon: '⏳' },
  ARCHIVED:             { label: 'Arquivado',          tone: 'neutral', icon: '📦' },
  DELETED:              { label: 'Deletado no Meta',   tone: 'neutral', icon: '🗑️' },

  /* Job pipeline do publish worker */
  queued:             { label: 'Aguardando worker…', tone: 'warning', icon: '⏳' },
  uploading_media:    { label: 'Subindo mídia…',     tone: 'warning', icon: '⬆️' },
  creating_campaign:  { label: 'Criando campanha…',  tone: 'warning', icon: '🏗️' },
  creating_adsets:    { label: 'Criando conjuntos…', tone: 'warning', icon: '📦' },
  creating_creatives: { label: 'Criando criativos…', tone: 'warning', icon: '🖼️' },
  creating_ads:       { label: 'Criando anúncios…',  tone: 'warning', icon: '📢' },
};

/* Aliases que aparecem no backend mas remapeiam pra chaves do MAP acima */
const ALIASES = {
  ok: 'active',
  running: 'active',
  done: 'completed',
  success: 'completed',
  error: 'failed',
};

/**
 * Lookup canônico — sempre devolve um objeto válido.
 *
 * Tenta nessa ordem: chave exata → alias → lowercase → fallback neutro.
 *
 * @param {string} key - status (qualquer formato)
 * @returns {{ key, label, tone, icon, help?, color, bg, border, dot }}
 */
export function statusOf(key) {
  const raw = key == null ? '' : String(key).trim();
  const tries = [raw, ALIASES[raw.toLowerCase()], raw.toLowerCase(), raw.toUpperCase()];
  for (const t of tries) {
    if (t && STATUS_MAP[t]) {
      const entry = STATUS_MAP[t];
      const tone = TONE[entry.tone] || TONE.neutral;
      return { key: t, ...entry, ...tone, dot: tone.color };
    }
  }
  /* Fallback seguro pra status desconhecido */
  return {
    key: raw || 'unknown',
    label: raw || '—',
    tone: 'neutral',
    icon: '·',
    help: undefined,
    ...TONE.neutral,
    dot: TONE.neutral.color,
  };
}

/* Atalhos pra casos onde só um campo é necessário */
export const statusLabel = (k) => statusOf(k).label;
export const statusColor = (k) => statusOf(k).color;
export const statusBg    = (k) => statusOf(k).bg;
