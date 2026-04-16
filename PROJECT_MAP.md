# PROJECT_MAP — AdManager Cris Costa Beauty

> Leia este arquivo antes de qualquer tarefa. Identifique o módulo e abra apenas os arquivos necessários.

## Regras

- Cada tarefa deve trabalhar em apenas um módulo
- Evitar leitura global do projeto
- Consultar este arquivo antes de qualquer ação
- Abrir somente os arquivos necessários para a tarefa
- Usar busca por caminho específico antes de explorar

---

## Rotas ativas

| Rota              | Página                        |
|-------------------|-------------------------------|
| `/`               | Dashboard                     |
| `/anuncios`       | Campaigns                     |
| `/campanhas`      | → redirect para `/anuncios`   |
| `/calendario`     | Calendar                      |
| `/criar-anuncio`  | CreateAd                      |
| `/novo`           | → redirect para `/criar-anuncio` |
| `*`               | → Dashboard                   |

---

## Design System

- **Accent:** `#C13584` (rosa principal) — usar sempre esta variável: `var(--c-accent)`
- **Fonte:** Inter (Google Fonts)
- **Sidebar:** 220px fixa no desktop, hamburger no mobile (≤1024px)
- **Topbar:** 60px, sticky, zIndex 50
- **Container de página:** classe CSS `.page-container` — max-width 1400px, margin auto, padding 28px
- **Tema:** `data-theme="dark"` no `<html>` via ThemeContext. Dark = preto/cinza real, sem tons rosados no fundo
- **Logos:** `src/assets/marca-colorida.png` (light) | `src/assets/marca-branca.png` (dark)

---

## CSS — Classes importantes (`frontend/src/index.css`)

| Classe                 | Uso                                              |
|------------------------|--------------------------------------------------|
| `.page-container`      | Wrapper externo de toda página (centraliza)      |
| `.app-wrapper`         | Flex container raiz (sidebar + conteúdo)         |
| `.main-content`        | Área direita (margin-left: 220px no desktop)     |
| `.sidebar-fixed`       | Sidebar — posição fixa, slide no mobile          |
| `.sidebar-open`        | Modifier: sidebar visível no mobile              |
| `.sidebar-overlay`     | Overlay escuro ao abrir sidebar no mobile        |
| `.hamburger-btn`       | Botão hamburger (só mobile)                      |
| `.metric-grid`         | Grid 4 colunas → 2 em ≤768px                     |
| `.dashboard-main-row`  | Grid 2 colunas → 1 em ≤1024px                    |
| `.dashboard-bottom-row`| Grid 2 colunas → 1 em ≤1024px                    |
| `.ads-table-wrapper`   | overflow-x: auto para tabela de anúncios         |

---

## Módulos

### 1. Splash Screen
**Arquivo:** `frontend/src/components/SplashScreen.jsx`
**O que faz:** Animação de entrada (logo colorida + traço + "Gestor de Tráfego") em fundo rosê claro `#FDF0F8`, barra de progresso rosa, ~5s, aparece em todo carregamento.
**Não depende de tema** — sempre usa `marca-colorida.png` e fundo fixo.
**Integrado em:** `App.jsx` — `useState(true)` + `onDone` seta false.

---

### 2. Layout / Navegação
**Arquivos:**
- `frontend/src/App.jsx` — BrowserRouter, rotas, SplashScreen state
- `frontend/src/components/Sidebar.jsx` — nav lateral, logo (muda com tema), toggle dark mode, perfil CC
- `frontend/src/contexts/ThemeContext.jsx` — dark mode via Context API, persiste localStorage, aplica `data-theme` no `<html>`
- `frontend/src/main.jsx` — ThemeProvider wrapping App (não duplicar no App.jsx)

**Atenção:** `ThemeProvider` está APENAS em `main.jsx`. Não adicionar em `App.jsx`.

---

