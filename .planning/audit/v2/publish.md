# Re-auditoria Publish/Media/Tests — 2026-04-24

Verificar fixes de hoje (67b83e7, 639a7f7) + cobertura de testes + achados anteriores ainda abertos.

---

## CRÍTICO — Vercel timeout vs vídeo polling

**STATUS: 🔴 RISCO RESIDUAL ALTO**

| Aspecto | Valor | Status |
|---|---|---|
| **Vercel maxDuration** | 60s | ✅ vercel.json:14 |
| **Vídeo maxWaitMs** | 120000ms (120s) | 🔴 metaWrite.js:171 |
| **Conflito** | Vercel mata lambda antes do throw | 💥 TRAVA |
| **Comportamento real** | Lambda morre em 60s, requisição retorna 504 | Sem erro claro |
| **Quando ativa** | Vídeos >10MB ou Meta lento (processamento >60s total) | PROVÁVEL em 1ª campanha real |

**Fix urgente:** Reducir maxWaitMs para 50000 (50s) em metaWrite.js:171:
```javascript
const result = await waitForVideoReady(creds, mainVideoId, { maxWaitMs: 50000 });
```

---

## ✅ Fixes verificados

### 1. Vídeo timeout agora lança
- metaWrite.js:171-177 verifica `!result?.ready` e lança erro com mensagem clara
- Vídeo validado ANTES de criar campaign (cleanupOrphans não lida com órfão de vídeo)
- ✅ Funcionando, MAS timeout 120s > Vercel 60s é problema

### 2. Refactor metaRules — consolidação OK
- Fonte única em frontend/src/config/metaRules.js (191 linhas)
- metaNormalize.js re-exporta pra compat retroativa (linhas 33-41)
- CreateAd importa classifyRings, JOINVILLE_MAX_RADIUS_KM, MIN_DAILY_PER_RING_BRL
- Schema Meta v20 preservado: OUTCOME_*, gender int, budget cents, advantage_audience:0, destination_type
- ✅ Sem regressão

### 3. Tests — 23 vitest em metaRules.test.js
- Cobertura: autoRingsCount (5), classifyRings (5), toMetaBudgetCents (6), constantes (7)
- Testes não triviais — todos com assertiva real
- Backend testes: faltam (seria necessário mock Meta API, ~1-2h setup)
- ✅ Frontend coberto. Backend pode vir depois

---

## NOVOS achados críticos

### 🔴 CRÍTICO

1. **Vercel timeout 60s mata vídeo polling 120s** (descrito acima)
   - Severidade: CRÍTICO — vai acontecer em 1ª campanha real com vídeo
   - Fix: 2 min (reduzir maxWaitMs)

2. **Meta error codes 4 subcodes faltam**
   - Arquivo: backend/src/services/metaErrors.js
   - Faltando: 1870227, 1487891, 2490408, 1815575
   - Impacto: Rafa vê "Parâmetro inválido" em vez de diagnóstico claro
   - Fix: 5 min (adicionar 4 entradas em META_ERROR_MAP)

---

## Achados v1 ainda abertos (14 de 15)

| # | Achado | Status | Fix tempo |
|---|---|---|---|
| 1 | Race condition refresh token | 🟠 Aberto | 15min |
| 2 | Vídeo não-pronto aborta | ✅ FIXADO | ❌ mas timeout problema novo |
| 3 | Polling congelado silenciosamente | 🟠 Aberto | 15min |
| 4 | Sem transação DB após publish | 🟠 Aberto | 30min |
| 5 | Health endpoint mente | 🟠 Aberto | 15min |
| 6 | 50 sinos em sequência | 🟠 Aberto | 20min |
| 7 | Insights por bairro vazio | 🟠 Aberto | 30min |
| 8 | Cleanup logging detalhado | 🟠 Aberto | 5min |
| 9 | CTA WhatsApp silenciosamente vira LEARN_MORE | 🟠 Aberto | UI add |
| 10 | Error codes Meta incompletos | 🟠 Aberto | 5min |
| 11 | Token decryption frágil | 🟠 Aberto | 5min |
| 12 | page_id confundido | 🟠 Aberto | Rename |
| 13 | Interesses fake descartados silenciosamente | 🟠 Aberto | Log |
| 14 | localStorage divergente do banco | 🟠 Aberto | 30min |
| 15 | Webhook signature sem log | 🟡 Aberto | 5min |

**Deles, 3 são CRÍTICOS pra 1ª campanha:**
- #2 (vídeo timeout 120s vs Vercel 60s — NOVO achado)
- #1 (race condition token)
- #3 (polling congelado)

---

## ✅ O que está bem

- Vídeo validado ANTES da campaign
- Throw dispara corretamente em !result?.ready
- Refactor metaRules sem regressão
- 23 testes vitest cobrindo heurística
- Schema Meta v20 completo
- Dedupe geo overlap implementado
- Fallback Joinville quando dedupe esvazia

---

## Recomendação pré-publicação

**ANTES de publicar 1ª campanha real:**

1. 🔴 REDUZIR maxWaitMs de 120000 pra 50000 em metaWrite.js:171 (2min)
2. 🟠 Adicionar 4 error codes Meta em metaErrors.js (5min)
3. 🟠 Promise lock em token refresh (15min)
4. 🟠 Timeout em polling (15min)

Total: ~40 min de work.

**Teste final:** 1 vídeo real >10MB em staging, verify timing.

