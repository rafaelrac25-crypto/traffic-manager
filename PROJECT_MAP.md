# PROJECT_MAP — AdManager Cris Costa Beauty

> **Leia este arquivo antes de qualquer tarefa.** O objetivo dele é permitir que você abra **apenas** os arquivos necessários. Se achar o que procura aqui, não leia o projeto inteiro.

---

## Índice rápido por tarefa

Ao receber uma tarefa sobre X, abra apenas os arquivos da linha correspondente.

| Tarefa                                         | Arquivos a abrir                                                                 |
|------------------------------------------------|----------------------------------------------------------------------------------|
| Notificações (sino, dropdown, badge)           | `src/contexts/AppStateContext.jsx` + `src/App.jsx` (NotificationDropdown)        |
| Sons (sino, chat, splash)                      | `src/utils/sounds.js` (Web Audio API — `playBell`, `playBubble`, `playWelcome`)  |
| Saldo / fundos / investimento                  | `src/contexts/AppStateContext.jsx` + `src/pages/Investment.jsx` + widget em `src/pages/Dashboard.jsx` (`BalanceCard`) |
| Anúncios reprovados + sugestões de correção    | `src/contexts/AppStateContext.jsx` (`addRejectedAd`) + `src/pages/Rejected.jsx` + badge em `src/components/Sidebar.jsx` |
| Conta Meta / avatar sincronizado               | `src/contexts/AppStateContext.jsx` (`metaAccount`) + rodapé em `src/components/Sidebar.jsx` |
| Barra de busca topo + fallback IA              | `src/App.jsx` (`SearchBar`, `SEARCH_MAP`) + `src/components/AIAssistant.jsx` (listener `CustomEvent('ai-ask')`) |
| Chat flutuante IA                              | `src/components/AIAssistant.jsx` (toca `playBubble` nas respostas)               |
| Tema (dark/light) + logo                       | `src/contexts/ThemeContext.jsx` + `src/main.jsx` (ThemeProvider) + logos em `src/assets/marca-{branca,colorida}.png` |
| Layout / sidebar / rotas                       | `src/App.jsx` + `src/components/Sidebar.jsx`                                     |
| Dashboard (cards, gráfico, saldo, alerta CPC)  | `src/pages/Dashboard.jsx` (`BalanceCard`, `CpcAlertCard`, `MOCK_CPC`)            |
| Tabela de anúncios + filtros + paginação       | `src/pages/Campaigns.jsx` (`MOCK_ADS`, `AdRow`, `getCpc`)                        |
| Destaque CPC alto + relatório de performance   | `src/pages/Campaigns.jsx` (`PerformanceReport`, `getPerformanceIssues`, `HIGH_CPR_THRESHOLD`) |
| Wizard "Criar anúncio" (5 passos)              | `src/pages/CreateAd.jsx`                                                         |
| Validação e publicação do anúncio              | `src/pages/CreateAd.jsx` (`validateStep`, `validateAll`, `handlePublish`)        |
| Geofence Joinville (60km)                      | `src/pages/CreateAd.jsx` (`isWithinJoinville`, `JOINVILLE_MAX_RADIUS_KM`)        |
| Normalização Meta (schema v20)                 | `src/utils/metaNormalize.js` (`toMetaPayload`, `newMetaIds`, `GENDER_TO_META`, `CTA_TO_META`, `OBJECTIVE_TO_META`, `OPTIMIZATION_GOAL`, `BILLING_EVENT`) |
| Modal pós-publicação + botão Agendar           | `src/pages/CreateAd.jsx` (`PublishModal`, `isScheduled`, `handlePublish`)        |
| Preview 1080×1350 com sombra fora do 1080×1080 | `src/pages/CreateAd.jsx` (`AdMockFeed`)                                          |
| Calendário mensal                              | `src/pages/Calendar.jsx`                                                         |
| Datas comerciais BR + modal estratégia         | `src/data/commercialDates.js` + `src/pages/Calendar.jsx` (`CommercialDateModal`, `openCommercialModal`, `upcomingCommercial`) |
| Pré-preenchimento CreateAd via data comercial  | `src/pages/CreateAd.jsx` (`useLocation`, `commercialDate`, `initialStart`)       |
| Sugestão de orçamento por data comercial       | `src/data/commercialDates.js` (`suggestedBudget`) + modal `src/pages/Calendar.jsx` |
| Públicos salvos (CRUD)                         | `src/pages/Audiences.jsx` + `src/contexts/AppStateContext.jsx` (`audiences`)     |
| Biblioteca de criativos                        | `src/pages/CreativeLibrary.jsx` + `src/contexts/AppStateContext.jsx` (`creatives`) |
| Referências — 15 estúdios + link Meta Ad Library | `src/pages/References.jsx` + `src/data/adReferences.js` (cada ref tem `adLibraryUrl`) |
| Pixel de rastreamento                          | `src/pages/Investment.jsx` (bloco final) + `src/contexts/AppStateContext.jsx` (`pixel`) |
| Histórico comparativo de datas                 | `src/pages/Dashboard.jsx` (`HistoricalComparisonCard`, `HISTORICAL_COMPARISON`)  |
| Anúncios reais persistidos + ações             | `src/contexts/AppStateContext.jsx` (`ads`, `addAd`, `updateAd`, `duplicateAd`, `toggleAdStatus`, `removeAd`) + `src/pages/Campaigns.jsx` |
| Edição de anúncio existente                    | `src/pages/CreateAd.jsx` (`editId`, `editingAd` via `location.state`)            |
| Bairros de Joinville + anéis de distância      | `src/data/joinvilleDistricts.js` (`HOME_COORDS`, `distanceKm`, `ringByDistance`, `DISTRICT_COORDS`) |
| Splash screen                                  | `src/components/SplashScreen.jsx` (toca `playWelcome` no mount)                  |
| CSS global / classes responsivas               | `src/index.css`                                                                  |
| Backend — CRUD campanhas local                 | `backend/src/routes/campaigns.js` (não escreve no Meta ainda)                    |
| Backend — Conectar plataforma                  | `backend/src/routes/platforms.js` (aceita token cru — sem OAuth ainda)           |
| Backend — IA (rota)                            | `backend/src/routes/ai.js` (proxy Groq/llama)                                    |
| Backend — Meta Ads fetch (só leitura)          | `backend/src/services/metaAds.js`                                                |
| Backend — sync (STUB, não usado)               | `backend/src/services/sync.js` + `backend/src/routes/campaigns.js:126`           |
| Banco de dados                                 | `backend/src/db/index.js` (auto-detecta) + `sqlite.js` / `schema.sql`            |

