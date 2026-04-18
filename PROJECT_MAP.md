# PROJECT_MAP — AdManager Cris Costa Beauty

> **Leia este arquivo antes de qualquer tarefa.** O objetivo dele é permitir que você abra **apenas** os arquivos necessários. Se achar o que procura aqui, não leia o projeto inteiro.

---

## Índice rápido por tarefa

Ao receber uma tarefa sobre X, abra apenas os arquivos da linha correspondente.

| Tarefa                                         | Arquivos a abrir                                                                 |
|------------------------------------------------|----------------------------------------------------------------------------------|
| Notificações (sino, dropdown, badge)           | `src/contexts/AppStateContext.jsx` + `src/App.jsx` (NotificationDropdown)        |
| Saldo / fundos / investimento                  | `src/contexts/AppStateContext.jsx` + `src/pages/Investment.jsx` + widget em `src/pages/Dashboard.jsx` (`BalanceCard`) |
| Anúncios reprovados + sugestões de correção    | `src/contexts/AppStateContext.jsx` (`addRejectedAd`) + `src/pages/Rejected.jsx` + badge em `src/components/Sidebar.jsx` |
| Conta Meta / avatar sincronizado               | `src/contexts/AppStateContext.jsx` (`metaAccount`) + rodapé em `src/components/Sidebar.jsx` |
| Barra de busca topo + fallback IA              | `src/App.jsx` (`SearchBar`, `SEARCH_MAP`) + `src/components/AIAssistant.jsx` (listener `CustomEvent('ai-ask')`) |
| Chat flutuante IA                              | `src/components/AIAssistant.jsx`                                                 |
| Tema (dark/light) + logo                       | `src/contexts/ThemeContext.jsx` + `src/main.jsx` (ThemeProvider) + logos em `src/assets/marca-{branca,colorida}.png` |
| Layout / sidebar / rotas                       | `src/App.jsx` + `src/components/Sidebar.jsx`                                     |
| Dashboard (cards, gráfico, saldo, alerta CPC)  | `src/pages/Dashboard.jsx` (`BalanceCard`, `CpcAlertCard`, `MOCK_CPC`)            |
| Tabela de anúncios + filtros + paginação       | `src/pages/Campaigns.jsx` (`MOCK_ADS`, `AdRow`)                                  |
| Destaque CPC alto + relatório de performance   | `src/pages/Campaigns.jsx` (`PerformanceReport`, `getPerformanceIssues`, `HIGH_CPR_THRESHOLD`) |
| Wizard "Criar anúncio" (6 passos)              | `src/pages/CreateAd.jsx`                                                         |
| Modal pós-publicação + botão Agendar           | `src/pages/CreateAd.jsx` (`PublishModal`, `isScheduled`, `handlePublish`)        |
| Preview 1080×1350 com sombra fora do 1080×1080 | `src/pages/CreateAd.jsx` (`AdMockFeed`)                                          |
| Calendário mensal                              | `src/pages/Calendar.jsx`                                                         |
| Datas comerciais BR + modal estratégia         | `src/data/commercialDates.js` + `src/pages/Calendar.jsx` (`CommercialDateModal`, `openCommercialModal`, `upcomingCommercial`) |
| Pré-preenchimento CreateAd via data comercial  | `src/pages/CreateAd.jsx` (`useLocation`, `commercialDate`, `initialStart`)       |
| Sugestão de orçamento por data comercial       | `src/data/commercialDates.js` (`suggestedBudget`) + modal `src/pages/Calendar.jsx` |
| Públicos salvos (CRUD)                         | `src/pages/Audiences.jsx` + `src/contexts/AppStateContext.jsx` (`audiences`)     |
| Biblioteca de criativos                        | `src/pages/CreativeLibrary.jsx` + `src/contexts/AppStateContext.jsx` (`creatives`) |
| Pixel de rastreamento                          | `src/pages/Investment.jsx` (bloco final) + `src/contexts/AppStateContext.jsx` (`pixel`) |
| Histórico comparativo de datas                 | `src/pages/Dashboard.jsx` (`HistoricalComparisonCard`, `HISTORICAL_COMPARISON`)  |
| Anúncios reais persistidos + ações             | `src/contexts/AppStateContext.jsx` (`ads`, `addAd`, `updateAd`, `duplicateAd`, `toggleAdStatus`, `removeAd`) + `src/pages/Campaigns.jsx` |
| Edição de anúncio existente                    | `src/pages/CreateAd.jsx` (`editId`, `editingAd` via `location.state`)            |
| Splash screen                                  | `src/components/SplashScreen.jsx`                                                |
| CSS global / classes responsivas               | `src/index.css`                                                                  |
| Backend — CRUD campanhas                       | `backend/src/routes/campaigns.js`                                                |
| Backend — alertas WhatsApp                     | `backend/src/routes/alerts.js` + `backend/src/services/whatsapp.js` + `backend/src/services/budgetAlert.js` |
| Backend — IA (rota)                            | `backend/src/routes/ai.js`                                                       |
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
| `/investimento`   | Investment       |
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
| `ccb_ads`             | array — anúncios criados pelo usuário (merge com MOCK em Campaigns) |
| `ccb_audiences`       | array — públicos salvos reutilizáveis                                |
| `ccb_creatives`       | array — biblioteca de textos/títulos                                 |
| `ccb_pixel`           | `{ enabled, pixelId, events: { ViewContent, Lead, Contact, Purchase } }` |

