# AdManager — Cris Costa Beauty

Painel de gestão de tráfego pago para a cliente Cris Costa Beauty (estúdio de estética em Joinville/SC).

**Sempre responder em português do Brasil.**

## ⚡ Triggers automáticos (NÃO IGNORAR)

Ao iniciar qualquer sessão neste projeto, verificar:

1. **Sync Meta real ativado?** Se `backend/src/services/sync.js` deixou de ser stub (retorna `count > 0`) OU o usuário mencionar que conectou/sincronizou com o Meta, **proativamente lembrar Rafa** da feature pendente em `.planning/pending-features/bairro-recomendacao-investimento.md` e perguntar se quer começar a implementar.

2. **Lista de serviços da Cris já foi enviada?** Se o usuário mencionar serviços específicos (micropigmentação labial, lash lamination, microagulhamento de sobrancelha, extensão de cílios, etc.) pela primeira vez → salvar num arquivo `frontend/src/data/services.js` e amarrar ao trigger acima.

Esses triggers existem porque Rafa pediu em 2026-04-20 pra ser lembrado quando estas condições fossem verdadeiras.

## Fluxo obrigatório

1. Ler `PROJECT_MAP.md` antes de qualquer tarefa
2. Identificar o módulo relevante
3. Abrir **apenas** os arquivos desse módulo (não ler o projeto inteiro)

---

## Stack

- **Backend:** Node.js + Express + SQLite (dev) / PostgreSQL Neon (prod)
- **Frontend:** React + Vite + Tailwind CSS + React Router
- **Deploy:** Vercel (monorepo — Express serve o frontend buildado de `frontend/dist/`)
- **Auth:** removida — sistema abre direto no Dashboard (uso interno)

---

## Estrutura atual do código

```
traffic-manager/
├── backend/
│   └── src/
│       ├── index.js              # Express + serve frontend/dist (no-store no HTML)
│       ├── db/
│       │   ├── index.js          # Auto-detecta SQLite (dev) ou PG (prod)
│       │   ├── sqlite.js
│       │   └── schema.sql
│       ├── routes/
│       │   ├── auth.js           # (desabilitado, mas roteado)
│       │   ├── campaigns.js      # CRUD local — NÃO escreve no Meta ainda
│       │   ├── platforms.js      # Conectar/desconectar Meta/Google (token cru — sem OAuth real)
│       │   ├── history.js        # Log de ações
│       │   └── ai.js             # Proxy Groq (llama) pro chat IA
│       ├── middleware/auth.js    # JWT — NÃO usado (auth removida)
│       └── services/
│           ├── metaAds.js        # GET /campaigns via Graph API — só leitura
│           ├── googleAds.js      # GAQL — só leitura
│           └── sync.js           # STUB — não é importado em lugar nenhum ainda
└── frontend/
    ├── dist/                     # Build commitado (necessário p/ Vercel servir)
    └── src/
        ├── App.jsx               # BrowserRouter + NotificationDropdown + SearchBar
        ├── main.jsx              # ThemeProvider + AppStateProvider
        ├── services/api.js       # Axios (baseURL relativa em prod)
        ├── contexts/
        │   ├── AppStateContext.jsx   # ads, audiences, creatives, pixel, metaAccount, notifications, history
        │   └── ThemeContext.jsx      # dark/light + persistência
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── SplashScreen.jsx      # toca playWelcome no mount
        │   ├── AIAssistant.jsx       # chat flutuante (toca playBubble nas respostas)
        │   └── ...
        ├── pages/
        │   ├── Dashboard.jsx         # saldo, gráfico dual, data comercial
        │   ├── Campaigns.jsx         # tabela de anúncios + filtros
        │   ├── CampaignDetail.jsx
        │   ├── CreateAd.jsx          # Wizard 5 passos — usa metaNormalize no publish
        │   ├── Calendar.jsx          # mês + datas comerciais
        │   ├── Audiences.jsx         # públicos salvos
        │   ├── CreativeLibrary.jsx   # criativos reutilizáveis
        │   ├── References.jsx        # 15 estúdios de referência + link Meta Ad Library
        │   ├── Investment.jsx        # saldo, pagamento, pixel
        │   ├── Reports.jsx
        │   ├── History.jsx
        │   └── Rejected.jsx
        ├── data/
        │   ├── joinvilleDistricts.js # HOME_COORDS, distanceKm, ringByDistance, 18 bairros
        │   ├── adReferences.js       # 15 estúdios (Renata França, JK, Buddha Spa, etc) com link Meta Ad Library
        │   ├── commercialDates.js    # datas comerciais BR + preFill
        │   └── rejectionRules.js
        └── utils/
            ├── sounds.js             # Web Audio API — playBell, playBubble, playWelcome
            └── metaNormalize.js      # Schema Meta v20: gender int, budget centavos, objective/CTA enum, IDs fake
```