---

## Rotas ativas (`src/App.jsx`)

| Rota              | Página           |
|-------------------|------------------|
| `/`               | Dashboard        |
| `/anuncios`       | Campaigns        |
| `/campanhas`      | → `/anuncios`    |
| `/reprovados`     | Rejected         |
| `/calendario`     | Calendar         |
| `/publicos`       | Audiences        |
| `/criativos`      | CreativeLibrary  |
| `/referencias`    | References       |
| `/investimento`   | Investment       |
| `/desempenho`     | Reports          |
| `/historico`      | History          |
| `/criar-anuncio`  | CreateAd         |
| `/novo`           | → `/criar-anuncio` |
| `*`               | → Dashboard      |

---

## Estado global (`src/contexts/AppStateContext.jsx`)

Contexto único para estado que atravessa páginas. Persiste em `localStorage`.

| Chave localStorage    | Conteúdo                                                             |
|-----------------------|----------------------------------------------------------------------|
| `ccb_notifications`   | array (máx 50) — `{ id, kind, title, message, link, createdAt, read }` |
| `ccb_rejected_ads`    | array — anúncios reprovados pelo Meta                                |
| `ccb_funds`           | number — saldo atual em R$                                           |
| `ccb_meta_account`    | `{ connected, name, avatarUrl, pageId }`                             |
| `ccb_payment_method`  | cartão ou PIX                                                        |
| `ccb_ads`             | array — anúncios criados pelo usuário (merge com MOCK em Campaigns)  |
| `ccb_audiences`       | array — públicos salvos reutilizáveis                                |
| `ccb_creatives`       | array — biblioteca de textos/títulos                                 |
| `ccb_pixel`           | `{ enabled, pixelId, events: { ViewContent, Lead, Contact, Purchase } }` |
| `ccb_history`         | log leve de ações (create/edit/pause/etc.)                           |
| `ccb_reference_favorites` | array de IDs de referências favoritadas (no próprio References.jsx) |
| `ccb_sounds_disabled` | flag pra silenciar sons (no próprio `utils/sounds.js`)               |

