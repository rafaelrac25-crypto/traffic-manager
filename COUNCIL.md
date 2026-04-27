# Claude Council — traffic-manager

Council adaptado pro contexto de **gestão de tráfego pago da Cris Costa Beauty (Joinville)**.

## Por que existe

Toda decisão não-trivial passa por avaliação multi-agente antes da ação final. Evita:
- Aumentar orçamento em campanha em fase de aprendizado (reseta algoritmo Meta)
- Mexer em criativos (pertencem a `cris-costa-criativos`, não aqui)
- Segmentar fora de Joinville
- Afirmar "campanha está bem" sem dado fresco
- Trocar criativo cedo demais (freq baixa = público não saturou)

## 5 agentes

| Agente | Pergunta | Veto crítico |
|---|---|---|
| **Planner** | Tarefa clara? Tem objeto e critério? | ❌ |
| **Validator** | Consistente com regras duras (Joinville, fase aprendizado, decisões registradas)? | ✅ **VETO** |
| **Risk Reviewer** | Ação destrutiva? Viola isolamento criativos × AdManager? | ✅ **VETO** |
| **Domain Expert** | Gestor de tráfego aprovaria (freq, CPC, saturação)? | ❌ |
| **Auditor de Verdade** | Está afirmando dado real ou extrapolando? | ❌ |

**Regra de decisão:** se Validator OU Risk Reviewer rejeita → REJECTED, sem maioria que salva. Senão, maioria simples.

## Quando expor visualmente

✅ **Mostrar bloco `--- COUNCIL START ---`:**
- Decisão de orçamento, novo criativo, mudança de targeting
- Pedido ambíguo ou com tradeoffs (CBO vs ABO, expandir público, etc)
- Pergunta sobre estado da campanha sem dado fresco

❌ **Council mental, sem bloco visível:**
- Pedido trivial ("rebuilda frontend", "lista campanhas ativas")
- Continuação direta de fluxo já aprovado
- Saudação, "ok", "obrigado"

## Uso programático (opcional)

```javascript
const Council = require('./council/engine');

const result = await Council.deliberate({
  task: 'Aumentar orçamento da campanha A em 30%',
  context: { campaign_age_days: 2, frequency: 1.4, ring: 'A' }
});

console.log(Council.format(result));
// --- COUNCIL START ---
// [Planner] APPROVE — intenção legível
// [Validator] REJECT — campanha tem 2d (<7d) — aumentar orçamento >20% reseta aprendizado Meta
// [Risk Reviewer] APPROVE — sem ação destrutiva
// [Domain Expert (Gestor de Tráfego)] APPROVE — alinhado com prática
// [Auditor de Verdade] APPROVE — claim verificável
// --- FINAL DECISION ---
// REJECTED
```

Engine programático é opcional — a regra mental (Claude passar perguntas por Council interno antes de responder) é o que vale no dia-a-dia.

## Isolamento

- Council aqui (traffic-manager) é **independente** do Council em `cris-costa-criativos`.
- Mesma cliente (Cris Costa Beauty), projetos diferentes.
- Nenhum dos dois pode modificar o outro.
- Implementação aqui é especializada em **gestor de tráfego pago**; lá é especializada em **design/criativos**.

## Estrutura

```
traffic-manager/
├── COUNCIL.md             ← este arquivo
└── council/
    ├── engine.js          ← moderador
    └── agents/
        ├── planner_agent.js
        ├── validator_agent.js
        ├── risk_agent.js              ← veto crítico
        ├── domain_expert_agent.js
        └── auditor_agent.js
```

## Referências

- Regra mental global: `C:\Users\Rafa\CLAUDE.md` (instituída 2026-04-27)
- Memória persistente: `C:\Users\Rafa\.claude\projects\C--Users-Rafa\memory\feedback_council_for_all_questions.md`
- Council irmão (não tocar): `C:\Users\Rafa\cris-costa-criativos\` (projeto isolado)
