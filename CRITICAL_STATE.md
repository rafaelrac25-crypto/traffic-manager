# CRITICAL_STATE — traffic-manager

> **Atualizado:** 2026-04-24 21:55 GMT-3
>
> **Pra Claude:** este arquivo é o **estado crítico atual** do sistema. Lê-lo no início de cada sessão evita afirmações erradas (tipo "falta env var X" quando já está setada). Atualizar no fim de cada sessão se algo mudar.
>
> **Pra Rafa:** este é o "raio-X" rápido do projeto. Se algo aqui está errado, me avise.

---

## Integrações Meta (verificar via `curl https://criscosta.vercel.app/api/health/full`)

| Item | Estado | Detalhe |
|---|---|---|
| Banco Neon | ✅ ok | Conectado |
| Meta Ads | ✅ ok | Conta `act_1330468201431069`, token válido por 57 dias |
| Page Facebook | ✅ ok | `108033148885275` |
| Instagram Business | ✅ ok | `17841456891955614` |
| IA Groq | ✅ ok | Configurado |
| Webhook Meta | ✅ ok | Ativo |

## Env vars Vercel (todas configuradas)

`DATABASE_URL`, `NODE_ENV`, `FRONTEND_URL`, `GROQ_API_KEY`, `FB_APP_ID`, `FB_APP_SECRET`, `FB_WEBHOOK_VERIFY_TOKEN`, `TOKEN_ENC_KEY` — **todas ✅**.

Desde 2026-04-24, NÃO afirmar que falta env var sem antes rodar `curl /api/health/full`.

## Última publicação Meta

**Nenhuma campanha real publicada ainda.** Sistema testado em dev, pronto pra 1ª publicação.

## Bugs corrigidos recentes (últimos 7 dias)

| Data | Commit | O que |
|---|---|---|
| 2026-04-24 | `dbb7eeb` | Polling Meta: guard via useRef pra evitar overlap |
| 2026-04-24 | `67b83e7` | Vídeo: aborta publish se não ficar pronto em 120s |
| 2026-04-24 | `3a41b6a` | Token refresh: lock por Promise pra evitar race |
| 2026-04-24 | `639a7f7` | Refactor regras Meta consolidadas em `frontend/src/config/metaRules.js` |
| 2026-04-22 | `c31bfff` | normalizeSplit força 100% pra 1 anel + auto mais conservador |
| 2026-04-22 | `34c9951` | Sino notifica em revisão / aprovado / reprovado pós-revisão |

## Bugs conhecidos (abertos)

Ver auditoria completa em `.planning/audit/SUMMARY.md`. Resumo dos principais:

- 🟠 **Sem transação DB após publishCampaign** — se INSERT local falha após Meta criar, vira órfão
- 🟠 **50 ads aprovados = 50 sinos** — sem agrupar notificações em massa
- 🟠 **Insights por bairro retorna vazio em silêncio** se locations sem `name`
- 🟡 **Cleanup de órfãos sem logging detalhado** dos ad_sets criados
- 🟡 **CTA messaging com objetivo errado vira LEARN_MORE silenciosamente**
- 🟡 **Cobertura incompleta de error codes Meta** (1870227, 1487891, 2490408, 1492013)

## Decisões pendentes (aguardando Rafa)

- Plugar `dryRunCreateCampaign` em `metaWrite.js` antes da chamada Graph real? (decidido **não plugar agora** — `validation_engine`/`dry_run_simulator` ficam standalone em `project/core/`)
- Implementar feature "recomendação de investimento por bairro × serviço" — aguardando 1º sync real Meta + lista de serviços da Cris
- Integração real Google Ads — ainda stub (baixa prioridade)

## Arquitetura — referência rápida

- **Backend:** Node + Express + SQLite (dev) / Postgres Neon (prod)
- **Frontend:** React + Vite + Tailwind, Vite build → `frontend/dist/` (commitado)
- **Deploy:** Vercel (criscosta.vercel.app), GitHub repo `rafaelrac25-crypto/traffic-manager`
- **Auth:** removida (sistema interno, abre direto no Dashboard)
- **OAuth Meta:** completo, token criptografado AES-256-GCM no banco, refresh automático <15 dias

## Documentos importantes

- `CLAUDE.md` — instruções principais pro Claude
- `PROJECT_MAP.md` — mapa completo do código (3000+ linhas, longo)
- `STATE_MACHINE.md` — estados Meta e reações do sistema
- `SESSION_CHECKPOINT.md` — checkpoint manual da última sessão
- `.planning/audit/SUMMARY.md` — auditoria completa Meta (2026-04-24)
- `.planning/audit/auth.md`, `publish.md`, `sync.md` — auditorias detalhadas (não criadas — agentes entregaram inline)

## Skills/serviços externos

- **Sentry** — configurado em código, **DSN ainda não setado** (Rafa precisa criar projeto + adicionar `SENTRY_DSN` na Vercel)
- **GitHub Actions** — smoke test (a cada 15min) + synthetic test (diário)
- **Vercel** — deploy automático em push pra `main`
