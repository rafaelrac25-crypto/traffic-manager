# 🎯 Checkpoint de sessão — 2026-04-20

**Última atualização:** 2026-04-20 fim do dia
**Commit HEAD:** ver `git log --oneline -1`
**Produção:** https://criscosta.vercel.app

---

## 📍 Onde paramos

Sistema está **pronto internamente** pra receber a integração Meta real.
Todo o fluxo visual funciona, persistência no banco OK, fluxos sem bugs conhecidos.
**Falta só** conectar no Meta real (OAuth + write-back + sync).

---

## ✅ Entregas desta sessão (2026-04-20)

### Novas features
- **`/mapa-de-calor`** substituiu `/desempenho`
  - Paleta simples 3 cores: azul (frio) → amarelo (morno) → vermelho (quente)
  - Filtros de período: 7 dias / 30 dias / **Atual** (do startDate da campanha até hoje)
  - Toggle de métrica: Conversões / CPR / CPC (CPR/CPC invertidos: menor = mais quente)
  - Filtro por campanha ou resumo geral
  - Painel por campanha com **3 inputs editáveis** (diário/semanal/mensal) + histórico
  - Respeita área delimitada dos anúncios (só renderiza bairros dentro do raio)
  - Círculos concêntricos por bairro (4 raios 350/650/1000/1400m, opacidades 0.42/0.28/0.18/0.10)
  - Ícone de termômetro na sidebar

- **Referências** reformuladas
  - Lista compacta ranqueada com 🥇🥈🥉
  - 15+ referências 100% alinhadas aos 13 serviços da Cris
  - Removidas: Renata França (drenagem), JK Estética (crio), Human Clinic (harmonização), GiOlaser, Espaçolaser, Emagrecentro, Buddha Spa, Botoclinic
  - Adicionadas: Patricia Brow Studio, Renata Fogaça, BB Lips Brasil, Glow Lips Studio, Ferrari Hair, Cia de Cílios, Lash Lifting Brasil, Adcos Clinic, Cecília Félix, Senhor Barba, Corrige Estética, etc.
  - Cada ref tem campo `serviceIds` vinculando aos serviços
  - Chips no topo pra filtrar local + link 🔗 direto pra Meta Ad Library
  - Botão "Abrir 🔗" vai direto pra Meta Ad Library (antes abria modal)

- **Lista de anúncios** compacta
  - Linhas 33% menores (padding 14→8px)
  - Miniatura 42px com ícone de formato (reels/stories/carrossel/vídeo/imagem)
  - Preview estilo Instagram ao clicar (perfil, mídia, texto, CTA, métricas)
  - Ícone de lixeira vermelho pra remover
  - Ícone de olho pra ver criativo

- **Lista oficial de serviços** (`frontend/src/data/services.js`)
  - 13 serviços: micropigmentação sobrancelhas/labial/capilar, design sobrancelha (+ henna), brow lamination, lash lifting, extensão de cílios, limpeza de pele, microagulhamento, peeling, protocolo crescimento, despigmentação química
  - Cada um com: id, category, tier, ticketRange, durationMin, interests, keywords, synonyms
  - Usada pelo chatbot IA (system prompt), INTEREST_SUGGESTIONS, referências, trigger de bairro×serviço

### Ajustes no CreateAd
- Objetivo "Mensagens" como padrão (CTA WhatsApp — preferido da Cris)
- Step Objetivo com diagramação compacta (~70% menos altura)
- Mapa do Step Localização: default 400px, arrastável até 820px (com `ResizeObserver` recalculando tiles)
- CTA "Personalizado" agora abre prompt (antes era no-op)
- Status `review/review` ternary inútil removido

### Sino de notificações
- Só alertas reais: baixo saldo, datas comerciais, anúncios reprovados
- Removidas: reuso criativo, uso público, pré-preenchimento, publicação, duplicação, saldo adicionado, texto copiado

### Coordenadas corrigidas
- 17 bairros de Joinville atualizados via OpenStreetMap Nominatim
- `HOME_COORDS` realinhado

### Infra / persistência (BLOCKER CRÍTICO RESOLVIDO)
- **Ads agora sincronizam com backend real**
- Nova coluna `payload TEXT` em `campaigns` (SQLite + PG) com migração automática
- Novo `frontend/src/services/adsApi.js` (fetch/create/update/delete)
- `AppStateContext` hidrata ads do backend no mount, escritas vão no banco + localStorage
- localStorage vira cache offline (se API cair, app continua funcionando)

### Documentação
- `.planning/meta-integration-roadmap.md` — roadmap P0/P1/P2 completo
- `.planning/pending-features/bairro-recomendacao-investimento.md` — feature futura
- CLAUDE.md atualizado: env vars corretas (GROQ em vez de GEMINI; removido JWT_SECRET), Pixel/domínio marcados opcionais, canal único IG+WhatsApp
- `backend/src/services/sync.js` tem bloco TRIGGER AUTOMÁTICO no topo pra lembrar