**Regras automáticas:**
- `addNotification` toca `playBell()` (exceto em primeiros 1,5s após mount, evita eco na rehidratação)
- `addRejectedAd` dispara `addNotification({ kind: 'rejected', link: '/reprovados' })`
- `funds < LOW_BALANCE_THRESHOLD` → injeta notificação `kind: 'low-balance'`
- `addFunds` dispara notificação `kind: 'funds'`

**Threshold saldo baixo:** `LOW_BALANCE_THRESHOLD = 20`.

---

## Anúncio salvo (`ads[]`) — estrutura

Campos locais + referências + subtree `meta` pronta pra sync real.

```js
{
  id, adId, createdAt, status, results, clicks, costPerResult, platform, thumbGrad,

  // Dados do wizard (local/retrocompat)
  name, budget, budgetValue, budgetType, startDate, endDate, budgetRingSplit,
  objective, locations, ageRange, gender, interests,
  adFormat, primaryText, headline, destUrl, ctaButton,
  mediaFiles: [{ id, url, type, name }],

  // Referências (não duplicar)
  audienceId, creativeId, referenceId, commercialDateId,
  pixelId, metaAccountId,

  // IDs Meta fake (serão substituídos pelos reais no primeiro sync)
  metaCampaignId, metaAdSetId, metaAdId, metaCreativeId, imageHash,

  // Payload pronto pra Meta Marketing API v20
  meta: {
    campaign: { id, name, objective: 'OUTCOME_*', status, daily_budget_cents, ... },
    ad_set:   { targeting: { geo_locations, age_min, age_max, genders: [1|2], interests: [{id,name}], ... }, optimization_goal, billing_event, ... },
    ad:       { id, name, status, creative: { creative_id } },
    creative: { id, name, object_story_spec: { page_id, link_data: { message, name, link, call_to_action: { type: 'WHATSAPP_MESSAGE'|... }, image_hash, ... } } }
  }
}
```

---

## Design System

- **Accent:** `#C13584` — sempre via `var(--c-accent)`
- **Fonte:** Inter (Google Fonts)
- **Sidebar:** 220px desktop, hamburger ≤1024px
- **Topbar:** 60px sticky, zIndex 50
- **Dark mode:** `data-theme="dark"` no `<html>` via `ThemeContext`
- **Página:** classe `.page-container` (max-width 1400, margin auto, padding 28px)

### Classes CSS utilitárias (em `src/index.css`)

| Classe                  | Função                                        |
|-------------------------|-----------------------------------------------|
| `.page-container`       | Wrapper externo de página                     |
| `.app-wrapper`          | Flex raiz (sidebar + conteúdo)                |
| `.main-content`         | Área direita (margin-left 220px desktop)      |
| `.hide-mobile`          | Esconde em ≤768px                             |
| `.stack-on-mobile`      | Flex column em ≤768px                         |
| `.grid-compact-mobile`  | Grid mais apertado em ≤640px                  |
| `.metric-grid`          | Grid 4 col → 2 em ≤768px                      |
| `.ads-table-wrapper`    | overflow-x: auto na tabela                    |

---

## Comunicação entre componentes

- **SearchBar → AIAssistant:** `window.dispatchEvent(new CustomEvent('ai-ask', { detail: { text } }))`
- **Sidebar / Topbar → AppStateContext:** via `useAppState()`
- **ThemeContext:** só em `src/main.jsx`
- **CreateAd → AppState:** `addAd(payload)` grava no localStorage + atualiza todas as telas que leem `ads`

---

## Integração Meta — estado atual

### ✅ Frontend pronto
- Payload `adPayload.meta` formatado no schema Meta Marketing API v20
- `utils/metaNormalize.js` faz todas as conversões (gender int, budget centavos, objective enum, CTA enum, interests `{id,name}`)
- IDs Meta fake gerados no publish (substituíveis pelo real no sync)
- Geofence Joinville 60km aplicado em busca Nominatim e clique no mapa

### ❌ Backend NÃO pronto
- OAuth 2.0 não existe (`POST /api/platforms/:platform/connect` aceita token cru — inviável)
- Sem `token_expires_at` → sync quebra após 60 dias
- `sync.js` é stub (endpoint retorna `count: 0`)
- Sem write-back (painel não cria/pausa no Meta)
- Sem upload de mídia → sem `image_hash`
- Sem rate limit / error codes Meta
- Falta tabelas `ad_sets`, `ads`, `creatives`, `media`, `insights`

**Estimativa:** 2-3 semanas dev backend full-time.

---

## Mocks atuais (serão substituídos pela Meta Ads API real)

