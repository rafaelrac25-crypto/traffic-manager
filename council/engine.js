/**
 * Claude Council — moderador de deliberação multi-agente.
 *
 * Cada agente avalia a tarefa em paralelo (mental ou programático) e devolve
 * { agent, verdict: 'APPROVE'|'REJECT', reason }.
 *
 * Decisão final:
 *  - se QUALQUER agente com `criticalVeto: true` rejeita → REJECTED
 *  - senão maioria simples (rejeitos > aprovações → REJECTED, empate → APPROVED)
 *
 * Uso programático (CLI/scripts):
 *   const Council = require('./council/engine');
 *   const result = await Council.deliberate({
 *     task: 'Aumentar orçamento em 30% no anúncio X',
 *     context: { campaign_age_days: 2, ring: 'A' }
 *   });
 *   // result = { decision, opinions, vetoed_by }
 *
 * NOTA: este engine é OPCIONAL pra uso em scripts/checks. A regra MENTAL
 * (Claude/Cursor passar perguntas por Council interno antes de responder)
 * está documentada em COUNCIL.md e vive sem precisar deste arquivo rodar.
 */

const PlannerAgent = require('./agents/planner_agent');
const ValidatorAgent = require('./agents/validator_agent');
const RiskAgent = require('./agents/risk_agent');
const DomainExpertAgent = require('./agents/domain_expert_agent');
const AuditorAgent = require('./agents/auditor_agent');

const DEFAULT_AGENTS = [
  new PlannerAgent(),
  new ValidatorAgent(),
  new RiskAgent(),
  new DomainExpertAgent(),
  new AuditorAgent(),
];

async function deliberate({ task, context = {}, agents = DEFAULT_AGENTS } = {}) {
  if (!task || typeof task !== 'string') {
    return { decision: 'REJECTED', reason: 'task vazia ou inválida', opinions: [] };
  }

  const opinions = await Promise.all(
    agents.map(async (a) => {
      try {
        const op = await a.evaluate({ task, context });
        return { agent: a.name, verdict: op.verdict, reason: op.reason, criticalVeto: a.criticalVeto || false };
      } catch (e) {
        return { agent: a.name, verdict: 'REJECT', reason: `erro interno: ${e.message}`, criticalVeto: true };
      }
    })
  );

  const veto = opinions.find(o => o.criticalVeto && o.verdict === 'REJECT');
  if (veto) {
    return { decision: 'REJECTED', vetoed_by: veto.agent, reason: veto.reason, opinions };
  }

  const rejects = opinions.filter(o => o.verdict === 'REJECT').length;
  const approves = opinions.filter(o => o.verdict === 'APPROVE').length;
  const decision = rejects > approves ? 'REJECTED' : 'APPROVED';
  return { decision, approves, rejects, opinions };
}

function format(result) {
  const lines = ['--- COUNCIL START ---'];
  result.opinions.forEach(o => {
    lines.push(`[${o.agent}] ${o.verdict} — ${o.reason}`);
  });
  lines.push('--- FINAL DECISION ---');
  lines.push(result.decision + (result.vetoed_by ? ` (veto: ${result.vetoed_by})` : ''));
  return lines.join('\n');
}

module.exports = { deliberate, format, DEFAULT_AGENTS };
