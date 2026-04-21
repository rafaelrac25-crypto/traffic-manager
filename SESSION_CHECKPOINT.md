# 🎯 Checkpoint de sessão — 2026-04-21

**Última atualização:** 2026-04-21 fim do dia
**Produção:** https://criscosta.vercel.app
**Commit HEAD:** `c79c601`

---

## 📍 Onde paramos

Sistema está **100% integrado com o Meta real**. Leitura, escrita, saldo, upload de mídia — tudo funcional.
**Apenas 1 bloqueio externo:** a conta Meta da Cris está com `spend_cap = amount_spent` (R$ 2.425,54), por isso a campanha `Cris-Whats-Aberto-joinvilel` está pausada. Resolvível adicionando crédito/limite pelo botão "Adicionar crédito no Meta" na página de Investimento.

---

## ✅ Entregas desta sessão (2026-04-21)

### Integração Meta completa (leitura + escrita)
- **OAuth 2.0 real** — `/api/platforms/meta/oauth/start` e callback
- **Token encriptado** no Neon via AES-256-GCM (`TOKEN_ENC_KEY`)
- **Auto-sync 40s** (~90 syncs/h, sob o teto 200 calls/h do Meta)
- **Guard anti-overlap** — se o sync anterior não terminou, o próximo pula
- **Notificação no sino** 🔔 quando sync falha (dedup 10 min)
- **Botão manual "🔄 Sincronizar agora"** no card Meta

### Write-back funcional
- **Pausar/Ativar/Excluir** qualquer campanha aqui → espelha no Meta real
- **Criar campanha pelo wizard `/criar-anuncio`**:
  - Upload de imagem (base64 → `/adimages` → `image_hash` real)
  - Cria Campaign → AdSet → Creative → Ad em cascata
  - Status inicial sempre PAUSED (segurança)
  - Salva `platform_campaign_id` real no banco
- **Link direto Meta Billing** no card de saldo

### Saldo real Meta
- **Endpoint `/api/platforms/meta/billing`** — puxa `balance`, `amount_spent`, `spend_cap`, `currency`, `account_status`
- **Dashboard**: card de saldo usa dados reais do Meta
- **Investimento**: saldo em destaque no topo + botão adicionar crédito
- Atualiza a cada 30s

### Limpeza de mocks
- Removido `MOCK_ADS` (5 ads fake) de Campaigns
- Removido `MOCK_METRICS`, `CHART_DATASETS`, `MOCK_CPC`, `HISTORICAL_COMPARISON` de Dashboard
- Dashboard agora agrega dados reais dos `ads`
- `computeHighCpcAds(ads)` calcula CPC real (spent/clicks)
- `computeRealMetrics(ads)` soma gasto/cliques/conversões reais
- HeatMap mostra empty state até termos breakdown por bairro real
- RingPerformanceTeaser removido
- `DEFAULT_AUDIENCES` zerado (sem públicos demo)
- `Campaigns.jsx` linha de budget corrigida: `R$ 17,21 / dia` (antes era `17.21,00 /dia` confuso)

### Simplificação da página Investimento
- ❌ Removido: formulário cartão, formulário PIX, "adicionar fundos", saldo local fake
- ✅ Novo card de saldo Meta real
- ✅ Botão "💳 Adicionar crédito no Meta" (abre Billing Hub em nova aba)
- ✅ Card "Facebook/Instagram Ads" com IDs + status
- ✅ Pixel (opcional) — mantido

### Infra backend (novos services)
- `backend/src/services/crypto.js` — AES-256-GCM
- `backend/src/services/metaErrors.js` — códigos Meta em PT-BR
- `backend/src/services/metaRateLimit.js` — token bucket
- `backend/src/services/metaMedia.js` — upload de imagem
- `backend/src/services/metaWrite.js` — CRUD Meta (update, delete, publishCampaign)
- `backend/src/routes/webhooks.js` — endpoint webhook Meta com HMAC-SHA256

### Novas tabelas (já criadas no Neon)
- `ad_sets`, `ads`, `creatives`, `media`, `insights`, `insights_by_district`
- Colunas novas em `platform_credentials`: `token_expires_at`, `token_type`, `scopes`, `page_id`, `ig_business_id`

### URL customizada + favicon
- `criscosta.vercel.app` (antiga era `traffic-manager-five.vercel.app`)
- Favicon customizado

---

## 🚀 Próximos passos (quando Rafa voltar)

### O que Rafa pode fazer
1. **Adicionar crédito/aumentar limite no Meta** (clicando no botão da página Investimento)
2. **Reativar a campanha `Cris-Whats-Aberto-joinvilel`** pelo painel (clica "Ativar")
3. **Testar publicação end-to-end**: criar campanha nova R$ 5/dia, 1 bairro, 1 imagem → confere no Ads Manager se chegou

### O que ainda posso implementar (se Rafa pedir)
1. **Gráfico temporal no Dashboard** — endpoint `/api/campaigns/insights/daily` + consumir no frontend (hoje mostra empty state)
2. **HeatMap com insights por bairro** — adicionar `breakdowns=region,city` no sync + popular `insights_by_district`
3. **Edição de orçamento e targeting** direto do painel (update Campaign/AdSet)
4. **Upload de vídeo** (hoje só imagem)
5. **Agendamento de campanha** integrado (hoje só imediato)

---

## 📁 Arquivos-chave desta sessão

```
backend/src/services/crypto.js        ← novo — AES-256-GCM
backend/src/services/metaErrors.js    ← novo — mapping de códigos
backend/src/services/metaRateLimit.js ← novo — token bucket
backend/src/services/metaMedia.js     ← novo — upload imagem
backend/src/services/metaWrite.js     ← novo — CRUD Meta
backend/src/services/sync.js          ← expandido — sync com insights
backend/src/services/metaAds.js       ← expandido — fetch completo
backend/src/routes/platforms.js       ← expandido — OAuth + billing
backend/src/routes/campaigns.js       ← expandido — write-back pausar/ativar/delete/create
backend/src/routes/webhooks.js        ← novo — webhook Meta
backend/src/db/schema.sql             ← expandido — 6 tabelas novas
backend/src/db/sqlite.js              ← expandido — migração automática
backend/src/db/migrate.js             ← novo — migração PG
frontend/src/pages/Investment.jsx     ← reescrito — só Meta + Pixel
frontend/src/pages/Dashboard.jsx      ← limpo — métricas reais
frontend/src/pages/Campaigns.jsx      ← limpo — só dados reais
frontend/src/pages/CreateAd.jsx       ← expandido — upload + publicação real
frontend/src/pages/HeatMap.jsx        ← empty state — aguarda insights reais
frontend/src/contexts/AppStateContext.jsx ← auto-sync 40s global
```

---

## 🗂 Env vars em uso (Vercel Production)

| Variável | Valor/Propósito |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL |
| `NODE_ENV` | production |
| `FRONTEND_URL` | https://criscosta.vercel.app |
| `GROQ_API_KEY` | Chat IA |
| `FB_APP_ID` | 981234404427824 |
| `FB_APP_SECRET` | (secreto — Vercel) |
| `FB_AD_ACCOUNT_ID` | act_1330468201431069 |
| `TOKEN_ENC_KEY` | (32 bytes base64) |
| `FB_WEBHOOK_VERIFY_TOKEN` | ccb_webhook_1a45f78f… |

---

## 🗂 Estado do repositório

**Branch:** main, limpa (exceto prints em `problema/` não rastreados — não críticos)
**Sincronizada com origin.**

Para retomar: mande "retomar projeto" — o CLAUDE.md global executa o fluxo.
