# CRITICAL_STATE — traffic-manager

> **Atualizado:** 2026-04-25 09:43 GMT-3 (insights por anel + edição público + recomendação automática)
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

## Features novas hoje (2026-04-25) — pós-bugs

Commits: `d5a10a9` (insights por anel) + `6250a17` (edição público + recomendação).

| Feature | O que faz | Arquivo principal |
|---|---|---|
| **Insights por ad_set** | Sync coleta métricas POR anel + breakdown region/city do Meta. Popula `insights_by_district` com dado real. | `backend/src/services/sync.js`, `metaAds.js` |
| **`GET /analytics/districts` real** | Tenta dado real primeiro; fallback equitativo se vazio. Devolve `data_source: 'real' \| 'estimated'`. | `backend/src/routes/campaigns.js` |
| **`GET /analytics/rings` (novo)** | Performance agregada por anel (primário/médio/externo) — sempre 3 entradas. | `backend/src/routes/campaigns.js` |
| **Card "Performance por anel"** | 3 colunas no Dashboard com investido/conversões/CPR. 🏆 destaca menor CPR. Refetch 5min. Empty state amigável. | `frontend/src/pages/Dashboard.jsx` |
| **HeatMap badge real/estimativa** | Pill verde "Dado real do Meta" vs amarelo "Estimativa (~24h)". Empty state com CTA "Publicar campanha". | `frontend/src/pages/HeatMap.jsx` |
| **Recomendação automática %** | Card sob o RingPerformanceCard sugere nova distribuição inversamente proporcional ao CPR (piso 10%, múltiplos 5%). Botão "Aplicar nas campanhas ativas". | `frontend/src/components/RingRecommendation.jsx` |
| **Edição de público pós-pub** | Modal inline em Campaigns: faixa etária, gênero, interesses (chips + busca debounced). Aplica nos 3 anéis simultaneamente, bairros não mudam. | `frontend/src/pages/Campaigns.jsx`, `EditAudienceModal` |
| **Endpoint busca interesses** | `GET /api/platforms/meta/search-interests?q=...` autocomplete via Meta `/search?type=adinterest`. | `backend/src/routes/platforms.js` |
| **Migração schema** | `insights_by_district` ganha `ad_set_id`, `ring_key`, `region`, `city` + 2 índices. Idempotente. | `backend/src/db/{schema.sql,sqlite.js}` |
| **Backend `updateAdSetMeta` estendido** | Aceita `targeting` + `status` (além de budget/datas/nome). Caller monta targeting reconciliado. | `backend/src/services/metaWrite.js` |
| **PUT /campaigns/:id estendido** | Aceita `targeting` (patch parcial) e `ringSplit` (redistribuição entre anéis). Erro Meta = 502 com mensagem. | `backend/src/routes/campaigns.js` |

> **Como o sistema publica anéis (confirmado com gestor de tráfego):** 1 campanha → N ad_sets (até 3 anéis primário/médio/externo), cada um com seus bairros + orçamento próprio. ABO é default (`is_adset_budget_sharing_enabled=false`). O método é exatamente o que profissionais de tráfego usam manualmente — automatizado.

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
