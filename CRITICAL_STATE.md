# CRITICAL_STATE — traffic-manager

> **Atualizado:** 2026-04-24 23:35 GMT-3 (checkpoint pré-100%)
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

## Bugs corrigidos hoje (2026-04-24)

| Commit | O que |
|---|---|
| `dbb7eeb` | Polling Meta: guard via useRef pra evitar overlap |
| `67b83e7` | Vídeo: aborta publish se não ficar pronto |
| `3a41b6a` | Token refresh: lock por Promise pra evitar race |
| `639a7f7` | Refactor regras Meta consolidadas em `frontend/src/config/metaRules.js` |
| `095ab2c` | Health endpoint valida token Meta LIVE |
| `91bb641` | Sentry SDK frontend + backend (no-op sem DSN) |
| `9bcf061` | Vitest 23 tests cobrindo metaRules.js |
| `64132d8` | GitHub Actions smoke + synthetic test |
| `28033f3` | Vercel.json modernizado (`@vercel/static-build` roda npm run build) |
| `84cf7c5` | Vídeo timeout 50s respeita Vercel maxDuration 60s |
| `728240d` | Sentry sanitiza tokens em breadcrumbs + try/catch no init |

## Bugs conhecidos abertos (rumo aos 100%)

Após auditoria + re-auditoria, **11 itens em aberto** (nenhum bloqueia 1ª campanha):

### 🟠 Médio impacto — vou atacar agora rumo aos 100%

1. **Sem transação DB após publishCampaign** — Meta cria, INSERT local falha → órfã
2. **50 sinos em massa** ao voltar após dias offline (sem agrupar notifications)
3. **Insights por bairro retorna `[]` silencioso** se locations sem `name`

### 🟡 Baixo impacto / edge case

4. **localStorage divergente do banco** — ad fantasma se backend deletou
5. **Cleanup de órfãos sem logging detalhado** dos ad sets criados
6. **CTA WhatsApp com objetivo "Engajamento" vira LEARN_MORE silencioso**
7. **4 codes Meta caem em "Parâmetro inválido" genérico** (1870227, 1487891, 2490408, 1492013)
8. **Token decryption frágil com `:`** (heurística — risco ~1%)
9. **page_id confundido com metaAccountId em vídeo** (front envia errado, back corrige)
10. **Interesses fake silenciosamente descartados** se Meta não acha
11. **Webhook signature sem log se FB_APP_SECRET mudar** (defensivo)

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

**Rumo aos 100%:** atacar os 11 bugs abertos (3 🟠 + 8 🟡). Ordem prevista:

1. Backend hardening (items 1, 5, 7, 8, 9, 11)
2. Frontend UX (items 2, 6, 10)
3. DB sync (items 3, 4)

Cada um com commit atômico, build/teste antes de push.