---

## Design system

- **Paleta:** vinho/rosé — accent `#C13584`, dark `#7D4A5E`
- **Fonte:** Inter
- **Layout:** sidebar branca 220px + topbar 60px + conteúdo
- **Dark mode:** toggle na sidebar + topbar; persiste em localStorage via ThemeContext
- Avisos `"use client"` no Vite são **falsos** (projeto CSR, não Next.js — ignorar)

---

## Regras de negócio

- **Escopo geográfico:** apenas Joinville/SC — geofence de 60km aplicado no CreateAd (busca + mapa)
- **Orçamento real da Cris:** R$ 15-20/dia (valores em referências de marcas famosas são ilustrativos)
- **Sempre PT-BR** nas respostas
- Uso interno — sem tela de login

---

## Deploy — Produção

- **URL:** https://traffic-manager-five.vercel.app
- **GitHub:** https://github.com/rafaelrac25-crypto/traffic-manager (branch `main`)
- **Banco:** PostgreSQL Neon (AWS sa-east-1)
- **Regra crítica:** `frontend/dist/` fica commitado. Sempre rodar `cd frontend && npm run build` antes de commitar mudanças no frontend
- **Cache:** `app.get('*')` do backend seta `Cache-Control: no-store` no `index.html` (`express.static` usa `index: false`). Garante que deploy novo quebra cache do HTML antigo

---

## Variáveis de ambiente (Vercel — Production)

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL (`sslmode=require`) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | https://traffic-manager-five.vercel.app |
| `GROQ_API_KEY` | Chat IA (llama-3.3 + llama-4-scout com vision) |
| `FB_APP_ID` | ⏳ obter em developers.facebook.com |
| `FB_APP_SECRET` | ⏳ obter em developers.facebook.com |
| `FB_WEBHOOK_VERIFY_TOKEN` | ⏳ string aleatória p/ validar webhook Meta |
| `TOKEN_ENC_KEY` | ⏳ 32 bytes base64 p/ criptografar access_tokens no DB |
| `GOOGLE_DEVELOPER_TOKEN` | (opcional) integração Google Ads futura |

**Removidos:** `JWT_SECRET` (auth desabilitada), `GEMINI_API_KEY` (substituído por GROQ).

---

## Como rodar localmente

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
```

---

## Integração Meta — estado atual

### ✅ Frontend pronto
- `frontend/src/utils/metaNormalize.js` converte payload local pro schema Meta Marketing API v20
- `adPayload.meta` tem estrutura **campaign → ad_set → ad → creative** aninhada
- Gender em int, budget em centavos, objective em `OUTCOME_*`, CTA em enum Meta, interests `{id, name}`
- IDs Meta fake (`metaCampaignId`, `metaAdSetId`, `metaAdId`, `metaCreativeId`, `imageHash`) gerados no publish — serão substituídos pelos reais no primeiro sync

### ❌ Backend NÃO pronto
- OAuth 2.0 não existe (`/connect` aceita token cru — inviável pra produção)
- Sem coluna `token_expires_at` → sync quebra após 60 dias
- `sync.js` é stub (endpoint retorna `count: 0`)
- Sem write-back (painel não cria/pausa campanha no Meta real)
- Sem upload de mídia → sem `image_hash` → Meta rejeita criação de anúncio
- Sem rate limit, sem error codes Meta (17, 100, 613)
- Falta tabelas `ad_sets`, `ads`, `creatives`, `media`, `insights`

**Estimativa pra produção-ready:** 2-3 semanas dev backend full-time.

---

## Regras de desenvolvimento

- Configurar variáveis sensíveis **no painel do Vercel**, nunca no repo
- Priorizar features de **Meta Ads**
- Não quebrar compatibilidade com SQLite em dev
- Após cada mudança: `build + commit + push + enviar link de produção`
- Não adicionar tela de login

---

## O que falta implementar

### Alto
- [ ] Integração real Meta Marketing API (OAuth + sync + write-back + upload mídia)
- [ ] Integração real Google Ads
- [ ] Tabelas `ad_sets`, `ads`, `creatives`, `media`, `insights`

### Médio
- [ ] Gráficos de evolução temporal com dados reais
- [ ] Histórico de métricas persistido
- [ ] Rate limiting e retry nos services de plataforma
- [ ] Encriptar tokens no DB
- [ ] **Relatório de recomendação de investimento por bairro** (ver `.planning/pending-features/bairro-recomendacao-investimento.md`) — após sync real, analisar performance histórica por bairro × serviço, recomendar onde investir mais. Sugestão resumida no Step 2 do CreateAd + seção no Mapa de Calor + alerta via sino quando houver insight forte.

### Baixo
- [ ] Code-splitting do bundle (hoje ~670kB)
- [ ] Testes automatizados
