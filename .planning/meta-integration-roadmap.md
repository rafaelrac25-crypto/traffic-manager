# Roadmap — Integração Meta Ads real

**Criado em:** 2026-04-20
**Status atual:** MOCK — write-back, sync real e OAuth não funcionam.
**Objetivo:** deixar o AdManager pronto pra rodar tráfego pago REAL com excelência.

---

## 1. Pré-requisitos externos (fora do código — Rafa precisa preparar)

- [ ] **Business Manager** (business.facebook.com) com Cris Costa Beauty cadastrada
- [ ] **Ad Account** (`act_XXXXXXXXXX`) com cartão/Pix ativo, moeda BRL
- [ ] **Fan Page** FB + **Instagram Business** conectados ao Business Manager
- [ ] **App Facebook** em developers.facebook.com, **modo Live** (não Dev), com Business Verification
- [ ] **App Review aprovado** com permissões:
      `ads_management`, `ads_read`, `business_management`, `pages_show_list`,
      `pages_read_engagement`, `instagram_basic`, `pages_manage_ads`
- [ ] **Pixel do Meta** instalado no destino (site/WhatsApp link) + Events Manager verificado
- [ ] **Domínio verificado** no Business (Brand Safety → Domains) — pós-iOS14 (AEM)
- [ ] **System User** no Business → gerar **token de longa duração (never-expire)** (melhor que token de usuário de 60d)
- [ ] **Webhook subscription** pros eventos `adaccount`, `application/ads`, `ad_review`
- [ ] (Opcional) **CAPI — Conversions API** server-side pra enviar conversões fora do browser

---

## 2. Backend — P0 (blockers pra publicar qualquer real)

### OAuth 2.0 real
- **Remover** `POST /platforms/:platform/connect` que aceita token cru (`backend/src/routes/platforms.js:24-34`)
- **Adicionar:**
  - `GET /platforms/meta/oauth/start` → redireciona pra `https://www.facebook.com/v20.0/dialog/oauth?...`
  - `GET /platforms/meta/oauth/callback` → troca `code` → token curto → `fb_exchange_token` → token longo (ou System User)

### Schema do banco — novas colunas e tabelas (`backend/src/db/schema.sql`)
```sql
-- Em platform_credentials, adicionar:
ALTER TABLE platform_credentials
  ADD COLUMN token_expires_at TIMESTAMP,
  ADD COLUMN token_type VARCHAR(20),
  ADD COLUMN scopes TEXT,
  ADD COLUMN page_id VARCHAR(50),
  ADD COLUMN ig_account_id VARCHAR(50);

-- Novas tabelas:
CREATE TABLE ad_sets (id, campaign_id FK, platform_ad_set_id, name,
                     optimization_goal, billing_event, targeting_json,
                     daily_budget, status, start_time, end_time, ...);
CREATE TABLE ads (id, ad_set_id FK, platform_ad_id, creative_id FK,
                 status, effective_status, ...);
CREATE TABLE creatives (id, platform_creative_id, object_story_spec_json,
                       image_hash, video_id, ...);
CREATE TABLE media (id, type, url, image_hash, video_id, width, height,
                   bytes, uploaded_at);
CREATE TABLE insights (id, entity_type, entity_id, date, spend, clicks,
                      impressions, ctr, cpm, cpc, reach, frequency,
                      actions_json, conversions, updated_at,
                      UNIQUE(entity_type, entity_id, date));
CREATE TABLE insights_by_district (id, ad_id FK, district, date, spend,
                                  clicks, impressions, conversions,
                                  UNIQUE(ad_id, district, date));
CREATE TABLE ad_events (id, ad_id FK, event_type, payload_json, created_at);
```

### Encriptação dos tokens no DB
- Novo `backend/src/services/crypto.js` com `encrypt`/`decrypt` AES-256-GCM
- Chave em `vercel env add TOKEN_ENC_KEY` (32 bytes base64)
- Aplicar em `platforms.js` (write) e `sync.js` (read)

### Upload de mídia
- Novo `backend/src/services/metaMedia.js`:
  - `uploadImage(adAccountId, buffer)` → `POST /{act_id}/adimages` → retorna `image_hash`
  - `uploadVideo(adAccountId, buffer)` → `POST /{act_id}/advideos` → retorna `video_id` (async)
- Integrar no `POST /campaigns` antes de montar `creative`

### Write-back real
- Novo `backend/src/services/metaWrite.js`:
  - `createCampaign`, `createAdSet`, `createCreative`, `createAd`
  - `updateStatus(adId, 'PAUSED'|'ACTIVE')`, `deleteAd(adId)`
- Substituir `fakeMetaId` (em `frontend/src/utils/metaNormalize.js:176`) pelos IDs reais no retorno

### Sync real
- Substituir stub em `backend/src/services/sync.js`
- Expandir `fetchCampaigns` em `metaAds.js` pra incluir `ad_sets`, `ads`, `insights` com `date_preset=last_30d` e `time_increment=1`
- **Breakdown geográfico**: chamar `/insights?breakdowns=region,city` → popular `insights_by_district` → destrava feature de recomendação por bairro

### Rate limit local + error mapping
- `backend/src/services/metaRateLimit.js` (token bucket 200/hora/usuário)
- Ler header `x-business-use-case-usage` da resposta Meta, pausar se >80%
- Tratar códigos de erro Meta:
  - `17` (rate limit) → retry 60s exp backoff
  - `100` (param inválido) → 400 com `error_user_msg`
  - `613` (throttling) → pausa 5min
  - `190` (token inválido) → forçar re-OAuth
  - `200` (permission) → avisar escopo

