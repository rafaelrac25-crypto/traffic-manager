/**
 * metaStatus.js
 * Helper de tradução do effective_status do Meta para o painel PT-BR.
 *
 * effective_status é o estado REAL do anúncio/campanha considerando
 * aprovação Meta — diferente de `status` que é o que o usuário escolheu.
 *
 * Exportado aqui para ser reutilizado tanto no backend (logs, sync)
 * quanto servido via endpoint pro frontend consumir.
 */

const META_EFFECTIVE_STATUS_PT = {
  ACTIVE:         { icon: '🟢', label: 'Ativo (rodando)' },
  PAUSED:         { icon: '⏸',  label: 'Pausado' },
  PENDING_REVIEW: { icon: '🟡', label: 'Em análise pelo Meta' },
  IN_PROCESS:     { icon: '🟡', label: 'Processando no Meta' },
  DISAPPROVED:    { icon: '❌', label: 'Reprovado pelo Meta' },
  WITH_ISSUES:    { icon: '⚠',  label: 'Com problemas' },
  ARCHIVED:       { icon: '📦', label: 'Arquivado' },
  DELETED:        { icon: '🗑',  label: 'Excluído' },
  /* Estados de pausa herdados de nível superior */
  ADSET_PAUSED:    { icon: '⏸', label: 'Pausado (conjunto pausado)' },
  CAMPAIGN_PAUSED: { icon: '⏸', label: 'Pausado (campanha pausada)' },
};

/**
 * Retorna { icon, label } para um effective_status do Meta.
 * Se o status não for reconhecido, retorna fallback genérico.
 *
 * @param {string|null|undefined} effectiveStatus
 * @returns {{ icon: string, label: string }}
 */
function resolveEffectiveStatus(effectiveStatus) {
  if (!effectiveStatus) return { icon: '❓', label: 'Status desconhecido' };
  return META_EFFECTIVE_STATUS_PT[effectiveStatus] || { icon: '❓', label: effectiveStatus };
}

module.exports = { META_EFFECTIVE_STATUS_PT, resolveEffectiveStatus };