| Lugar                                             | O que é mock                                   |
|---------------------------------------------------|------------------------------------------------|
| `Dashboard.jsx` → `MOCK_METRICS`, `CHART_DATA`    | 4 cards + linha 7 dias                         |
| `Dashboard.jsx` → `MOCK_CPC`, `AVG_CPC`           | Base do card de alerta CPC                     |
| `Dashboard.jsx` → `CALENDAR_EVENTS`               | Eventos mini-calendário                        |
| `Campaigns.jsx` → `MOCK_ADS`                      | 5 anúncios (alimenta destaque CPC e relatório) |
| `Calendar.jsx` → eventos mensais                  | Campanhas agendadas                            |
| `Rejected.jsx` → `seedDemo`                       | Botão que injeta 3 rejeitados de exemplo       |

---

## Deploy

- **Produção:** https://criscosta.vercel.app
- **GitHub:** https://github.com/rafaelrac25-crypto/traffic-manager (branch `main`)
- **Regra crítica:** `frontend/dist/` fica commitado. Sempre `cd frontend && npm run build` antes de commitar
- **Vercel config:** `vercel.json` — `@vercel/node` + `includeFiles: ["frontend/dist/**"]`
- **Cache:** `backend/src/index.js` força `Cache-Control: no-store` no `index.html` (via `app.get('*')` com `express.static({ index: false, setHeaders })`). Garante que HTML novo invalida bundle antigo após deploy

## Variáveis de ambiente (Vercel — Production)

| Variável         | Status                                            |
|------------------|---------------------------------------------------|
| `DATABASE_URL`   | ✅ Neon PostgreSQL (sslmode=require)              |
| `JWT_SECRET`     | ✅                                                |
| `GEMINI_API_KEY` | ⏳ Pendente configurar                            |
| `NODE_ENV`       | ✅ production                                     |
| `FRONTEND_URL`   | ✅ https://criscosta.vercel.app                   |

### Quando for integrar Meta real (ainda não feito)

| Variável              | Vai precisar                                   |
|-----------------------|------------------------------------------------|
| `META_APP_ID`         | App de desenvolvedor Meta                      |
| `META_APP_SECRET`     | App secret                                     |
| `META_REDIRECT_URI`   | `https://<prod>/api/platforms/meta/oauth/callback` |
| `META_API_VERSION`    | `v20.0`                                        |
| `ENCRYPTION_KEY`      | 32 bytes hex — pra encriptar tokens no DB      |

---

## Pendências

| Item                                      | Módulo         | Prioridade                 |
|-------------------------------------------|----------------|----------------------------|
| OAuth 2.0 Meta + token refresh            | Backend        | Alta (bloqueia sync real)  |
| Ativar `sync.js` (hoje stub)              | Backend        | Alta                       |
| Write-back Meta (criar/pausar)            | Backend        | Alta                       |
| Upload de mídia → `image_hash`            | Backend        | Alta                       |
| Tabelas ad_sets / ads / creatives / media | Backend DB     | Alta                       |
| Integração real Google Ads                | Plataformas    | Alta                       |
| Rate limit + error codes Meta             | Backend        | Média                      |
| Encriptar tokens no DB                    | Backend        | Média                      |
| `GEMINI_API_KEY` no Vercel                | IA             | Média                      |
| Gráficos de evolução temporal reais       | Dashboard      | Média                      |
| Code-splitting bundle (~670kB)            | Frontend       | Baixa                      |
| Testes automatizados                      | Tudo           | Baixa                      |

---

## Regras de ouro pra trabalhar neste projeto

1. **Abrir só o necessário.** Use o índice acima — não leia o projeto inteiro
2. **Um módulo por tarefa.** Se o pedido cruzar módulos, liste antes e toque um de cada vez
3. **Estado atravessa páginas? → AppStateContext.** Não criar novo contexto à toa
4. **Mudanças no frontend → `npm run build` antes do commit.** `frontend/dist/` é commitado
5. **Avisos `"use client"` no Vite são falsos.** Projeto é CSR, não Next.js — ignorar
6. **Após cada mudança:** build + commit + push + enviar link de produção
7. **Escopo geográfico:** só Joinville/SC — geofence de 60km é respeitado em `CreateAd`; validar se aplica em novas telas
8. **Formato Meta v20:** novo anúncio já salva `ad.meta` no formato oficial. Ao ler anúncios em outras telas, usar campos **locais** (ads.budget, ads.locations) — `ad.meta` é só pra sync