### 3. Dashboard
**Arquivo:** `frontend/src/pages/Dashboard.jsx`
**O que faz:** 4 MetricCards (mock), LineChart SVG inline, Dica do Dia, MiniCalendar abril/2026, widget de quick start.
**Sem seção "Seus Anúncios"** — essa seção pertence à página Anúncios.

---

### 4. Anúncios (ex-Campanhas)
**Arquivo:** `frontend/src/pages/Campaigns.jsx`
**O que faz:** Tabela de anúncios mock (5 itens), filtros de status/plataforma, paginação, botões de ação.
**Nota:** rota era `/campanhas`, agora é `/anuncios` (redirect ativo).

---

### 5. Calendário
**Arquivo:** `frontend/src/pages/Calendar.jsx`
**O que faz:** Grid mensal abril/2026, eventos mock com chips coloridos, painel direito "Próximos anúncios", legenda de plataformas.

---

### 6. Criar Anúncio
**Arquivo:** `frontend/src/pages/CreateAd.jsx`
**O que faz:** Wizard 6 passos (Plataforma → Publicar), StepIndicator, seleção de plataforma (Instagram/Google/Meta), painel de resumo sticky à direita.
**Página full (não modal)** — rota `/criar-anuncio`.

---

### 7. Assistente IA (chat flutuante)
**Arquivo:** `frontend/src/components/AIAssistant.jsx`
**O que faz:** Botão rosê flutuante canto direito, chat com Gemini 1.5 Flash / GPT-4o-mini, system prompt focado em tráfego pago para estética.
**API keys:** configuradas pelo usuário no painel do chat (salvas no localStorage). Variáveis Vercel: `GEMINI_API_KEY`, `OPENAI_API_KEY` (pendente configurar).

---

### 8. Backend / Alertas
**Arquivos:**
- `backend/src/index.js` — Express + serve `frontend/dist/` em prod
- `backend/src/routes/campaigns.js` — CRUD campanhas
- `backend/src/routes/alerts.js` — alertas de orçamento WhatsApp
- `backend/src/services/whatsapp.js` — CallMeBot
- `backend/src/services/budgetAlert.js` — lógica saldo < R$20
**Status alertas:** aguardando `ALERT_APIKEY_1` (Cristiane) e `ALERT_APIKEY_2` (Rafael) no Vercel.

---

### 9. Banco de Dados
**Arquivos:**
- `backend/src/db/index.js` — auto-detecta SQLite (dev) ou PostgreSQL (prod)
- `backend/src/db/sqlite.js` — schema SQLite inline
- `backend/src/db/schema.sql` — schema PostgreSQL
- `backend/src/db/seed.js` — seed de dados iniciais

---

### 10. Deploy
**Arquivo:** `vercel.json` — `@vercel/node` + `includeFiles: ["frontend/dist/**"]`
**Regra crítica:** `frontend/dist/` deve estar commitado no git — necessário para o Vercel servir o frontend.
**Após qualquer mudança no frontend:** `cd frontend && npm run build` antes de commitar.

---

## Assets visuais

| Arquivo                          | Uso                              |
|----------------------------------|----------------------------------|
| `frontend/src/assets/marca-colorida.png` | Logo no light mode + splash |
| `frontend/src/assets/marca-branca.png`   | Logo no dark mode           |
| `Visual/Tema Cris costa Beauty/`         | Referências de design (PNG) |

---

## Pendências

| Item                          | Módulo      | Prioridade                   |
|-------------------------------|-------------|------------------------------|
| Integração real Meta Ads API  | Plataformas | Alta                         |
| Integração real Google Ads    | Plataformas | Alta                         |
| ALERT_APIKEY_1 e _2 no Vercel | Alertas     | Alta (aguardando usuários)   |
| GEMINI_API_KEY no Vercel      | IA          | Média                        |
| Gráficos de evolução temporal | Dashboard   | Média                        |
| TikTok Ads                    | Anúncios    | Baixa                        |