### Auditoria
- 3 agentes paralelos (frontend, backend, Meta integration) — fixes aplicados:
  - `ThemeContext` migrou de `theme` → `ccb_theme`
  - CTA Personalizado pill funcional
  - Status review/review ternary removido
  - Env vars documentadas corretamente

---

## 🚀 Próximos passos (quando Rafa voltar)

### Tarefas de Rafa (externas ao código)
1. **Garantir acesso admin à conta Meta da Cris** antes do gestor antigo sair — CRÍTICO
2. **Criar App em [developers.facebook.com/apps](https://developers.facebook.com/apps)**
   - Tipo Business
   - Vincular ao Business Manager da Cris
   - Passar por Business Verification
   - Anotar `App ID` e `App Secret`
3. **Passar pra Claude:**
   - App ID + App Secret
   - Ad Account ID (`act_...`)
   - Page ID (do Facebook da Cris)
   - Instagram Business Account ID
4. **Configurar no Vercel:**
   - `FB_APP_ID`
   - `FB_APP_SECRET`
   - `FB_WEBHOOK_VERIFY_TOKEN` (qualquer string aleatória longa)
   - `TOKEN_ENC_KEY` (Claude gera 32 bytes base64 na hora)
   - Redeploy

### Tarefas da Claude (código)
Após receber os IDs e env vars:
1. Implementar OAuth 2.0 real em `backend/src/routes/platforms.js`
2. Adicionar encriptação AES-256-GCM em `backend/src/services/crypto.js`
3. Novas colunas em `platform_credentials`: `token_expires_at`, `token_type`, `scopes`, `page_id`, `ig_account_id`
4. Novas tabelas: `ad_sets`, `ads`, `creatives`, `media`, `insights`, `insights_by_district`
5. `backend/src/services/metaMedia.js` — upload de imagem/vídeo pra Meta
6. `backend/src/services/metaWrite.js` — createCampaign/AdSet/Creative/Ad, updateStatus, deleteAd
7. Expandir `backend/src/services/sync.js` pra puxar insights reais (incluindo breakdown `region,city`)
8. `backend/src/services/metaRateLimit.js` — token bucket 200/hora
9. Error mapping Meta (códigos 17, 100, 613, 190, 200)
10. Frontend: botão "Conectar Facebook" no Investment.jsx, erro Meta no Publish, badge de sync status

### Teste juntos (Rafa + Claude)
1. Rafa conecta via OAuth real — validar token encriptado no Neon
2. Criar campanha de **R$ 1/dia** com status PAUSED
3. Confirmar no Ads Manager que o ID real apareceu
4. Ativar → aguardar aprovação Meta (até 24h)
5. Sync manual → conferir insights batendo com Ads Manager
6. Pausar pelo painel → confirmar no Meta
7. Deletar → confirmar remoção

---

## 📁 Arquivos-chave que vão ser tocados

```
backend/src/routes/platforms.js           # OAuth flow (adicionar)
backend/src/routes/webhooks.js            # NOVO — webhook Meta
backend/src/services/metaAds.js           # expandir pra insights reais
backend/src/services/metaMedia.js         # NOVO — upload
backend/src/services/metaWrite.js         # NOVO — write-back
backend/src/services/sync.js              # substituir stub
backend/src/services/crypto.js            # NOVO — encrypt tokens
backend/src/services/metaRateLimit.js     # NOVO — rate limit
backend/src/db/schema.sql                 # novas tabelas
frontend/src/pages/Investment.jsx         # botão Conectar Meta
frontend/src/pages/Campaigns.jsx          # badge sync status
frontend/src/pages/CreateAd.jsx           # erro Meta no publish
frontend/src/utils/metaNormalize.js       # trocar fakeMetaId por IDs reais
```

---

## 🗂 Estado do repositório

**Branch:** main, limpa, sincronizada com origin
**Últimos commits desta sessão** (aprox, consulte `git log --oneline -40`):
- `d2c2ae3` feat(persistencia): ads sincronizam com backend
- `4d52b32` docs: ajusta roadmap Meta pra canal único IG+WhatsApp
- `be16f75` chore: fixes de auditoria + roadmap Meta
- `5b16e9f` style(mapa-de-calor): amarelo no meio
- `72c2273` style(mapa-de-calor): paleta 3 cores azul→laranja→vermelho
- `3548b65` revert(mapa-de-calor): volta ao visual por bairro
- `0e56e0d` style(mapa-de-calor): legenda térmica clara por métrica
- `6780ef5` feat(mapa-de-calor): respeitar área delimitada
- `0f7cfa8` fix(notificacoes): sino só pra alertas
- `f492ae6` feat(referencias): lista ranqueada compacta
- ... e muitos outros

Para retomar: mande "retomar projeto" — o CLAUDE.md global executa o fluxo automaticamente.
