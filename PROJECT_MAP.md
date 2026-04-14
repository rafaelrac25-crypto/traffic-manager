# PROJECT_MAP — AdManager Cris Costa Beauty

> Leia este arquivo antes de qualquer tarefa. Identifique o módulo e abra apenas os arquivos necessários.

## Regras

- Cada tarefa deve trabalhar em apenas um módulo
- Evitar leitura global do projeto
- Consultar este arquivo antes de qualquer ação
- Abrir somente os arquivos necessários para a tarefa
- Usar busca por caminho específico antes de explorar

---

## Módulos

### 1. Dashboard
**Arquivos:** `frontend/src/pages/Dashboard.jsx`
**O que faz:** Cards de resumo, blocos por plataforma (Meta/Google), grid de campanhas, monitor de saldo Meta Ads.

---

### 2. Campanhas
**Arquivos:**
- `frontend/src/pages/Campaigns.jsx` — tabela + filtros + botões sync
- `frontend/src/pages/CampaignDetail.jsx` — edição + métricas
- `frontend/src/components/NewCampaignWizard.jsx` — wizard 6 passos
- `backend/src/routes/campaigns.js` — CRUD + sync por plataforma

---

### 3. Plataformas
**Arquivos:**
- `frontend/src/pages/Platforms.jsx` — conectar/desconectar Meta/Google
- `backend/src/routes/platforms.js` — GET/POST/DELETE credenciais
- `backend/src/services/metaAds.js` — API Meta Ads (mock hoje)

---

### 4. Alertas de Orçamento (WhatsApp)
**Arquivos:**
- `backend/src/routes/alerts.js` — endpoints: /status, /check, /test
- `backend/src/services/budgetAlert.js` — lógica: saldo < R$20, a cada R$5, 1 dia restante
- `backend/src/services/whatsapp.js` — envio via CallMeBot
**Status:** implementado, aguardando API keys do CallMeBot (Cristiane e Rafael)

---

### 5. Layout / Navegação
**Arquivos:**
- `frontend/src/App.jsx` — rotas (sem login, direto no Dashboard)
- `frontend/src/components/Sidebar.jsx` — nav lateral + toggle dark mode
- `frontend/src/contexts/ThemeContext.jsx` — dark mode via Context API

---

### 6. API / Comunicação Frontend-Backend
**Arquivos:**
- `frontend/src/services/api.js` — axios, baseURL vazia em prod

---

### 7. Banco de Dados
**Arquivos:**
- `backend/src/db/index.js` — auto-detecta SQLite (dev) ou PostgreSQL (prod)
- `backend/src/db/sqlite.js` — schema SQLite inline
- `backend/src/db/schema.sql` — schema PostgreSQL
- `backend/src/db/init.js` — inicializa banco
- `backend/src/db/seed.js` — seed de dados iniciais

---

### 8. Servidor / Deploy
**Arquivos:**
- `backend/src/index.js` — Express server + serve `frontend/dist/` em prod
- `vercel.json` — config deploy: @vercel/node + includeFiles frontend/dist
- `CLAUDE.md` — contexto completo do projeto

---

## Pendências

| Item | Módulo | Prioridade |
|------|--------|------------|
| Integração real Meta Ads | Plataformas | Alta |
| Integração real Google Ads | Plataformas | Alta |
| API keys CallMeBot | Alertas | Alta (aguardando usuários) |
| Gráficos de evolução | Dashboard | Média |
| TikTok Ads | Campanhas | Baixa |
| Histórico de métricas | Campanhas | Baixa |