### Integração Frontend ↔ Backend (hoje tudo é localStorage)
**CRÍTICO:** o frontend armazena ads/audiences/creatives só em `localStorage`. Não chama os endpoints de CRUD. Em produção isso é inviável — dados somem ao limpar cache.
- Criar funções em `frontend/src/services/api.js` pra cada CRUD: `createAd`, `updateAd`, `listAds`, etc.
- Substituir escritas diretas em `AppStateContext.jsx` por chamadas API com cache otimista
- Manter `localStorage` só como cache de leitura/offline

---

## 3. Backend — P1 (necessário pra produção estável)

- [ ] **Webhook receiver** `POST /webhooks/meta` com verify-token (GET challenge) e HMAC-SHA256 via `X-Hub-Signature-256` contra `FB_APP_SECRET`
- [ ] **Refresh token** automático — job diário que renova credenciais com `token_expires_at < now + 7d`
- [ ] **Idempotência** — header de request-id pra evitar duplicatas em retry
- [ ] **Logger estruturado** (`pino`) + middleware de request-id

---

## 4. Backend — P2

- [ ] Retries com jitter exponencial
- [ ] CAPI server-side pra eventos de conversão
- [ ] Cache de insights em memória (5min) pra não estourar rate limit

---

## 5. Frontend — ajustes pra integração real

- [ ] Substituir `/connect` cru por **botão "Conectar com Facebook"** em `Investment.jsx` → popup do OAuth start
- [ ] Badge de **sync status** em `Campaigns.jsx` (`synced_at`, `pending`, `failed`)
- [ ] Mostrar **erro da Meta** no step 5 do CreateAd (ler `error.error_user_title` + `error.error_user_msg`)
- [ ] Tela "Conectar Meta" com countdown do `expires_at` + botão Reconectar
- [ ] Loading + erro state no upload de criativos (`CreativeLibrary.jsx`)
- [ ] **`effective_status` vs `status`** — exibir ambos (ACTIVE/PAUSED vs IN_REVIEW/DISAPPROVED)

---

## 6. Observabilidade

- [ ] Log JSON estruturado (`pino`) com `request_id`, `platform`, `endpoint`, `duration_ms`, `meta_call_count`
- [ ] Métricas de API: contador de chamadas Meta por hora em tabela `meta_usage`
- [ ] Alerta via notificação no sino quando sync falha 2× seguidas
- [ ] Sentry ou Vercel Log Drain pra 5xx

---

## 7. Segurança

- [ ] Tokens encriptados AES-256-GCM (ver P0)
- [ ] `FB_APP_ID`, `FB_APP_SECRET`, `FB_WEBHOOK_VERIFY_TOKEN`, `TOKEN_ENC_KEY` via `vercel env add`
- [ ] HMAC validation nos webhooks
- [ ] Validação server-side com `zod` em `POST /campaigns` (hoje confia no frontend)
- [ ] CSP header: `default-src 'self'; connect-src 'self' https://graph.facebook.com https://www.facebook.com`
- [ ] Rate limit por IP (`express-rate-limit`) em OAuth e webhook
- [ ] Nunca logar `access_token` — redact no logger

---

## 8. Testes manuais mínimos (ordem antes de ativar volume)

1. Conectar via OAuth real → validar que token está **encriptado** no Neon
2. Criar campanha de **R$ 1/dia** com status `PAUSED` → confirmar ID real em `business.facebook.com/adsmanager`
3. Upload de imagem 1080×1080 → validar `image_hash` retornado
4. Ativar campanha (`PAUSED → ACTIVE`) → aguardar review Meta (até 24h)
5. Sync manual → conferir `spend`, `impressions`, `clicks` batendo com Ads Manager
6. Validar breakdown por bairro → `insights_by_district` populado → **ativar feature de recomendação por bairro × serviço** (ver `.planning/pending-features/bairro-recomendacao-investimento.md`)
7. Pausar pelo painel → confirmar pausa no Meta
8. Deletar → confirmar remoção no Meta
9. Testar **rejeição** propositalmente (texto com "garantia") → webhook deve retornar `DISAPPROVED` e UI atualizar
10. Expirar token manualmente (setar `expires_at` no passado) → UI deve pedir reconexão sem quebrar

---

## 9. Fix rápidos já aplicados (2026-04-20)

- ✅ `ThemeContext` migrado pra `ccb_theme` (padrão de prefixo)
- ✅ Pill "Personalizado" do CTA agora abre prompt
- ✅ Status `review/review` ternary inútil removido
- ✅ CLAUDE.md atualizado — removido `GEMINI_API_KEY` (substituído por `GROQ_API_KEY`) e `JWT_SECRET` (auth desabilitada); adicionado Meta/encrypt keys

---

## 10. Arquivos-chave pra tocar durante implementação

```
backend/src/routes/platforms.js           # OAuth flow
backend/src/services/metaAds.js           # leitura Meta
backend/src/services/metaMedia.js         # NOVO — upload mídia
backend/src/services/metaWrite.js         # NOVO — write-back
backend/src/services/sync.js              # sync real (hoje stub)
backend/src/services/crypto.js            # NOVO — encript tokens
backend/src/services/metaRateLimit.js     # NOVO — rate limit
backend/src/routes/webhooks.js            # NOVO — webhook receiver
backend/src/db/schema.sql                 # novas tabelas
frontend/src/services/api.js              # novas funções CRUD
frontend/src/contexts/AppStateContext.jsx # trocar localStorage por API
frontend/src/utils/metaNormalize.js       # substituir fakeMetaId
frontend/src/pages/Investment.jsx         # botão conectar Meta
frontend/src/pages/Campaigns.jsx          # badge sync status
frontend/src/pages/CreateAd.jsx           # erro Meta no publish
```