**API exportada:** `useAppState()` → `{ notifications, unreadCount, addNotification, removeNotification, clearAllNotifications, rejectedAds, rejectedCount, addRejectedAd, removeRejectedAd, funds, addFunds, setFunds, lowBalance, LOW_BALANCE_THRESHOLD, metaAccount, setMetaAccount, paymentMethod, setPaymentMethod, ads, addAd, updateAd, removeAd, duplicateAd, toggleAdStatus, getAdById, audiences, addAudience, updateAudience, removeAudience, creatives, addCreative, markCreativeUsed, removeCreative, pixel, setPixel }`.

**Regras automáticas:**
- `addRejectedAd` dispara `addNotification({ kind: 'rejected', link: '/reprovados' })`
- `funds < 20` → injeta notificação `kind: 'low-balance'` automaticamente
- `addFunds` dispara notificação `kind: 'funds'`

**Threshold saldo baixo:** `LOW_BALANCE_THRESHOLD = 20`.

---

## Design System

- **Accent:** `#C13584` — sempre via `var(--c-accent)`
- **Fonte:** Inter (Google Fonts)
- **Sidebar:** 220px desktop, hamburger ≤1024px
- **Topbar:** 60px sticky, zIndex 50
- **Dark mode:** `data-theme="dark"` no `<html>` via `ThemeContext`. Preto/cinza real, sem tons rosados no fundo.
- **Página:** classe `.page-container` (max-width 1400, margin auto, padding 28px)

### Classes CSS (em `src/index.css`)

| Classe                  | Função                                        |
|-------------------------|-----------------------------------------------|
| `.page-container`       | Wrapper externo de página                     |
| `.app-wrapper`          | Flex raiz (sidebar + conteúdo)                |
| `.main-content`         | Área direita (margin-left 220px desktop)      |
| `.sidebar-fixed`        | Sidebar fixa                                  |
| `.sidebar-open`         | Sidebar visível no mobile                     |
| `.sidebar-overlay`      | Overlay escuro mobile                         |
| `.hamburger-btn`        | Botão hamburger (só mobile)                   |
| `.metric-grid`          | Grid 4 col → 2 em ≤768px                      |
| `.dashboard-main-row`   | Grid 2 col → 1 em ≤1024px                     |
| `.dashboard-bottom-row` | Grid 2 col → 1 em ≤1024px                     |
| `.ads-table-wrapper`    | overflow-x: auto na tabela de anúncios        |

---

## Comunicação entre componentes

- **SearchBar → AIAssistant:** `window.dispatchEvent(new CustomEvent('ai-ask', { detail: { text } }))`. O AIAssistant escuta esse evento com `useEffect` e abre o chat + envia a pergunta.
- **Sidebar / Topbar → AppStateContext:** via `useAppState()`.
- **ThemeContext:** só em `src/main.jsx`. **Não** duplicar em `App.jsx`.

---

## Mocks atuais (serão substituídos por Meta Ads API)

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

- **Produção:** https://traffic-manager-five.vercel.app
- **GitHub:** https://github.com/rafaelrac25-crypto/traffic-manager (branch `main`)
- **Regra crítica:** `frontend/dist/` fica commitado no git. Sempre `cd frontend && npm run build` antes de commitar.
- **Vercel config:** `vercel.json` — `@vercel/node` + `includeFiles: ["frontend/dist/**"]`

## Variáveis de ambiente (Vercel — Production)

| Variável         | Status                                            |
|------------------|---------------------------------------------------|
| `DATABASE_URL`   | ✅ Neon PostgreSQL                                |
| `JWT_SECRET`     | ✅                                                |
| `CRON_SECRET`    | ✅                                                |
| `ALERT_PHONE_1`  | ✅ Configurado no Vercel                          |
| `ALERT_PHONE_2`  | ✅ Configurado no Vercel                          |
| `ALERT_APIKEY_1` | ⏳ PENDENTE — aguardando cadastro no CallMeBot    |
| `ALERT_APIKEY_2` | ⏳ PENDENTE — aguardando cadastro no CallMeBot    |
| `GEMINI_API_KEY` | ⏳ Pendente configurar                            |
| `NODE_ENV`       | ✅ production                                     |

---

## Pendências

| Item                                      | Módulo         | Prioridade                 |
|-------------------------------------------|----------------|----------------------------|
| Integração real Meta Ads API              | Plataformas    | Alta                       |
| Integração real Google Ads                | Plataformas    | Alta                       |
| `ALERT_APIKEY_1` e `_2` no Vercel         | Alertas        | Alta (aguardando usuários) |
| `GEMINI_API_KEY` no Vercel                | IA             | Média                      |
| Gráficos de evolução temporal (reais)     | Dashboard      | Média                      |

---

## Regras de ouro para trabalhar neste projeto

1. **Abrir só o necessário.** Use o índice acima — não leia o projeto inteiro.
2. **Um módulo por tarefa.** Se o pedido cruzar módulos, liste antes e toque um de cada vez.
3. **Estado atravessa páginas? → AppStateContext.** Não criar novo contexto à toa.
4. **Mudanças no frontend → `npm run build` antes do commit.** `frontend/dist/` é commitado.
5. **Avisos `"use client"` no Vite são falsos.** O projeto é CSR, não Next.js — ignorar.
6. **Após cada mudança:** build + commit + push + enviar link de produção.
