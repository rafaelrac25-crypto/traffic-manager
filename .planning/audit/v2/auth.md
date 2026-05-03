# Re-auditoria Auth/Token/Sentry — 2026-04-24

## Fixes aplicados — verificação

**🟢 Race refresh token: IMPLEMENTADO CORRETAMENTE**
- Lock via Map + Promise compartilhada em `metaToken.js:62-114`
- `finally` garante `Map.delete()` SEMPRE, mesmo em error
- Edge case validado: rejeição de promise não causa deadlock, apenas múltiplos refreshes independentes
- Sem vazamento de lock, sem trava infinita

**🟢 Sentry init: ORDEM CORRETA**
- `initSentry()` chamado ANTES de `require('express')` em `index.js:7`
- No-op silencioso quando `SENTRY_DSN` ausente (variável `initialized` permanece `false`)
- `setupExpressErrorHandler()` após rotas em `index.js:77` ✓
- Integrações configuradas corretamente (`httpIntegration()`, `expressIntegration()`)

---

## NOVOS achados (não viram na auditoria anterior)

**🔴 SENTRY EXPÕE TOKENS EM BREADCRUMBS**
- `metaToken.js:85`: URL do refresh contém `fb_exchange_token=${currentToken}` plaintext
- `platforms.js:199,204`: URLs de OAuth contêm `fb_exchange_token` e `code` plaintext
- **Cenário:** Se `httpsGet()` lança erro (timeout, rede), error stack flui pra Sentry → URL inteira (com token) capturada em breadcrumb
- **Severidade:** 🔴 CRÍTICO se Sentry está ativo em produção
- **Probabilidade:** Média (httpsGet só falha em rede lenta ou indisponibilidade)
- **Impacto:** Token exposto em dashboard Sentry público/compartilhado = Rafa pode esbarrar, terceiros se fizerem SSO

**Recomendação:** 
1. Usar `metaPost()` (body) em vez de query param pra OAuth token exchange
2. OU implementar sanitizer de breadcrumb Sentry que esconde `access_token`, `fb_exchange_token`, `code` em URLs

---

**🟡 RACE CONDITION: Health live call durante refresh**
- `health.js:87-90`: nova validação `metaGet('/me')` com token DURANTE refresh em curso
- **Cenário:** 
  1. Billing call inicia `refreshIfNeeded()` → lock ativo → waiting fb_exchange_token
  2. Ao mesmo tempo, `GET /api/health/full` chamado
  3. Health lê creds ANTIGOS do banco (token pré-refresh)
  4. Health chama `metaGet('/me')` com token antigo → falha (token expirado)
  5. Erro dispara `markNeedsReconnect()` (sucesso)
  6. Refresh completa com token novo → insere no banco
  7. **Resultado:** Banco tem token novo MAS flag `needs_reconnect=1` (confusão)
- **Severidade:** 🟡 MÉDIO — não é deadlock, mas estado inconsistente transiente
- **Probabilidade:** Baixa (requer timing exato: health call enquanto refresh em andamento <15dias do vencimento)

**Recomendação:** 
- Health não deve chamar `metaGet()` durante `refreshIfNeeded()` em andamento OU
- Usar lock compartilhado entre health + refresh (ambos respeitam `refreshLocks.has(platform)`)

---

**🟠 SENTRY.INIT() NÃO VALIDADO — PODE LANÇAR EXCEPTION**
- `sentry.js:22` chama `Sentry.init({ dsn, ... })` SEM try/catch
- Se `SENTRY_DSN` está setado mas inválido (ex: `"not_a_url"`), Sentry pode lançar erro síncrono
- Exception não capturada quebraria `index.js` inteiro durante startup
- **Severidade:** 🟠 ALTO — break on startup
- **Probabilidade:** Baixa (admin tiparia DSN errado, raro)

**Recomendação:** Envolver `initSentry()` em try/catch em `index.js:7`
```javascript
try {
  initSentry();
} catch (e) {
  console.error('[startup] Sentry init falhou, continuando sem Sentry:', e.message);
}
```

---

## Achados anteriores ainda abertos

De SUMMARY.md — verificação de mudança:

**🔴 #1 Race condition no refresh** — FIXADO (lock + finally) ✓

**🔴 #2 Vídeo não-pronto não aborta publicação** — NÃO MENCIONADO em mudanças hoje (ainda existe em `metaWrite.js`)

**🔴 #3 Polling Meta pode congelar** — NÃO ALTERADO em mudanças hoje (ainda existe em `AppStateContext.jsx`)

**🟠 #5 Health endpoint mente quando token revogado** — PARCIALMENTE FIXADO
- Agora há live call `metaGet('/me')` em `health.js:87-90` ✓
- MAS introduz nova race condition com refresh (🟡 acima)

---

## Resumo executivo

**ESTADO:** Fixes de race condition implementados corretamente (lock + finally). PORÉM:
- **1 risco 🔴 novo:** Sentry expõe tokens em breadcrumbs via URL plaintext
- **1 risco 🟠:** Sentry.init() não validado, pode quebrar startup
- **1 risco 🟡 novo:** Health live call racing com refresh (estado inconsistente transiente)

**RECOMENDAÇÃO ANTES DE PUBLICAR 1ª CAMPANHA:**
1. **Urgente** (5min): Envolver `initSentry()` em try/catch
2. **Urgente** (15min): Sanitizar breadcrumbs Sentry ou mover token/code pra body (POST em vez de GET)

**PRONTO PRA PUBLICAR?** Não — saneamento de token em breadcrumb é obrigatório antes de ir ao ar com Sentry ativo. Caso contrário, desabilite `SENTRY_DSN` em produção até corrigir.

