# AdManager — Cris Costa Beauty

Painel de gestão de tráfego pago para a cliente Cris Costa Beauty (salão/estética).

**Sempre responder em português do Brasil.**

## Fluxo Obrigatório

1. Ler `PROJECT_MAP.md` antes de qualquer tarefa
2. Identificar o módulo relevante
3. Abrir apenas os arquivos desse módulo
4. Nunca ler o projeto inteiro sem necessidade

---

## Stack

- **Backend:** Node.js + Express + SQLite (dev) / PostgreSQL Neon (prod)
- **Frontend:** React + Vite + Tailwind CSS + React Router
- **Deploy:** Vercel (monorepo — Express serve o frontend buildado)
- **Auth:** Removida — sistema abre direto no Dashboard sem login

---

## Estrutura

```
traffic-manager/
├── backend/
│   └── src/
│       ├── index.js              # Express server + serve frontend/dist em prod
│       ├── db/                   # SQLite (dev) / PostgreSQL (prod) — auto-detecta
│       ├── routes/
│       │   ├── campaigns.js      # CRUD campanhas + sync plataformas
│       │   ├── platforms.js      # Conectar/desconectar Meta/Google
│       │   └── alerts.js        # Alertas de orçamento WhatsApp
│       ├── middleware/auth.js    # JWT — NÃO usado nas rotas (auth removida)
│       ├── services/
│       │   ├── metaAds.js        # API Meta Ads (mock)
│       │   ├── whatsapp.js       # CallMeBot — envia alertas
│       │   └── budgetAlert.js    # Lógica: saldo < R$20, a cada R$5, 1 dia restante
└── frontend/
    └── src/
        ├── App.jsx               # BrowserRouter — sem PrivateRoute, sem login
        ├── services/api.js       # Axios — baseURL vazia em prod (relativa)
        ├── pages/
        │   ├── Dashboard.jsx     # Cards resumo + monitor saldo Meta + blocos plataforma
        │   ├── Campaigns.jsx     # Tabela + filtros + botões sync
        │   ├── CampaignDetail.jsx
        │   └── Platforms.jsx     # Conectar Meta/Google
        └── components/
            ├── Sidebar.jsx       # Nav lateral + toggle dark mode
            └── NewCampaignWizard.jsx  # Wizard 6 passos
```

---

## Design System

- **Paleta:** vinho/rosé — accent `#C13584`, dark `#7D4A5E`
- **Fonte:** Inter
- **Layout:** sidebar branca 220px + topbar 60px + conteúdo
- **Dark mode:** toggle na sidebar, persiste em localStorage via ThemeContext
- **Referências visuais:** `Visual/Tema Cris costa Beauty/`

---

## Deploy — Produção

- **URL:** https://traffic-manager-five.vercel.app
- **GitHub:** https://github.com/rafaelrac25-crypto/traffic-manager (branch main)
- **Banco:** PostgreSQL Neon (AWS sa-east-1)
- `frontend/dist/` está commitado no git — necessário para o Vercel servir o frontend
- Após qualquer mudança no frontend: `npm run build` dentro de `frontend/` antes de commitar

---

## Variáveis de Ambiente (Vercel — Production)

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL (sslmode=require) |
| `JWT_SECRET` | Configurado no Vercel |
| `CRON_SECRET` | Configurado no Vercel |
| `ALERT_PHONE_1` | Configurado no Vercel |
| `ALERT_PHONE_2` | Configurado no Vercel |
| `ALERT_APIKEY_1` | **PENDENTE** — aguardando cadastro no CallMeBot |
| `ALERT_APIKEY_2` | **PENDENTE** — aguardando cadastro no CallMeBot |
| `NODE_ENV` | production |
| `FRONTEND_URL` | https://traffic-manager-five.vercel.app |

---

## Como Rodar Localmente

```bash
# Backend
cd backend
npm run db:init   # primeira vez
npm run dev       # nodemon na porta 3001

# Frontend
cd frontend
npm run dev       # Vite na porta 5173
```

**backend/.env:**
```
PORT=3001
JWT_SECRET=qualquer_string_para_dev_local
FRONTEND_URL=http://localhost:5173
ALERT_PHONE_1=PREENCHER_TELEFONE_1
ALERT_APIKEY_1=PREENCHER_APIKEY_1
ALERT_PHONE_2=PREENCHER_TELEFONE_2
ALERT_APIKEY_2=PREENCHER_APIKEY_2
CRON_SECRET=troque_por_string_aleatoria_segura
```

---

## Regras de Desenvolvimento

- Configurar variáveis sensíveis (secrets, API keys, telefones) diretamente no painel do Vercel, nunca no repositório
- Priorizar features de **Meta Ads** e **Google Ads**
- Não quebrar compatibilidade com SQLite em dev
- Após cada mudança: build + commit + push + enviar link de produção
- Não adicionar tela de login — sistema é de uso interno

---

## O que Falta Implementar

- [ ] Integração real API Meta Ads (hoje é mock)
- [ ] Integração real Google Ads
- [ ] Gráficos de evolução temporal de métricas
- [ ] Histórico de métricas (dados mock hoje)
- [ ] API keys CallMeBot (aguardando cadastro dos destinatários)
