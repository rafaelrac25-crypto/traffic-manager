# CRITICAL_STATE — traffic-manager

> **Atualizado:** 2026-04-25 09:02 GMT-3 (todos 11 bugs fechados, rumo aos 100%)
>
> **Pra Claude:** este arquivo é o **estado crítico atual** do sistema. Lê-lo no início de cada sessão evita afirmações erradas. Atualizar no fim de cada sessão se algo mudar.
>
> **Pra Rafa:** raio-X rápido do projeto.

---

## Integrações Meta (`curl https://criscosta.vercel.app/api/health/full`)

| Item | Estado | Detalhe |
|---|---|---|
| Banco Neon | ✅ ok | Conectado |
| Meta Ads | ✅ ok | Conta `act_1330468201431069`, token válido por 57 dias |
| Page Facebook | ✅ ok | `108033148885275` |
| Instagram Business | ✅ ok | `17841456891955614` |
| IA Groq | ✅ ok | Configurado |
| Webhook Meta | ✅ ok | Ativo |
| Health endpoint live | ✅ ok | Bate `/me` no Meta a cada hit (não confia só na flag DB) |

## Env vars Vercel (todas configuradas)

`DATABASE_URL`, `NODE_ENV`, `FRONTEND_URL`, `GROQ_API_KEY`, `FB_APP_ID`, `FB_APP_SECRET`, `FB_WEBHOOK_VERIFY_TOKEN`, `TOKEN_ENC_KEY`, `VITE_SENTRY_DSN`, `SENTRY_DSN` — **todas ✅**.

NÃO afirmar que falta env var sem antes rodar `curl /api/health/full`.

## Última publicação Meta

**Nenhuma campanha real publicada ainda.** Sistema verificado, pronto pra 1ª publicação.

## Bugs corrigidos hoje (2026-04-25) — rumo aos 100%

Commit consolidado: `cc2759c` — fechou os 11 itens abertos.

| # | O que | Arquivo principal |
|---|---|---|
| 1 | Rollback transacional: se INSERT local falhar pós-publishCampaign, deleta no Meta | `backend/src/routes/campaigns.js` |
| 2 | Notificações agrupadas por kind+janela 60s + sino anti-flood 8s (fim dos 50 dings) | `frontend/src/contexts/AppStateContext.jsx` |
| 3 | Insights por bairro: log + `_diagnostics` no payload (era silencioso) | `backend/src/routes/campaigns.js` |
| 4 | Reconciliação localStorage × banco: log de ads "fantasma" descartados | `frontend/src/contexts/AppStateContext.jsx` |
| 5 | cleanupOrphans loga IDs de ad_sets/ads criados antes da falha | `backend/src/services/metaWrite.js` |
| 6 | enforceMessagingCTA detecta por optimization_goal=CONVERSATIONS, não objective genérico | `backend/src/services/metaWrite.js` |
| 7 | 4 codes Meta antes genéricos: 1870227 / 1487891 / 2490408 / 1492013 | `backend/src/services/metaErrors.js` |
| 8 | Token decrypt: regex exata `<b64>:<b64>:<b64>` + helper `safeDecrypt` central | `backend/src/services/crypto.js` (+4 services) |
| 9 | metaPageId em vez de metaAccountId (alias legado mantido) | `frontend/src/pages/CreateAd.jsx`, `metaNormalize.js` |
| 10 | Interesses descartados rastreados em `dropped_interests` no resultado | `backend/src/services/metaWrite.js` |
| 11 | Webhook signature mismatch loga warn explícito (FB_APP_SECRET divergente) | `backend/src/routes/webhooks.js` |

**Bugs corrigidos antes (2026-04-24):** ver commits `dbb7eeb`..`728240d` (polling guard, vídeo abort, token refresh lock, regras Meta consolidadas, health LIVE, Sentry, Vitest, GH Actions, Vercel.json modernizado).

## Bugs conhecidos abertos

**Nenhum.** Os 11 itens da auditoria foram fechados em `cc2759c` (2026-04-25).

Próxima auditoria: rodar `gsd-audit-uat` ou peer review antes da 1ª campanha real.

## Decisões pendentes (aguardando Rafa)

- Plugar `dryRunCreateCampaign` em `metaWrite.js`? (decidido **não** — fica standalone em `project/core/`)
- Feature "recomendação por bairro × serviço" — aguarda 1º sync real Meta + lista de serviços
- Integração real Google Ads — stub (baixa prioridade)

## Arquitetura — referência rápida

- **Backend:** Node + Express + SQLite (dev) / Postgres Neon (prod)
- **Frontend:** React + Vite + Tailwind, Vite build → `frontend/dist/` (commitado)
- **Deploy:** Vercel (criscosta.vercel.app), repo `rafaelrac25-crypto/traffic-manager`
- **Auth:** removida (uso interno)
- **OAuth Meta:** completo, token criptografado AES-256-GCM, refresh automático <15 dias com lock por Promise

## Documentos importantes

- `CLAUDE.md` — instruções pro Claude (regras Cris)
- `~/CLAUDE.md` (global) — gatilho "retomar projeto" inclui `curl /api/health/full`
- `PROJECT_MAP.md` — mapa completo do código (3000+ linhas)
- `STATE_MACHINE.md` — estados Meta e reações do sistema
- `PROTECTION_SETUP.md` — setup Sentry + Vercel email alerts
- `.planning/audit/SUMMARY.md` — auditoria v1 completa
- `.planning/audit/v2/auth.md` — re-auditoria v2 auth/Sentry
- `SESSION_CHECKPOINT.md` — checkpoint manual da última sessão

## Skills/serviços externos

- **Sentry** — ✅ ATIVO front + back. DSN setados. Tokens sanitizados em breadcrumbs. Erros → email rafaelrac25@gmail.com.
- **GitHub Actions** — smoke (15min) + synthetic (diário 09h GMT-3). Issues automáticas em falha.
- **Vercel email alerts** — Rafa precisa ativar em https://vercel.com/account/notifications.
- **Vercel** — deploy automático em push pra `main`. `vercel.json` modernizado roda `npm run vercel-build`.

## Proteções ativas (2026-04-24, fim de sessão)

✅ Health endpoint valida token Meta LIVE
✅ 23 tests Vitest (`npm test`, ~1s)
✅ Smoke test GitHub Actions (a cada 15min)
✅ Synthetic test GitHub Actions (diário 09h GMT-3)
✅ Sentry frontend + backend ATIVO com sanitização de tokens
✅ Vercel.json moderno: env vars propagam automaticamente em deploys
⏳ Vercel email alerts (Rafa precisa ativar manualmente)

## Próximo passo planejado

**100% pronto pra 1ª campanha real.** Sugestões:

1. **Publicar 1ª campanha real** — sistema verificado, todos bugs conhecidos fechados
2. **Ativar Vercel email alerts** — https://vercel.com/account/notifications (1 min, manual)
3. **Aguardar 1º sync real Meta** — destrava feature "recomendação por bairro × serviço"
