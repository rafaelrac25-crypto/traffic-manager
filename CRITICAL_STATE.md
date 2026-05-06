# CRITICAL_STATE — traffic-manager

## ✅ CHECKPOINT — 2026-05-06 14:30 — Publicação Nano v2 100% pronta (5 bugs críticos fechados + 2 varreduras)

### Bugs corrigidos hoje (commits, em ordem)
1. `3f98cae` — fix(api): prefixo /api faltando em 3 chamadas frontend (POST /campaigns, getPublishJob, /history)
2. `c32d189` — fix(ux): reset uploadProgress no catch (barra antiga não reaparece em retry)
3. `d5bf0bd` — fix(campaigns POST): aceita meta no top-level + camelCase do frontend (era o que travava o publish — caía no fluxo sync legacy que só salvava local com IDs Meta fake)
4. `9933901` — fix(worker+sync): mesmo fallback de body shape no worker `/api/internal/publish-worker/:id` + sync.js preserva status='publishing' durante upsert (evita sumir barra de progresso enquanto worker termina)

### Phantom cleanup
- #444 e #445 (phantoms criados antes dos fixes — verdict: LOCAL_ONLY): DELETADOS
- 4 campanhas smoke-test acidentais (#446-#449, #450): DELETADAS
- Lista limpa: só #436 Nano v1 (paused) e #437 Limpeza v1 (paused)

### Validação live (criscosta.vercel.app)
- `GET /api/health/full`: ok / Meta warn (token 45 dias, lentidão habitual hoje)
- `POST /api/internal/publish-worker/test` sem header → 401 ✅
- `POST /api/internal/publish-worker/test` com header correto + job fake → 404 ✅
- `POST /api/campaigns` payload Google sem meta → 201 (sync legacy) ✅
- `POST /api/campaigns` payload Instagram com meta + ad_sets vazio → 400 "Pelo menos 1 adset obrigatório" ✅ (async detectado E validação funcionando)

### Bugs/riscos NÃO bloqueantes (deferred)
- `/api/admin/*` sem autenticação (segurança)
- `/api/admin/zombie-campaigns` 500 em prod (Meta lento + parâmetro inválido — Rafa não usa agora)
- `insights_by_district` duplica a cada sync (afeta dashboard, não publicação)
- `Promise.all` em metaWrite embaralha onProgress (UX impreciso, não funcional)
- SQLite migrations sem `effective_status` em ad_sets/ads (só dev)
- ConfirmModal de zombie cleanup sem digitação por nome
- Polling sem retry exponencial
- Vídeo não tem reuso real por hash (Rafa precisa re-uploadar 41MB)

### Protocolo Rafa retornar e publicar
1. **Ctrl+F5** na aba (carrega JS novo)
2. Wizard preencher tudo (formulário não persiste)
3. Step 5 anexar o vídeo (re-upload obrigatório)
4. **Não trocar de aba/rota durante publish**
5. Esperar 12 chunks de upload (~20min com Meta lento)
6. Após upload, abre PublishingModal com 4 fases (campaign → adset → creative → ad)
7. Se travar mais de 5min no modal → ver logs Vercel

---

## ✅ CHECKPOINT — 2026-05-06 10:17 — INTERNAL_WORKER_SECRET ativa em prod + projeto Vercel correto

### Descoberta crítica
Existiam **2 projetos no Vercel** apontando pro mesmo repo GitHub `rafaelrac25-crypto/traffic-manager`:
- **`criscosta`** (`prj_8TFqFkqfUTGQvFe4TG5tcazbHGuZ`, criado 2026-04-08) — serve `criscosta.vercel.app` em produção, tem todas as env vars
- **`traffic-manager`** (`prj_FGKb5yXAPIAFtB0CAw3bpob3y96e`, criado 2026-04-23) — duplicata órfã, servia `traffic-manager-two.vercel.app`, env vars vazias

Todo `git push` disparava deploy nos 2 projetos. A primeira tentativa de adicionar `INTERNAL_WORKER_SECRET` foi no projeto duplicado (errado) — por isso o teste sem header passou em "modo dev permissivo" (env var realmente não existia no `criscosta`).

### Ações tomadas
1. Rafa **deletou** o projeto duplicado `traffic-manager` no Vercel
2. Adicionou `INTERNAL_WORKER_SECRET` no projeto correto `criscosta` (Production + Preview)
3. Redeploy → deploy `dpl_g7B8nEpXM1S6bADcFVnT66h2RV5g` READY
4. `.vercel/project.json` local atualizado: `prj_FGKb...` → `prj_8TFqFkqfUTGQvFe4TG5tcazbHGuZ` (`criscosta`)

### Validação ao vivo (criscosta.vercel.app)
- `POST /api/internal/publish-worker/abc-test` SEM header → **401 Não autorizado** ✅ (auth ativa)
- `POST /api/internal/publish-worker/abc-test` COM header correto → 404 Job não encontrado ✅ (auth passou)
- `GET /api/health/full` → DB ok, Groq ok, Webhook ok, Meta warn (token ainda válido 45 dias, lentidão habitual)

### Valor do segredo (rotacionar quando precisar)
`7dd5833c360d8df25cbb80baeafa1000b947163bcc25f09ba37d7766c9f8b754`

### Próximos passos
- Republicar Nano v2 com objetivo Tráfego + CTA Agendar (BOOK_NOW) — modal de progresso vai mostrar fase a fase, worker async já blindado
- Antes: usar `/limpeza-meta` pra deletar zumbis #438/#439 do Meta Gerenciador

---

## ✅ CHECKPOINT — 2026-05-06 09:36 — Tarefas 1+2+3 entregues (3 agentes em paralelo)

**Sessão:** Rafa pediu Tarefas 1 (zumbis Meta), 2 (refactor publish async pra resolver 504) e 3 (UX feedback de publicação) — distribuídas em 3 subagentes Sonnet em paralelo.

### O que foi entregue

**T1 — Limpeza de zumbis Meta** (Agente A)
- `backend/src/routes/admin.js` (NOVO): GET/DELETE `/api/admin/zombie-campaigns` — lista campanhas Meta sem registro local nem adsets, deleta sob confirmação
- `frontend/src/pages/ZombieCleanup.jsx` (NOVO) — página `/limpeza-meta` com cards, modal de confirmação por nome, empty state, loading skeleton
- `Sidebar.jsx` + `App.jsx` — item "Limpeza Meta" + rota
- `index.js` — registra `/api/admin`

**T2 — Refactor publish async (resolve 504)** (Agente B)
- Tabela nova `publish_jobs` (id UUID, status, current_step/total_steps, message, payload JSONB, error) em Postgres + SQLite + migrate
- `POST /api/campaigns` agora detecta publish Meta imediato → cria job, dispara worker fire-and-forget, retorna **202 + job_id** (não trava em 300s)
- `POST /api/internal/publish-worker/:job_id` (NOVO) — verifica `X-Internal-Secret`, executa publishCampaign com `onProgress`, atualiza job a cada fase, paralelliza adsets/creatives/ads via `Promise.all`
- `GET /api/campaigns/jobs/:job_id` — endpoint de polling
- `services/metaWrite.js` — aceita `onProgress(stepKey, current, total, message)`, paraleliza Promise.all
- `index.js` — registra `/api/internal`
- **ENV var nova obrigatória em prod: `INTERNAL_WORKER_SECRET`** (sem ela, modo dev permissivo)

**T3 — UX feedback de publicação** (Agente C)
- `frontend/src/components/PublishingModal.jsx` (NOVO) — modal não-fechável durante fases ativas, polling 1.2s, barra de progresso real (current/total), rótulos PT-BR por status, ESC bloqueado, aria-live, sons (`playBubble` em sucesso, `playBell` em falha), 1.5s de ✅ animado antes de redirecionar
- `CreateAd.jsx` — Step 5 publish agora consome 202 + job_id, abre PublishingModal em vez de redirecionar prematuro; mensagem 504/408 corrigida ("Tempo de resposta esgotado", não mais "<2MB")
- `Campaigns.jsx` — badge "Em publicação X%" amber/yellow + polling 5s individual quando `status_local='publishing'`; badge "Falhou — ver detalhes" em vermelho quando job=failed
- `services/api.js` — export `getPublishJob(jobId)`

### Estado pré-deploy (este commit)

- ✅ Backend: todos os 7 arquivos modificados/novos carregam sem erro de sintaxe
- ✅ Frontend: `npm run build` OK em 1.31s, 907kB chunk principal (esperado)
- ✅ `frontend/dist/` commitado
- ⚠️ Prod ainda **sem** `INTERNAL_WORKER_SECRET` — worker vai aceitar mesmo sem header em modo dev permissivo, mas precisa ser setada via `vercel env add INTERNAL_WORKER_SECRET` ou MCP em produção pra proteger `/api/internal/*` contra invocação externa

### Próximos passos práticos pro Rafa

1. **Setar `INTERNAL_WORKER_SECRET` no Vercel** (gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) e redeploy. Sem isso, qualquer um na internet pode chamar `/api/internal/publish-worker/:id` e disparar publish — mas só funciona se já existir job no DB e for só fire-and-forget; risco real: baixo, mas vale fechar.
2. **Abrir `/limpeza-meta`** no painel pra ver os zumbis #438/#439 e deletar (em vez de Meta Gerenciador manual)
3. **Republicar Nano v2** com objetivo Tráfego + CTA Agendar (BOOK_NOW) — modal de progresso vai mostrar fase a fase

### Pendências carregadas pra próxima sessão (não tocadas aqui)
- 4 decisões de Nano v2 ainda abertas: mensagens reais (Cris), criativo B, orçamento R$20/35, horário 9-21h
- Cron automático de sync Meta (hoje manual)
- Rollback automático no worker em caso de falha parcial (hoje só marca failed, não desfaz órfãos no Meta)

---

## 🔴 RETOMAR AMANHÃ — 2026-05-06 04:00 (sessão pausada)

**Onde paramos:** Nano v2 NÃO foi publicada com sucesso. Ficaram **2 campanhas zumbi no Meta** que precisam ser verificadas/deletadas no Gerenciador antes de tentar de novo.

### Estado vivo
- **#436 Nano v1:** PAUSED ✅ (encerrada manualmente, R$141 / 335 cliques)
- **#437 Limpeza v1:** PAUSED ✅ (encerrada manualmente, R$126 / 611 cliques)
- **#438 zumbi 1:** "Sobrancelhas naturais, fio a fio." — criada com objetivo **Mensagens** (erro). Meta criou a CAMPANHA mas falhou nos adsets (Mensagens incompatível com wa.me). Status no front: "Em revisão · 0 conjuntos". Não está no nosso DB local.
- **#439 zumbi 2 (provável):** mesma campanha, segunda tentativa com objetivo **Tráfego** + CTA "Entrar em contato". Backend deu timeout 504 ao criar (Vercel matou em 300s — Meta lento + N×M chamadas sequenciais Meta). Pode ter criado parcialmente: campaign + alguns adsets + zero ads. Frontend mostrou erro enganoso "Reduza imagem/vídeo pra <2MB" (mensagem hard-coded pra status 504/408 — não é tamanho).

### Ação primeiro thing tomorrow
1. **Abrir Meta Gerenciador** → Campanhas → procurar "Sobrancelhas naturais, fio a fio." → DELETAR todas as ocorrências (provavelmente 1-2 zumbis sem ads)
2. Verificar se vídeo "Limpeza de pele Rafa_FINAL.mp4" ou similar (do upload de 41MB) ficou na **Biblioteca de Mídia do Meta** — se sim, reaproveitar pra evitar re-upload
3. Refazer publicação no nosso wizard com:
   - **Objetivo: Tráfego** (NÃO Mensagens — incompatível com wa.me — regra salva em `feedback_traffic_manager_objective_wame.md`)
   - **CTA: "Entrar em contato"** (CONTACT_US, validado seguro pra wa.me) OU "Agendar" (BOOK_NOW, ainda não validado em prod)
   - **Mensagem pré-preenchida wa.me:** "Oi Cris, vim pelo Instagram, quero agendar uma avaliação de nanopigmentação"
   - Resto da config: ver "CHECKPOINT — Nanopigmentação Maio v2" abaixo

### Causa raiz do timeout 504 (a investigar)
Backend `POST /api/campaigns` cria sequencialmente: campaign → N adsets → N ads → N creatives. Cada etapa = 1+ chamada Meta. Com Meta lento à noite e ~3 adsets, soma >300s e Vercel mata. Soluções possíveis:
- (a) Quebrar em 2 endpoints: criar campaign rápido + processar adsets/ads async em background
- (b) Subir maxDuration pra 600s (bandage temporário)
- (c) Paralelizar criação de adsets/ads (Meta aguenta, mas pode bater rate limit)
Decidir + implementar amanhã antes de tentar publicar de novo.

### Fixes deployados nesta sessão (já em prod)
- `5e3a292` feat(cta): "Agendar" → BOOK_NOW + liberado wa.me whitelist
- `a7051b3` fix(upload): timeout init/finalize do upload Meta 60s→120s
- `aa79f6c` fix(preflight): timeout amigável 60s no Step 5 (Meta lento não trava UI)

### Lições novas registradas
- **Memória permanente:** `feedback_traffic_manager_objective_wame.md` — Mensagens + wa.me incompatível, sempre Tráfego pra wa.me
- **Pendência UX (abaixo nesta CRITICAL_STATE):** barra de progresso real do upload + feedback pós-publicação + badge "em publicação" — Rafa não pode mais precisar abrir F12 pra ver progresso

### Aprendizado consolidado das #436 + #437
- Limpeza ganhou disparado: CTR 4,18% vs 1,57%, CPC R$0,13 vs R$0,28
- Tracking de mensagens 0 nas duas (wa.me é blind spot do Meta — não é bug nosso)
- WhatsApp ABRIA sim (946 cliques no link total) — só não dá pra saber quantos viraram mensagem
- Pendente: Cris contar quantas mensagens reais chegaram em cada (Nano vs Limpeza)

---

## PENDÊNCIA UX — Feedback de upload + publicação (PRIORIDADE ALTA)

Rafa pediu em 2026-05-06 03:35 após ter que abrir F12 pra ver se publicação estava progredindo.

**Bugs UX a corrigir:**
1. **Barra de progresso real do upload de vídeo no Step 5/Modal Publishing**
   - Hoje: spinner genérico ou nada visível enquanto sobem 12 chunks de 3.5 MB
   - Frontend já recebe `onProgress(pct, label)` no `uploadVideoChunked` — falta amarrar à barra visual com `Chunk X/Y — N%`
   - Local: `frontend/src/utils/metaResumableUploader.js` já emite progresso. `CreateAd.jsx` tem `setUploadProgress` mas não está exibindo claramente.

2. **Feedback pós-publicação mais explícito**
   - Hoje: redirect pra /anuncios sem confirmação clara → Rafa não sabe se publicou ou se travou
   - Mostrar toast persistente "Publicação em andamento" durante upload + toast verde "Publicado!" ao confirmar criação no DB
   - Bloquear redirect prematuro até POST /api/campaigns voltar 200

3. **Badge "Em publicação" na lista /anuncios**
   - Quando campanha foi disparada mas ainda subindo chunks, mostrar card com barra "Subindo vídeo… 7/12"
   - Hoje: não aparece nada até POST /api/campaigns terminar

**Por que importa:** sem isso, Rafa precisa abrir F12 + Network pra confirmar que sistema está vivo. Cliente final (não-dev) não vai conseguir publicar sozinho.

---

## CHECKPOINT — 2026-05-06 00:35 — Encerramento Nano #436 + Limpeza #437 (rodada 1)

Ambas as campanhas pausadas manualmente via PATCH /api/campaigns/:id/status (cascade Meta confirmado nos 2 casos). Adsets já tinham `end_time` 2026-05-05 23:59:59, mas Meta não muda pra "completed" automaticamente — só para de entregar. Pausa explícita zera qualquer entrega residual e libera pra v2.

**Resultado final 7 dias (29/04 → 05/05):**

| | Nano #436 | Limpeza #437 |
|---|---|---|
| Investido | R$141,03 | R$126,60 |
| Link clicks | 335 | 611 |
| CPC | R$0,28 | R$0,13 |
| CTR | 1,57% | 4,18% |
| Reach | 12.319 | 14.528 |
| Freq | 2,60 (saturando) | 1,59 (saudável) |
| Mensagens trackeadas | 0 | 0 |

**Veredicto:** Limpeza ganhou disparada no topo do funil (CTR 2,66× maior, CPC 50% menor, 1,8× mais cliques gastando MENOS). Mensagens trackeadas em 0 nas duas (wa.me não conta como conversão Meta — buraco conhecido). ROI real só com input da Cris.

**Pendente:** perguntar pra Cris quantas mensagens chegaram em cada (Nano vs Limpeza) nos últimos 7 dias. Sem esse número, decisão de reinvestimento é cega.

**Próximo passo Nano v2:** segue valendo o plano em "CHECKPOINT — Nanopigmentação Maio v2" abaixo (criativo B novo, bairros 8, rotação A+B, decisão orçamento).

---

## CHECKPOINT — Nanopigmentação Maio v2 (PRÉ-PUBLICAÇÃO)

### Análise atual (04/05/2026, dia 5 de 7)
Campanha #436 "Nanopigmentação em Joinville!" rodando desde 29/04, termina 05/05.
- 267 cliques no link · CPR R$ 0,43 · gasto ~R$ 115
- Comparativo com #437 (Adeus cravos): 485 cliques · CPR R$ 0,20 · ticket menor (limpeza vs nano R$ 497)
- Veredicto: Nano saudável dentro do nicho. Diferença de CPR esperada (decisão maior).

### Pendências críticas antes da v2
1. **Confirmar com Cris quantas MENSAGENS chegaram no WhatsApp** (cliques ≠ conversas; sem isso, ROI é cego)
2. **Criativo B novo** — Rafa desenha em sessão `cris-costa-criativos`. Vídeo 9:16, 15-30s, resultado real Cris.
3. **Decisão de orçamento:** R$ 20/dia (conservador, deixa v1 morrer 05/05 e recria v2 dia 06) ou R$ 35/dia (mantém v1 + adset B paralela com bairros novos + criativo B)

### Plano da v2 (a executar quando Rafa retomar)
- Bairros: 8 (atuais 6 + **Centro** + **Costa e Silva**)
- Idade: 28-45 (mantém — público clássico nano)
- Gênero: feminino
- Interesses: Eyebrow, Microblading, Permanent makeup + adicionar variação PT
- Criativo: rotação A+B (não só 1 vídeo — evita saturação de freq>3)
- Headline aprovada: **Sobrancelhas naturais, fio a fio** (32/40) — decidido 2026-05-06
- Texto principal aprovado: **Técnica fio a fio que segue o desenho natural da sua sobrancelha. Sem ficar borrado e sem cara de tatuagem. Agende sua avaliação.** (124/125)
- Oferta: mantém R$ 699→R$ 497 ou 12×R$ 58 (clara, valor visível)
- CTA: **Agendar** (BOOK_NOW) — alinhado com áudio do criativo "agendar avaliação". Decidido 2026-05-06 após mapping fix. Validar 1 ad em PAUSED antes do lançamento (BOOK_NOW + link wa.me ainda não testado em prod).
- Horário comercial: testar 9h-21h (filtra curiosos noturnos) — decisão pendente

### Como retomar
Próxima sessão: "criar nova campanha Nano v2" → Claude lê checkpoint, pergunta as 4 decisões pendentes (mensagens reais? criativo B pronto? orçamento A/B/C? horário comercial sim/não?), monta payload pelo wizard `/criar-anuncio`, publica em PAUSED pra Cris validar visualmente.

---

## CHECKPOINT — Game Boy Agency

### Fase 1 — CONCLUÍDA ✅ (commits 47b6e498 → 389b0dc)

**Pipeline em prod funcionando, 6 eventos demo persistidos.**

> **Hotfix 04/05/2026 19h — commit 389b0dc:** `Agency.jsx` chamava `api.get('/agency/recent')` sem o prefixo `/api`. Como Express tem `app.get('*')` servindo SPA HTML como fallback, requisição caía no fallback e o frontend recebia HTML em vez de JSON, ficando eternamente em "Aguardando os agentes acordarem". Corrigido para `/api/agency/recent` (padrão das outras pages).

Backend (`backend/src/routes/agency.js`):
- 3 endpoints: POST /event (auth opcional X-Agency-Secret) · GET /recent (com query `?since=<ts>` pra polling incremental) · server_ts no response
- Persistência: tabela `agency_events` no Postgres Neon (multi-instance safe)
- Rate limit token bucket 10/s por IP
- Cleanup a cada 10 inserts mantém só 200 mais recentes
- Sanitização: basename só, blacklist de .env/secret/credential/password

Schema (`schema.sql` + `sqlite.js` + `migrate.js`):
- `agency_events(id, ts, agent, tool, action, status, duration_ms, meta jsonb)` + index ts DESC
- Idempotente, criado em cold start na primeira request

Frontend (`frontend/src/pages/Agency.jsx`):
- Polling de /recent a cada 1.5s (NÃO usa SSE — multi-instance Vercel não rotearia POST e GET pra mesma function instance)
- Hidratação inicial busca últimos 50; loop incremental usa `?since=<lastTs>` pra só pegar novos
- Dedup por id, cap 50 visíveis, sons via playBubble por evento novo
- Lazy chunk separado (~4.8KB), zero inflação no bundle principal
- Trade-off aceito: latência ~1.5s ao invés de instantâneo, mas funciona em qualquer topologia serverless

Sidebar: item "Agência 2D" com IconGameboy SVG inserido após Histórico.

Hook (`~/.claude/hooks/agency-emit.js`):
- PostToolUse matcher "*" no settings.json
- Lê stdin JSON do Claude Code, identifica subagent vs main, humaniza ação
- Filtra paths sensíveis, faz fetch POST com timeout 1.5s, exit 0 sempre
- **Hook só ativa em nova sessão CC — Rafa precisa reiniciar o CLI pra fluxo automático**

### Bug histórico documentado (não regredir)
1ª versão usou Map in-memory + EventEmitter + SSE. Falhou em prod porque Vercel
serverless multi-instance roteia POST e GET pra containers diferentes — eventos
sumiam entre requests. Smoke test sequencial passava por sorte (caía na mesma instance).
Lição: **storage in-memory + EventEmitter NÃO funciona em multi-instance Vercel**.
Solução: Postgres como source of truth + polling incremental no cliente.

### Próximo passo concreto pro Rafa
1. **Atualiza a página /agencia** — vai ver 6 eventos demo postados durante validação
2. **Reinicia o Claude Code** (fecha e abre o CLI) — settings.json mudou, hook só ativa em sessão nova
3. Em sessão nova, qualquer comando do CC dispara hook → evento aparece em <1.5s na página

### Fase 2 — REQUISITOS DEFINIDOS (Rafa especificou 2026-05-04)
**Cena VIVA 24/7 (não one-shot por evento):**
- Layer idle ambient: bonecos sempre fazendo algo (digitando, café, esticando), loop infinito sem precisar de evento
- Layer active: quando SSE chega, agente correspondente vira `working` por 3-5s + balão HTML overlay com texto da ação, depois volta ao idle
- Sensação: escritório vivo o tempo todo, sincroniza com CLI quando há atividade real

**Personagens (8 base):**
1. Cris Costa Beauty (cliente, mesa decorada)
2. Claude Code main (Rafa, mesa central rosé)
3. Sonnet (executor, digita rápido)
4. Haiku (corredor frenético, várias mesas)
5. Opus (chefe sério, sala separada)
6. Vercel MCP (datacenter lateral)
7. Subagents pool (Explore/Plan/Task revezam mesas)
8. claude-mem (biblioteca canto)

**Por personagem, 4 animações no Spline:**
- idle_a, idle_b, idle_c (variações ambient — cycle aleatório a cada 8-15s)
- working (mãos voando, foco — só com evento ativo)

**State machine por agente** (variáveis Spline):
- state_main, state_sonnet, state_haiku, state_opus, state_subagent, state_mcp, state_mem
- Frontend: SSE event → setVariable("state_<agent>", "working") + setTimeout(reset, 3-5s)
- Frontend: idle shuffle: a cada 8-15s, randomiza idle_a/b/c por agente

**Balão de fala HTML overlay:**
- Componente React posicionado sobre canvas Spline
- Calcula coords via spline.getObjectByName(agente).position projetada pro DOM
- Texto = ev.action (já vem humanizado do hook)
- Fade-in 200ms, fica 3-5s, fade-out

### Fase 2 — Tempo estimado revisado
- Design Spline (Rafa): 2-3 dias (era 1-2 — adicionou animações idle)
- Engenharia integração (Claude): ~6h (era 4h — adicionou idle shuffle + balão + transições)

### Próximo passo concreto Fase 2
1. Rafa abre Spline.design (free), Claude guia primeiro projeto
2. Rafa desenha escritório voxel + 8 personagens
3. Rafa cria 4 animações por personagem + state machine
4. Rafa exporta <spline-viewer> URL → passa pro Claude
5. Claude integra em Agency.jsx: substitui lista texto puro pela cena Spline + balão overlay + idle shuffle

### Contexto da decisão (sessão 2026-05-04)
Rafa quer reproduzir o conceito visual do story do @leandromastellini.ai (escritório isométrico voxel 3D com bonecos como agentes IA) DENTRO do traffic-manager, como rota `/agencia` na sidebar. Objetivo: **álbum visual divertido pra ele e mostrar pros amigos**, com bonecos reagindo em TEMPO REAL ao que o Claude Code está fazendo no CLI dele.

Cris (namorada e cliente) pode ver — sem barreira de privacidade. Rota fica visível na sidebar.

### Arquitetura aprovada
Claude Code (hooks `PostToolUse`/`SubagentStart` em `~/.claude/settings.json`) → `curl POST /api/agency/event` → backend grava + repassa via SSE → frontend `/agencia` recebe → Spline anima boneco do agente correspondente + balão HTML overlay com texto da ação.

### Plano em 3 fases
| Fase | O que entrega | Quem faz | Tempo |
|---|---|---|---|
| 1. Esqueleto técnico | hook + POST endpoint + SSE + página `/agencia` mostrando eventos em **texto puro** ("Sonnet leu X.jsx às 14:23") | Claude | ~3h |
| 2. Cena visual Spline | escritório isométrico voxel + 5-8 bonecos com animações idle/walk/work | Rafa (Spline editor) | 1-2 dias |
| 3. Integração + polish | mapear eventos → animação correspondente, balão overlay, sons, idle states | Claude | ~4h |

### Fase 1 — TODO detalhado (próxima sessão começa AQUI)

**Backend (criar nova área `agency`):**
- [ ] `backend/src/routes/agency.js` com 3 endpoints:
  - `POST /api/agency/event` — recebe `{agent, tool, file?, status, duration_ms?}`. Auth via header `X-Agency-Secret` (env var `AGENCY_SECRET`). Grava em fila in-memory (Map por sessão) limitada a 200 últimos.
  - `GET /api/agency/stream` — SSE keep-alive. Manda evento sempre que novo POST chega.
  - `GET /api/agency/recent` — array dos últimos 50 eventos pra hidratação inicial da página.
- [ ] Registrar rotas em `backend/src/index.js`
- [ ] Adicionar `AGENCY_SECRET` no Vercel env (gerar 32 bytes random)

**Hook do Claude Code (config local Rafa):**
- [ ] Adicionar em `~/.claude/settings.json` hook `PostToolUse` que executa:
  ```bash
  curl -s -m 2 -X POST https://criscosta.vercel.app/api/agency/event \
    -H "X-Agency-Secret: $AGENCY_SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"agent\":\"$CLAUDE_AGENT\",\"tool\":\"$CLAUDE_TOOL\",\"file\":\"$CLAUDE_FILE\",\"status\":\"ok\"}" \
    > /dev/null 2>&1 &
  ```
  - Background `&` pra não bloquear. Timeout 2s. Falha silenciosa.
  - Não vazar paths sensíveis (filtrar `.env`, secrets) — fazer regex no shell ou filtrar no backend.

**Frontend (rota nova):**
- [ ] `frontend/src/pages/Agency.jsx` — página minimalista:
  - `useEffect` abre EventSource em `/api/agency/stream`
  - Lista cronológica reversa: agente em badge colorido, tool em mono, file truncado, timestamp relativo
  - Auto-scroll pro topo quando chega evento novo
  - Estilo dark consistente com resto do app
- [ ] Adicionar item "🕹️ Agência" na `Sidebar.jsx` (rota `/agencia`)
- [ ] Adicionar `<Route path="/agencia" element={<Agency />} />` em `App.jsx`
- [ ] LAZY IMPORT: `const Agency = lazy(() => import('./pages/Agency'))` — evita inflar o bundle principal

**Validação end-to-end (DoD da Fase 1):**
1. Rafa abre `criscosta.vercel.app/agencia`
2. Em outro terminal, Rafa faz qualquer comando no Claude Code (ex: `cat algum_arquivo`)
3. Em <2s o evento aparece na página `/agencia` em texto puro
4. ✓ Pipeline funciona — pronto pra Fase 2

### O que NÃO faz parte da Fase 1
- Visual 3D / Spline / bonecos (Fase 2)
- Balão de fala (Fase 3)
- Sons (Fase 3 — usa `sounds.js` existente)
- Mapeamento agente→sprite (Fase 3)

### Decisões pendentes pra começar Fase 1 (perguntar ao Rafa na retomada)
- Tipo de auth do POST: shared secret no header (recomendado) OU sem auth (risco de flood)?
- Eventos persistem em DB ou só memória? Recomendo memória pra Fase 1 (zero schema migration)
- Sidebar: item "Agência" sempre visível ou só atrás de query param `?dev=1`? Decidi pelo primeiro (Cris pode ver)

### Como retomar
Próxima sessão Rafa pode dizer:
- "retomar Game Boy Agency" / "continuar agência" / "agência" → Claude lê esse checkpoint, confirma TODO, começa Fase 1
- Se quiser pular pra Fase 2 direto: "vou desenhar no Spline primeiro" — OK, mas Fase 1 valida o pipeline antes
- Se desistir: remover esse checkpoint e seguir com outras prioridades (cron sync, code-splitting, etc)

---

## Sessão 2026-05-04 (parte 3) — Auditoria profunda 2 varreduras + 17 fixes em 4 commits

### Veredicto da auditoria
2 agentes Sonnet em paralelo (Varredura 1: features novas; Varredura 2: sistema base). Sem sobreposição. Achados consolidados: 3 CRITICAL, 5 HIGH, 6 MEDIUM, vários LOW. Confirmado limpo: gender em metaNormalize (1=homens, 2=mulheres — bug histórico não regrediu), webhook HMAC, OAuth CSRF, AES-256-GCM, cleanup transacional do publishCampaign, AbortController da vista hierárquica.

### Fixes aplicados (3 agentes Sonnet em paralelo, escopos disjuntos)

**Commit b4e93c8 — CRITICAL (segurança/integridade):**
- `metaMedia.js`: token Meta via `Authorization: Bearer` em vez de query string (não vaza pra logs Vercel/CDN)
- `schema.sql`: `link_clicks` no CREATE TABLE original (antes só ALTER em migrate.js — risco de crash em sync.js)
- `schema.sql`: tabela `processed_webhook_events` para dedup
- `sqlite.js`: `PRAGMA foreign_keys=ON` + REFERENCES (paridade dev↔prod)
- `migrate.js`: cria processed_webhook_events idempotentemente

**Commit e5206fb — HIGH:**
- `webhooks.js`: replay guard via `event_id = entry.id:entry.time` com ON CONFLICT DO NOTHING
- `ai.js`: limites 50 mensagens + 5MB por imageBase64 (custo Groq + OOM)
- `googleAds.js`: timeout 15s no https.request (antes podia pendurar function 300s)
- `useCampaignsHierarchy.js`: mountedRef previne setState pós-desmonte; purge IDs removidos

**Commit 90389df — MEDIUM:**
- `CampaignsHierarchy.jsx`: clearTimeout pendente, catch{} → console.warn, guard null em fetched_at
- `Relatorios.jsx`: bloco morto `filter==='reminder'` removido
- `sounds.js`: AudioContext recria se closed; closeAudioCtx() exposto
- `History.jsx`: funde activity_log do backend com history local
- `metaWrite.js`: `waitForVideoReady` 50s → 40s (margem de 20s pra cleanupOrphans)
- `middleware/auth.js` + `metaRateLimit.js`: comentários documentais

**Commit 8400e8b — LOW:**
- `ThemeContext.jsx` + `Sidebar.jsx`: toggle noop removido
- `CreativeLibrary.jsx`: campo description removido (regra IG/mobile)
- `metaErrors.js`: código 200 vira `reconnect:false` (era falso positivo)
- `platforms.js`: `safeDecrypt` em instagram-profile e campaign-status

### Pendências derivadas — TODAS RESOLVIDAS na mesma sessão

**Commit ef3ce3b — Joinville completo:**
- 26 bairros adicionados (era 17 reais + 1 bolha "Joinville"; agora 43 oficiais + bolha)
- Centroides via OSM Nominatim, tier/renda/age estimados por região conhecida
- Cris pode segmentar qualquer bairro oficial agora

**Commit 7524be8 — Rate limit em Postgres compartilhado:**
- Token bucket atômico via UPSERT + CTE; refill contínuo via EXTRACT(EPOCH)
- Tabela `rate_limit_buckets` em schema.sql + sqlite.js + migrate.js (idempotente)
- Fallback in-memory se DB indisponível (não bloqueia chamadas Meta)
- Interface pública preservada (take/tryTake/status)

**Commit 69c4370 — History merge com shape real:**
- `normalizeBackendItem()` faz parse do meta JSON + infere type kebab-case
- 9 ações backend mapeadas (ad_status, status_change, budget_safe, etc)
- 8 entradas novas em TYPE_META (adset/campaign activated/paused/removed, budget-changed, etc)
- IDs prefixados `bk-{id}` evitam colisão com `hist-{ts}` local
- Dedup conservador por (timestamp_seg + type)

Deploy: dpl_? em prod (commit c8b77d0)

---

## Sessão 2026-05-04 (parte 2) — Otimização global Claude Code (não-projeto, mas relevante)

Mudanças GLOBAIS (não específicas do traffic-manager) aplicadas em paralelo:
- **Profile GSD:** `~/.gsd/defaults.json` criado com `{"model_profile": "balanced"}` — subagents gsd-* automaticamente Sonnet pra execução, Haiku pra mapeamento/audit, Opus só pra planning/debug.
- **Regra de modelo por subagente:** adicionada em `~/CLAUDE.md` — toda chamada `Agent` precisa passar `model:` explícito (Haiku pra Explore, Sonnet pra general-purpose/Plan).
- **Vercel via MCP:** regra em `~/CLAUDE.md` pra usar `mcp__plugin_vercel-plugin_vercel__*` em vez de pedir Vercel CLI (Rafa não tem instalado).
- **Memory atualizada:** `feedback_model_selection.md` virou OBRIGATÓRIO; `feedback_vercel_mcp_default.md` criado; MEMORY.md index atualizado.
- **Sessão principal:** continua Opus 4.7 1M (`~/.claude/settings.json`). Rafa pode trocar com `/model` quando quiser baixar pra Sonnet em tarefas leves.

Efeito esperado: economia de token e velocidade em sessões longas, principalmente as que envolvem exploração de código (Explore agents agora rodam Haiku).

## Sessão 2026-05-04 — Vista hierárquica em /anuncios + Dashboard com pai

### Checkpoint (implementação concluída, build + push)
- **Commit:** `98740b2` feat(/anuncios): vista hierárquica Campanha → Conjunto → Anúncio com métrica viva por ad
- **O que mudou:**
  - `/anuncios` agora abre por padrão em vista "Por campanha" — agrupa cada userAd como campanha, expande conjuntos dentro, e mostra métricas individuais (gasto, impressões, cliques, CTR, mensagens, custo/msg) de **cada anúncio** dentro do conjunto. Toggle "Lista" mantém tabela plana.
  - Dashboard `ExecActiveAdsTable`: subtítulo agora mostra nome do conjunto + objetivo + raio (em vez de só "Conjunto · Joinville · raio X").
- **Arquivos criados:** `frontend/src/hooks/useCampaignsHierarchy.js` (busca paralela com cache TTL 60s + AbortController)
- **Arquivos modificados:**
  - `frontend/src/pages/Campaigns.jsx` — +600 linhas: HierarchyAdsSection, CampaignGroupCard, HierarchicalAdSetBlock, HierarchicalAdRow, MetricPill, helpers aggregateInsights/summarizeAdSetTargeting; toggle viewMode no header de filtros; ramificação no render
  - `frontend/src/pages/Dashboard.jsx` — subtítulo da linha de ad com nome do adset
- **Endpoint reaproveitado:** `/api/campaigns/:id/hierarchy` (já existente — usado pelo CampaignsHierarchy.jsx). Retorna campaign → adsets → ads com `ad.insights` (spend, clicks, link_clicks, impressions, reach, ctr, cpc, messages).
- **Pendência:** Relatorios.jsx tem 1 alteração não commitada (não é desta feature) — ficou na working tree pra Rafa decidir.
- **Build:** passou (1.37s, 891kB — avisos pré-existentes)

## Sessão 2026-05-03 — Feature: recomendação de investimento por bairro × serviço

### Checkpoint (implementação concluída, build passou)
- **Feature:** recomendação bairro × serviço implementada em 6 frentes
- **Arquivos criados:** `frontend/src/data/serviceInsights.js` (algoritmo puro)
- **Arquivos modificados:**
  - `frontend/src/pages/CreateAd.jsx` — select de serviço no Step1, banner evoluído no Step2
  - `frontend/src/pages/Campaigns.jsx` — painel DistrictInsightPanel no AdPreviewModal
  - `frontend/src/contexts/AppStateContext.jsx` — watcher de insights por serviço (6h, throttle 24h)
  - `backend/src/routes/campaigns.js` — endpoint GET /analytics/insights-by-service
- **Build:** passou (869kB — avisos pré-existentes de chunk size, sem erros)
- **Pendência:** Rafa fará commit/push após validar

## Sessão 2026-05-03 — Onda 7 (refinamentos completos pós-redesign)

### Commits da sessão (ordem)
- `d72b556` splash: malha tech viva, remove counter de loading
- `cbe7549` Dashboard MetricCard horizontal + alertas + tema button aceso + sino pulsa
- `3e4c17b` light replica estrutura dark + bg-tech sem ondas + searchbar 2x
- `28b6b12` topbar 96→116px (base "Resumo Meta" alinha com BEAUTY)
- `5616eec` feature: foto perfil IG Business no avatar da sidebar
- `1956d68` fix display name (não usa descrição IG, mantém "Cris Costa")
- `4bca334` revert splash: volta ao mock — 2 orbit-dots (rosa/azul) que se cruzam
- `b345aa7` topbar mais larga (840→1100), altura 116→132, gap greeting 1→5px
- `a6ce9b4` theme button: sol amarelo (light) / lua apagada (dark)
- `8c62d30` fonte global Inter → Open Sans (300-800 + italics)
- `43fa0af` sidebar light = dark estrutura (ilha flutuante + criar igual)
- `da11f65` searchbar full width (1500px) — não era o pedido
- `4093194` searchbar metade centralizada (750px)
- `cae9bd3` MetricCard proporções da print antiga (ícone esq + setinha)
- `2c94844` sidebar destaques unificados + bg-tech mais sutil (light .55 / dark .60)
- `14aba8a` chatbot animado: flutuando + olhos piscando + balão "Oi, como posso te ajudar?"
- `de62dbb` chatbot flutuação mais expressiva
- `daf3829` searchbar 2x (não funcionou — width ignorado por grid auto)
- `2d05a9d` linha separadora topbar bottom: 0 → 14px
- `eae87fb` chatbot amplitude reduzida (12→6px, ±3°→±2°)
- `738edd7` **FIX searchbar largura real** (era ignorado por grid `auto`)
- `8f79c46` searchbar 500px com clamp(240, calc(100vw-600px), 500) — responsivo
- `bd15971` saudação fixa "Olá, Cris" (era Bom dia/Boa tarde/Boa noite)

### Splash — sem loading, com malha tech
- Removidos: counter 0→100% + labels ("Conectando…/Pronto") + barrinha 3px na base
- Malha de 2 camadas animadas: branca 60px (fluxo diagonal 6s) + rosa 120px (contra-fluxo 14s) com pulse
- Scan line horizontal varrendo 4.5s + 5 nodes pulsando em delays escalonados
- Mantido: blobs animados, deco-rings, logo branca, 3 dots base

### Dashboard MetricCard com alertas
- Layout: ícone esquerda + label ao lado + valor abaixo (entrelinha 4px). minHeight 84px.
- Prop nova `alert` → stroke vermelho `#EF4444` 1.5px + halo 3px + glow + valor vermelho
- `alertReason` vai pro tooltip do "!" no header
- Thresholds plugados em `computeCampaignMetrics`:
  - Custo/resultado > R$ 30 (orçamento Cris R$ 15-20/dia)
  - CTR < 1% com >100 impressões
  - Frequência > 2,5
  - CPC implícito > R$ 1,20 com >5 cliques

### Sino de notificações pulsa rosa
- Botão pulsa box-shadow accent (1.6s loop) + ícone com scale+rotate sutil
- Cor + border do botão viram accent quando unread > 0
- Para automaticamente quando bellOpen=true OU unreadCount=0 (lê = marca read)

### Botão tema (refinado)
- **Estado atual** (após pedido do Rafa): ícone representa o estado ATUAL, não pra onde vai
- Light ativo → SunIcon **amarelo `#F5C447`** aceso (só ícone, sem glow/halo/border colorido)
- Dark ativo → MoonIcon **cinza neutro** `var(--c-text-3)` (apagado)
- Border permanece `var(--c-border)` (sem cor temática). Visual sóbrio.

### Sidebar (paridade light = dark)
- **Estrutura unificada:** ilha flutuante (top/left/bottom 16px, borderRadius 18, border + box-shadow) em ambos os temas. Box-shadow só muda a cor (preto dark, rosa sutil light).
- **Destaques unificados:** "Dashboard" e "Criar anúncio" agora idênticos (ambos com padding 7×14, height 36px, border-radius 10, hover lift + sombra rosa). Removida toda lógica `darkCreate` (glow forte + glass especial).
- **Gap** entre Dashboard e Criar: 14px → **6px**
- **Badge "NOVO"** removido (só aparecia no light antes; pra paridade some)
- Logo continua trocando: `marca-branca.png` no dark, `marca-colorida.png` no light

### Background tech (linhas e nodes)
- Linhas mais transparentes em ambos:
  - Light: stroke 0.13 → **0.06**, opacity geral .85 → **.55**
  - Dark:  stroke 0.22 → **0.10**, opacity geral .95 → **.60**
- Mask radial mais agressivo: 0.85 → 0.7 (fade mais forte nas bordas)
- Nodes radial gradient também mais discretos (light)

### Splash (final state — replicado do mock)
- Voltou ao mock original `.design/mockups/splash.html`
- 3 blobs animados (rosa/vinho/azul) + 2 deco-rings (branco 720 contra-rotação 60s + rosa 540 36s)
- **2 orbit-dots:** rosa accent (raio 270px, 12s) + azul `#60A5FA` (raio 360px, 22s reverso) — se cruzam
- Logo branca + divider gradient + tagline "Gestor de Tráfego"
- 3 dots rosa pulsantes na base
- **SEM:** counter %, malha viva, scan line, nodes pulsantes, barra de progresso
- Duração: 4s (HOLD_MS=3400 + EXIT_MS=600)
- Anti-flash rosa pré-React: body bg `#06080B` + script inline aplicando `data-theme` antes do bundle

### Fonte global
- Inter → **Open Sans** (300-800 + italics 400/600/700)
- Aplicado em `index.css` (@import + body) e `AIAssistant.jsx` (inline)

### MetricCard (Dashboard) — proporções da print antiga
- **Layout final:** ícone 40×40 à esquerda, alignSelf center; coluna direita com label uppercase em cima + valor 20px com setinha delta embaixo (sem pill, só ▲/▼ colorido)
- minHeight 72px, padding 14×18, gap 14
- **Alertas:** prop `alert` mantida — stroke vermelho `#EF4444` 1.5px + halo + glow + valor vermelho + tooltip via "!"
- **Thresholds em `computeCampaignMetrics`:**
  - Custo/resultado > R$ 30
  - CTR < 1% (com >100 impressões)
  - Frequência > 2,5
  - CPC implícito > R$ 1,20 (com >5 cliques)

### 🤖 Chatbot animado (AIAssistant.jsx)
- **Botão flutua suave:** translateY 0 → -6px, rotate ±2°, loop 2.6s
- **Glow pulsando** em paralelo (16px → 30px com extra rosa)
- **Olhos piscam:** scaleY 1 → .08, loop 4.5s, leve dessincronia entre olhos (transform-origin no centro de cada `<circle>`, transform-box: fill-box)
- **Balão de fala** "Oi, como posso te ajudar?" à esquerda do botão (right: 92px) com setinha apontando, fade-in .4s. Some quando chat abre. pointer-events: none.
- prefers-reduced-motion respeitado em todas as animações

### Sino pulsa rosa (ainda ativo)
- Botão pulsa box-shadow accent (1.6s loop) + ícone scale+rotate sutil
- Cor + border do botão viram accent quando unread > 0
- Para automaticamente quando bellOpen=true OU unreadCount=0 (lê = marca read)

### Light replica estrutura do dark
- `[data-theme="light"] .app-wrapper { background: transparent }` (deixa bg-tech aparecer)
- Topbar grid 116px aplicada nos dois temas (era só dark)
- bg-tech: removidas 2 curvas Bezier de "onda" (paths 5 e 6 do SVG)
- Opacidade linhas: dark 0.16→0.22, light 0.07→0.13. Opacity geral: dark .9→.95, light .7→.85
- Linha degradê topbar: rgba(0,0,0,.14) no light, rgba(255,255,255,.18) no dark
- App.jsx topbar unificada (removidas todas as bifurcações `isDark ? ... : ...`)

### SearchBar 2x mais larga
- maxWidth 420px → 840px (também no dropdown de matches)
- Placeholder com opacity .45 via `.topbar-search-input::placeholder`

### Topbar — altura, saudação, separador
- Altura: 96 → 116 → **132px** (subiu pra alinhar e folgar o conjunto)
- Saudação fixa: **"Olá, Cris"** (removido `greeting()` Bom dia/tarde/noite)
- Gap entre `Olá, Cris` e subtítulo: 1px → **5px** (leve respiro)
- Linha separadora: `bottom: 0` → **`bottom: 14px`** (sobe pra dentro)

### SearchBar — gotcha estrutural importante
- **Causa raiz descoberta no commit `738edd7`:** a coluna central do `.topbar-grid` é `auto` (encolhe ao conteúdo), então `maxWidth` no `<div>` interno era IGNORADO. Por isso 5 pedidos do Rafa pra "aumentar" não refletiam visualmente.
- **Fix definitivo:** trocar `width: 100%` + `maxWidth: Xpx` por `width: clamp(240px, calc(100vw - 600px), 500px)`
- **Estado final:** 500px em desktop, encolhe proporcionalmente em telas menores, mín 240px. Nunca sobrepõe greeting/ícones laterais.
- **Lição:** em grid com coluna `auto`, `maxWidth` no filho não funciona — precisa `width` fixa real ou mudar grid pra `1fr Npx 1fr` / `minmax()`.

### 🆕 Avatar da sidebar agora puxa foto do IG Business
- **Backend novo endpoint:** `GET /api/platforms/meta/instagram-profile` (`backend/src/routes/platforms.js`)
  - Decripta access_token, usa `ig_business_id` já persistido em `platform_credentials`
  - Chama Graph: `GET /{ig_business_id}?fields=id,username,name,profile_picture_url`
  - Cache em memória 30 min (CDN do FB rotaciona em horas)
- **Frontend (`AppStateContext.jsx`):** após hidratar `/api/platforms`, se houver `ig_business_id` busca o endpoint novo e popula:
  - `metaAccount.avatarUrl` → `<img>` da Sidebar (fallback CC)
  - `metaAccount.username` → handle (`criscosta.beauty`)
  - `name` NÃO é sobrescrito (descrição IG é "SOBRANCELHAS / MICROPIGMENTAÇÃO…" — não serve como display). Mantém "Cris Costa"
- **Validado em prod:** endpoint retorna profile_picture_url da CDN do FB. ig_business_id da Cris: `17841456891955614`. Username: `criscosta.beauty`. Link público: https://www.instagram.com/criscosta.beauty/

---

## Sessão 2026-05-02/03 — REDESIGN COMPLETO em 4 ondas + light glass

### Resumo
Redesign visual aplicado em **TODAS as 12 rotas** + SplashScreen + sidebar/topbar + light mode glass equivalente. Trabalho dividido em 4 fases executadas em paralelo via 5 agentes especializados, seguindo `.design/STYLE_GUIDE.md` (criado pra garantir consistência).

### Commits da sessão
- `dcc0bcb` — Onda 4 paridade visual: greeting topbar + dashboard limpa
- `45a9ada` — Fase 1+2: Dashboard 1:1 mockup + tema glass nas 11 telas
- `6361466` — Fase 3: light mode glass equivalente
- `c92919f` — fix último hardcode AIAssistant

### Fase 1 — Dashboard 1:1 com mockup (sem demolir features)
Dashboard.jsx (+481 linhas) ganhou seção "Resumo executivo" no topo (apenas dark) com 6 componentes locais novos:
- `ExecMetricCard` — card glass com label uppercase, valor 30px tnum, delta %
- `ExecBarsChart` — 14 barras verticais com valor em cima, HOJE em branco→accent
- `ExecNextDates` — pílulas accent-soft pras datas comerciais
- `ExecActiveAdsTable` — top 5 anúncios com badge status
- `buildMessagesSeriesMock` — gera 14 dias plausíveis escalados pelo total real do AppState
- `ResumoExecutivo` — orquestra tudo, responsive grid

`LearningPhaseCard`, `CampaignMetricsBlock`, `RingPerformanceCard`, `RingRecommendation`, `BalanceCard`, `CpcAlertCard` permanecem ABAIXO como "Detalhes operacionais". 100% das features preservadas.

### Fase 2 — Tema glass dark nas 11 telas (4 agentes paralelos)
- **2A** — `Campaigns.jsx` + `CampaignsHierarchy.jsx` + `Relatorios.jsx`
- **2B** — `Calendar.jsx` + `Investment.jsx` + `Rejected.jsx`
- **2C** — `Audiences.jsx` + `CreativeLibrary.jsx` + `References.jsx`
- **2D** — `CreateAd.jsx` (wizard 5 passos) + `History.jsx`

Cada agente leu `STYLE_GUIDE.md` e aplicou:
- Wrappers de cards → `className="ccb-card"` (deixa CSS global atuar)
- Hardcodes `#d68d8f` / `rgba(214,141,143,X)` → `var(--c-accent)` / `rgba(193,53,132,X)`
- Cores semânticas (verde/vermelho/amarelo/azul) → versões dark coerentes (`#34D399`, `#F87171`, `#FBBF24`, `#60A5FA`)
- Subtítulos/metadata em **fontWeight 400** (eram 500-700)
- Botões CTA com gradient accent + glow
- Inputs/badges padronizados conforme STYLE_GUIDE
- Modais com backdrop-filter blur

### Fase 3 — Light mode glass equivalente
Criado `[data-theme="light"]` explícito que sobrescreve `:root` com paleta glass clara:
- `--c-page-bg: #FAF7F8` (rosé muito claro)
- `--c-card-bg: rgba(255,255,255,.65)` + backdrop-filter
- `--c-border: rgba(0,0,0,.08)` (sutil escura)
- `--c-accent: #C13584` mantido (mesmo do dark)
- Glows pastel rosé nos cantos (`.10`-`.18` opacity, mais sutis que dark)
- bg-tech com linhas escuras `.07` (em vez de brancas `.16` do dark)
- Noise feTurbulence com 40% alpha (vs 60% do dark)
- `.ccb-card` no light: glass branco translúcido + reflexos shine `.5`

ThemeContext sempre seta `data-theme="light"` quando `!isDark` (não precisou alterar lógica). `:root` continua como fallback pré-JS-load.

### Fase 4 — Validação final (varredura QA)
- ✅ Build prod OK em 1.22s
- ✅ Hardcodes `#d68d8f`/`rgba(214,141,143)` em **0 arquivos JSX/JS** (10 restantes em index.css são fallback intencional do `:root`)
- ✅ 12/12 rotas retornam 200 em prod (testadas via curl)
- ✅ `/api/health/full` 4/4 OK (DB, Meta 49d, Groq, Webhook)
- ✅ Sem regressões funcionais (lógica/state/hooks/handlers intactos em todos os arquivos)
- ✅ Light mode preservado e ainda repaginado pra glass equivalente
- ✅ SplashScreen dark intacta

### Artefatos da sessão
- `.design/STYLE_GUIDE.md` — contrato visual usado pelos 5 agentes
- `.design/mockups/` — 4 HTMLs aprovados (dashboard, splash, criativos-spy, index)
- `.design/refs/` — 2 imagens de referência (AgentOS GLASS + Sidebar AgentOS)
- `.design/atual/` — 28 prints automáticos pré-redesign

### Pendências / próximas iterações
- Comparar com `.design/atual-v3/` (recapturar prints novos pós-redesign — feito automaticamente via `cd .design/scripts && node capture.js`)
- Sidebar logo continua DENTRO da sidebar (não migrou pra `.brand-area` separada — trade-off documentado: refactor de flex→grid era pesado e não mudaria experiência funcional)
- Code-splitting do bundle (~819kB) — só se virar dor real

---

## Sessão 2026-05-02 tarde — REDESIGN VISUAL Glassmorphism dark + accent rosa #C13584

### Resumo
Redesign visual aprovado por Rafa após 7 iterações em mockups standalone (`.design/mockups/`). Aplicado APENAS no dark mode — light mode 100% preservado (paleta rosé pastel original intacta). Inspirado na ref AgentOS (`.design/refs/ref geral GLASS.webp` + `Sidebar ref.png`).

### Decisões fechadas (Q&A com Rafa)
| Q | Decisão |
|---|---|
| Hex do rosa principal | **`#C13584`** (Instagram pink) |
| Rosa secundário | **`#7D4A5E`** (vinho — detalhes) |
| Light mode | **Intocado** — só dark vira glass |
| Glow ambient | **Sim, com movimento** (skip mobile + reduced-motion) |
| Cores semânticas | **Mantidas** (verde aprovado, vermelho rejeitado, etc) |

### Mudanças aplicadas (commit `6ed794a`)
- **`frontend/src/index.css`**: bloco `[data-theme="dark"]` reescrito com tokens glass dark fumê (`rgba(18,24,30,.45)`), accent `#C13584`, `--c-accent-glow` `rgba(193,53,132,.55)`. Adicionados `body::before` (SVG bg-tech com linhas+nodes), `body::after` (spotlight central + 2 glows nos cantos), `body bg-image` (noise feTurbulence). `.ccb-card` no dark ganhou `backdrop-filter: blur(28px)` + reflexo top + shimmer diagonal. Fallbacks: `prefers-reduced-motion` + `max-width: 768px` (blur reduzido).
- **`Sidebar.jsx`**: sidebar vira **ilha flutuante** no dark (top/left/bottom: 16px, height: calc(100vh - 32px), border-radius: 18px, border completa, box-shadow profunda). Light mantém sólida.
- **`App.jsx`**: topbar transparente no dark (background: transparent, backdrop-filter: none) — bg do app passa atrás. Main-content ajusta margin-left no dark pra caber sidebar flutuante.
- **`SplashScreen.jsx`**: reescrita do zero — fundo `#06080B`, 3 blobs animados (rosa/vinho/azul), 2 deco-rings dashed contra-rotacionando, grid sutil mascarado, logo trocada `marca-colorida` → `marca-branca`, "Gestor de Tráfego" em rosa accent. Mantido HOLD_MS/EXIT_MS/onDone/playWelcome.
- **Hardcodes `#d68d8f` → `var(--c-accent)`**: Sidebar (avatar gradient + sombra), App (toast + dropdown), Dashboard (9 trocas no SVG do gráfico, ícones, dots, tooltip), Campaigns (PLAT.instagram.color), index.css (input[type="range"] accent-color).

### Trade-off documentado
Logo Cris **continua dentro da sidebar** (não foi separada como `.brand-area` no grid como no mockup). Razão: sistema usa `position: fixed` na sidebar + flex no `.app-wrapper`. Mover logo pro grid exigiria refactor de fundação que poderia quebrar layout das 12 rotas. Visualmente fica OK porque a ilha flutuante "abraça" o logo no topo. Pode ser tratado em onda separada se Rafa quiser.

### Validação ao vivo (após deploy)
- `/api/health/full` → **4/4 OK** (DB, Meta 49d, Groq, Webhook)
- 12 rotas testadas → **todas 200**
- Build prod → **1.03s**, CSS 32.41 → 35.95 kB (+3.5), JS 815 → 819 kB (+4)
- Light mode preservado (`:root` em index.css linhas 18-53 intacto)
- Sem regressões funcionais (varredura confirmou: nenhum useState/useEffect/handler removido)

### Pendente — próxima onda
Hardcodes `#d68d8f` ainda em: `AIAssistant.jsx`, `Calendar.jsx`, `CreateAd.jsx`. Trocar por `var(--c-accent)` quando Rafa quiser.

### Ref e mockups
- Refs: `.design/refs/ref geral GLASS.webp`, `.design/refs/Sidebar ref.png`
- Mockups standalone (3): `.design/mockups/{dashboard,splash,criativos-spy}.html` + `index.html`
- Plano completo: `C:\Users\Rafa\.claude\plans\coloquei-na-pasta-refs-snazzy-unicorn.md`

---

## Sessão 2026-05-02 tarde — FEATURE Espionar Concorrente (CreativeLibrary)

### Implementação inspirada na skill bravo `espionar-concorrente-pro`
Decisão arquitetural: **NÃO portar Playwright pro backend Vercel.** Serverless tem timeout 10–60s e bundle limit 250MB; Chromium não cabe. Em vez disso, fluxo "Lite assistido": usuário cola screenshots e textos da Facebook Ads Library, IA Groq lê e devolve análise. Estrutura preparada pra trocar coletor manual por worker externo (Railway/Apify) no futuro sem refatorar relatório/DB.

### Stack
- **Vision:** `meta-llama/llama-4-scout-17b-16e-instruct` (Groq) — descreve cada print de ad
- **Agregador:** `llama-3.3-70b-versatile` em JSON mode — devolve `{summary, patterns, hooks, ctas, creative_formats, recommendations}`
- **Persistência:** tabela `competitor_analyses` (PG + SQLite, JSON em TEXT pra portabilidade)

### Endpoints novos (`backend/src/routes/competitors.js`)
- `POST /api/competitors/describe-item` — 1 item por call (cabe em timeout serverless)
- `POST /api/competitors/analyze` — agrega + persiste
- `GET /api/competitors` — lista (50 mais recentes)
- `GET /api/competitors/:id` — detalhe completo
- `DELETE /api/competitors/:id`

### UI
- Tab "Espionar concorrente" dentro da página `Biblioteca de criativos` (CreativeLibrary)
- Drop zone de imagens + textarea pra colar copy + lista de itens com preview
- Progresso por item (Promise.all chamando describe-item) + relatório renderizado em cards
- Histórico de análises com Abrir/Apagar

### Commit
`1728361 feat(spy): tab "Espionar concorrente" na CreativeLibrary com analise IA`

### Não-bloqueado — próximo passo possível
Se virar uso pesado (>10 análises/semana): plugar worker Node+Playwright em Railway pra automatizar o "coletor", mantendo a mesma rota `/analyze` no Vercel.

---

## Sessão 2026-05-02 tarde — FIX mapping de mensagens iniciadas (2 bugs)

### Sintoma observado ao vivo (2026-05-02 ~13:04 GMT-3)
- 437 Cravos: ACTIVE, 276 link_clicks, 4,5% CTR, R$ 0,12 CPC, **0 mensagens registradas no painel** ❌
- 436 Nano: ACTIVE, 161 link_clicks, **86 mensagens (stale, valor de quando clicks era 86)** ⚠️

### Causa raiz — 2 bugs encontrados
1. **`/sync-meta-status` (polling 90s) não tinha mapping `wa.me/`** — só `keepMax(r.conversions, local.conversions)`. Sem WhatsApp Business linkado à Page, Meta nunca dispara `messaging_conversation_started_7d`, então `r.conversions` é sempre 0. `keepMax` preserva valor antigo eternamente (86 stale na 436) ou mantém 0 se nunca foi mapeado (caso 437).
2. **Sync completo (`syncPlatform`) usava `c.clicks` em vez de `c.link_clicks`** — `clicks` total inclui profile click/like/save (overcontagem). Proxy correto é `inline_link_clicks` (= abriu wa.me).

### Fix aplicado (4 arquivos)
- **`services/sync.js`**: `isMessagesViaWaLink` movido pra escopo do módulo + exportado. Mapping passa a usar `c.link_clicks || c.clicks` (proxy correto). Loop de insights-by-district idem (`row.inline_link_clicks` com fallback).
- **`services/metaAds.js`**: `fetchAccountInsights` e `fetchAdSetInsights` passam a pedir `inline_link_clicks` ao Meta (antes só pedia `clicks`).
- **`routes/campaigns.js`**: `/sync-meta-status` importa `isMessagesViaWaLink` e aplica mesma lógica de mapping antes do `keepMax`. Persiste flag `conversions_mapped_from_clicks` no payload.

### Backfill validado em prod (após commit `9b1ff2b`)
- **437 Cravos: 0 → 277** mensagens · R$ 0,20/msg ⬆️
- **436 Nano: 86 stale → 163** mensagens · R$ 0,42/msg ⬆️

### Iteração do fix (2 commits)
- `b8adf08` primeiro fix — descobriu na validação que 2 issues residuais quebravam:
  - Mapping skipava quando `rConversions > 0` (Meta retornou 1 espúrio na 436 → keepMax preservava 86 stale)
  - Response do `/sync-meta-status` retornava `r.conversions` cru em vez de `nextConversions`
- `9b1ff2b` correção — pra wa.me/ SEM WA Business, sempre prefere link_clicks (Meta sempre é ruído nesse cenário). Response devolve next* values.

### Inversão da hierarquia de campanhas
- Antes do fix: 436 Nano parecia única convertendo (86 msgs vs 0 da 437)
- Depois do fix: **437 Cravos é a vencedora** (277 msgs · R$ 0,20) — quase 2x as mensagens da 436 (163 · R$ 0,42) com gasto 20% menor
- Limpeza de pele tem demanda mais ampla (todos gêneros, idade 28-50) vs nano (só feminino, 28-45)

### Não bloqueado — mas próximo
- Quando Cris cadastrar WhatsApp na Page (via suporte Meta), `messaging_conversation_started_7d` vai disparar de verdade → contagem REAL de mensagens (não proxy via cliques). Mapping continua como fallback automático nas que já rodaram sem WA Business.

---

## Sessão 2026-05-02 tarde — MCP Meta desativado temporariamente

`.mcp.json` renomeado para `.mcp.json.disabled`. O servidor MCP `https://mcp.facebook.com/ads` rejeita o registro dinâmico (DCR/RFC 7591) do client OAuth do Claude Code com erro `The provided redirect_uris are not registered for this client.` — falha na etapa de registro, antes de gerar URL de autorização. Confirmado que erro persiste tanto via `/mcp` quanto via tool direto `mcp__meta-ads__authenticate`. Não é problema do FB_APP_ID/conta da Cris — é política do servidor MCP do Meta (provável: rollout fechado, sem suporte a `http://localhost:*` redirect_uri ainda).

**Não-impacto:** integração Meta principal (OAuth próprio + token criptografado + refresh automático em `services/metaToken.js`) segue 100% funcional. MCP era conveniência adicional.

**Para reativar (futuro):** `mv .mcp.json.disabled .mcp.json` e tentar `/mcp` novamente. Vale checar se Anthropic/Meta destravaram DCR antes.

---

## Sessão 2026-05-02 manhã — VARREDURA 2 APLICADA (4 commits)

### Findings da Varredura 2 (recuperada do JSONL da sessão anterior)
0 CRITICAL · 3 HIGH · 4 MEDIUM · 2 LOW. Lista completa OK confirmados (webhook signature, OAuth CSRF, AES-256-GCM, refresh lock, chunked upload, SQL injection, CASCADE, metaNormalize, mediaProcessor, double-submit).

### Aplicado (4 commits atômicos)
- **`36e53d2`** chore(security): CORS whitelist + Helmet headers
  - CORS sem fallback `*`. Aceita FRONTEND_URL + localhost + `*.vercel.app` previews. Warn se var ausente.
  - Helmet ativo (CSP/COEP off pra não bloquear Vite inline + thumbs Meta). 6 headers verificados em prod: Referrer-Policy, HSTS, X-Content-Type-Options, X-Dns-Prefetch-Control, X-Frame-Options=SAMEORIGIN, X-Permitted-Cross-Domain-Policies.
- **`3adfcfa`** refactor(upload): DDL único + cleanup orgânico
  - `IMAGE_UPLOAD_SESSIONS_DDL` exportado de `migrate.js`, importado em `upload.js` (single source).
  - Cleanup inline em `POST /image/start`: DELETE >24h antes do INSERT. Em Vercel serverless o boot pode não rodar por dias — antes BLOBs até 30MB acumulariam no Neon.
- **`576e623`** chore(webhook): log content-type quando rawBody undefined (debug 401 silencioso quando Meta manda content-type fora de application/json).
- **`08dd86b`** docs(schema): tabela `users` marcada DEPRECATED (auth removida; TODO de drop futuro + checklist se reativar).

### Pulei (com motivo)
- **OAuth POST body** (HIGH risco baixo): query string com `client_secret` em `platforms.js:264`. Risco de quebrar reconnect ativo da Cris (token longo válido 49 dias). Mantém TODO pra próxima janela de manutenção.
- **DROP TABLE users** (destrutivo): só comentário/TODO. Drop precisa autorização explícita.
- **`refreshLocks` multi-instância** (LOW): impacto real baixo (Meta invalida token anterior).
- **`upload_session_id` validação local** (LOW): Meta rejeita formato inválido.

### Validação ao vivo (2026-05-02 13:01 GMT-3)
- `/api/health/full` — 4/4 OK (DB, Meta act_1330468201431069 token 49d, Groq, Webhook).
- Helmet headers presentes na resposta de prod.
- CORS funcionando (curl server-to-server passa, navegador cross-origin não permitido cai no callback).
- Sem regressão nas 4 integrações.

### Próximo (Rafa)
1. Cadastrar WhatsApp na Page Facebook (Sobre → Informações) — desbloqueia Click-to-WhatsApp formal das 437/436.
2. Confirmar via `/api/platforms/meta/diagnose-page` (`can_run_click_to_whatsapp: true`).
3. Aguardar Meta aprovar duplicates pendentes (PENDING_REVIEW → ACTIVE).

### Pendente de autorização do Rafa
- **`/schedule diagnose-page`** — Rafa autorizou em concept ("sim") mas pediu explicação leiga antes; sessão fechou sem criar a routine. Próxima sessão: criar routine recorrente (sugestão original: 30min, 7-22h GMT-3) que monitora `can_run_click_to_whatsapp` e dispara sino quando virar `true`.
- **DROP TABLE users** — só com OK explícito.

### Estado consolidado do sistema (2026-05-02 ~10:15 GMT-3)
**Código:** zero pendência crítica. 4 integrações ok. Helmet em prod com 6 headers. CORS whitelist. Uploads com cleanup orgânico.
**Operacional:** depende só de Cris (cadastro WhatsApp) + Meta (aprovação duplicates).
**Backlog conhecido (não-bloqueante):** OAuth POST body (esperar reauth ~49d), refreshLocks multi-instância, validação local de upload_session_id, sync Meta por bairro pular duplicados, editor orçamento adset não atualiza payload local, cron sync automático, code-splitting 670kB.

### Documento didático gerado
Explicação leiga de cada item (5 categorias × N itens cada) entregue ao Rafa em chat — não persistida em arquivo. Se quiser referenciar no futuro, basta pedir "explica de novo aquele item X".

---

## Sessão 2026-04-30 noite — MENSAGEM WHATSAPP PRÉ-PREENCHIDA (3 commits)

### Diagnóstico
- 437 (Cravos) e 436 (Nano): 22h+47h ao ar, **202 cliques somados, 0 mensagens recebidas**.
- Causa raiz: `destUrl` = `wa.me/55479971...` SEM `?text=` → WhatsApp abre vazio, dropoff 50-80%.
- Page Cris (`criscosta_sobrancelhas`) sem WhatsApp Business linkado: `can_run_click_to_whatsapp: false`. Click-to-WhatsApp formal indisponível **hoje** — Cris vai cadastrar manualmente no Facebook Page → Sobre → Informações.

### Decisão (Council exposto pro Rafa)
Pausar AS 2 (sangria zero), duplicar ad dentro do mesmo adset com mensagem pré-preenchida (preserva campaign+adset históricos), reativar quando Meta aprovar.

### Implementação
- **`metaWrite.replaceCreative`**: cria novo creative reusando video_id+image_hash + atualiza ad existente (mesmo ad_id). Sanitiza `image_url`/`thumbnail_url` que GET retorna mas POST rejeita (erro 1443051 ObjectStorySpecRedundant).
- **`metaWrite.duplicateAdInAdSet`** (escolha do Rafa pra preservar métricas raw): cria NOVO ad irmão dentro do MESMO adset com creative novo. Ad antigo permanece intacto.
- **`POST /api/campaigns/:id/duplicate-ad`**: orquestra. Aceita `{whatsappMessage, ctaLabel?}`. Monta `wa.me/...?text=encoded` via URLSearchParams. Detecta WA Business linkado — força `LEARN_MORE` se Page sem WA (proteção contra erro 1487891). Registra cronologia em `payload.duplicated_ads`.
- **`PATCH /:id/status` skip-old-ads**: após cascade ativar, re-pausa todos `old_ad_id` do `duplicated_ads`. Garante que **só `metaPublishResult.ad_id` atual entrega** quando Rafa der play.
- **Frontend `CreateAd.jsx` Step5Creative**: campo "Mensagem WhatsApp" entre destUrl e CTA, visível só quando `isWaMeLink`. Default dinâmico baseado no headline + botão "Restaurar padrão" + preview ao vivo do link Meta.

### Estado final ao vivo (2026-05-01 ~01:35 GMT-3) — ambas paused
- **437 Cravos**: pointer ad `120245845516620627` · `wa.me/...?text=...limpeza+de+pele` · cta_type=LEARN_MORE · 4 ads no adset (3 antigos serão re-pausados na ativação)
- **436 Nano**: pointer ad `120245845456690627` · `wa.me/...?text=...nanopigmenta%C3%A7%C3%A3o` · cta_type=LEARN_MORE · 3 ads no adset (2 antigos serão re-pausados)

### Verificação ctaLabel="WhatsApp" sem WA Business
Testado ao vivo (criou ad 3 na 437): sistema retornou `cta_type: "LEARN_MORE"` silenciosamente (não quebrou). Botão visível pro user final = "Saiba mais" (LEARN_MORE).

### Bug visível no painel
- 436 tem 1 ad com encoding ruim (`nanopigmenta\xEF\xBF\xBDo`) por causa de UTF-8 quebrado no bash do Windows na 1ª tentativa. Marcado pra re-pause automático na ativação. Não rodará. **Fix aplicado:** posts subsequentes via `--data-binary @/tmp/file.json` com UTF-8 limpo.

### Próximo (Rafa)
1. Cadastrar WhatsApp na Page Facebook (Sobre → Informações) — destrava Click-to-WhatsApp formal (botão "Enviar mensagem" + WA verde + métrica = mensagens iniciadas)
2. Quando Cris confirmar, rodar `/api/platforms/meta/diagnose-page` pra confirmar `can_run_click_to_whatsapp: true`
3. Aguardar Meta aprovar os ads novos (effective_status PENDING_REVIEW → ACTIVE) — costuma <2h
4. Rafa clica play no painel → cascade ativa só os ads atuais (skip-old-ads garante)

### Commits
- `271842f` feat(meta): duplicateAdInAdSet + endpoint /:id/duplicate-ad
- `b0f866a` fix(meta): sanitiza object_story_spec ao clonar creative
- `6870bfb` feat: campo Mensagem WhatsApp no CreateAd + skip-old-ads no cascade

---

## Sessão 2026-04-30 madrugada — CASCADE PLAY/PAUSE/DELETE GARANTIDA (1 commit)

### Garantia end-to-end pra TODA campanha (atual e futura)

**Commits:** `0b30b48` — feat(cascade)

**`metaWrite.updateCampaignStatus`:**
- Retorna `cascade_summary` com `{campaign, adsets:{total,changed,failures}, ads:{total,changed,failures}}`
- Falhas individuais não bloqueiam — coletadas no summary

**`/api/campaigns/:id/status` (PATCH):**
- Resposta inclui `cascade_summary` pro frontend mostrar
- activity_log persiste summary

**`/api/campaigns/cascade-heal` (POST) — NOVO endpoint:**
- Percorre TODAS campanhas Meta `active`/`paused` no banco
- Força cascata pro estado declarado
- Best-effort (1 falha não bloqueia outras)
- Útil pra: auto-corrigir mismatches em massa, botão "verificar tudo", verificação pós-deploy

**DELETE (já existia):**
- Documentado: `DELETE /campaign_id` no Meta cascateia automaticamente (remove adsets + ads + creatives na mesma call)

### Validação end-to-end (2026-04-30 02:50 GMT-3) — 2/2 verde
- **Cascade-heal:** 2 campanhas verificadas, 0 mismatches
- **PAUSE 437:** campaign+adset+ad → PAUSED (1+1 mudanças, 0 falhas)
- **PLAY 437:** campaign+adset+ad → ACTIVE (1+1 mudanças, 0 falhas)
- **Ad da 437 entrou em IN_PROCESS** (revisão Meta) — vai entregar em ~5-30min

### Próximo
- Aguardar Meta aprovar a 437 (IN_PROCESS → ACTIVE)
- Sistema blindado contra mismatch de status entre níveis

---

## Sessão 2026-04-30 madrugada — COBERTURA SYNC META COMPLETA (3 commits)

### Bug raiz descoberto via auditoria por agente
- `inline_link_clicks` da camp 436 (nano) mostrava 4 no Meta, **0 no painel**.
- Auditoria parallela do agente revelou problema sistêmico: polling `/sync-meta-status` (90s) **só atualizava** spent/clicks/impressions/conversions. **Faltavam:** link_clicks, reach, ctr, cpc, cpm, frequency, ads[] effective_status, issues_info.
- Pior: nunca lia status do **AD** (só campaign). Por isso camp 437 ficou 8h "Ativo" com adset_paused invisível.

### Fixes aplicados (commits 0c5bd65, f7bdae1, eba18d3)

**Backend `metaAds.js`:**
- `fetchCampaigns` expande `ads.limit(25){effective_status,issues_info,ad_review_feedback,created_time,status,id}` no fields. Sem chamada extra.
- Retorna `frequency` direto do Meta (em vez de cálculo manual).

**Backend `routes/campaigns.js` (/sync-meta-status):**
- SELECT inclui `link_clicks`, `payload`, `effective_status`.
- UPDATE atualiza coluna `link_clicks` + payload mescla reach/ctr/cpc/cpm/freq/ads.
- Atualiza `payload.meta.{campaign,ad}.status/effective_status` com valor fresco.
- Detecta transição de ad pra DISAPPROVED/WITH_ISSUES → registra activity_log.
- Removido guard que pulava campanhas sem entrega (para 437 receber ads[]).

**Backend `services/sync.js`:**
- Mesma detecção ad-level.
- Persiste `ads[]` e `frequency` no payload.

**Frontend `AppStateContext.jsx`:**
- Merge inclui link_clicks, reach, ctr, cpc, cpm, frequency, ads_meta.
- `worstAdStatus` (DISAPPROVED > WITH_ISSUES > PAUSED > PENDING_REVIEW > ACTIVE).
- Transitions usam worst ad-level (não só campaign).
- Sino pra ADSET_PAUSED + CAMPAIGN_PAUSED (casos 437).

### Validação end-to-end (2026-04-30 02:30 GMT-3)
- Camp 436: link_clicks=44, reach=2927, ctr=2.20%, cpc=R$0.25, freq=1.33, ad ACTIVE — TODOS OK.
- Camp 437: ad **ADSET_PAUSED** detectado (Rafa só ligou ad, não conjunto).
- Audit `/api/campaigns/:id/audit` 14/14 OK pra 437; 13/14 pra 436 (CTA "WhatsApp"→"LEARN_MORE" é fallback wa.me intencional).
- 29/29 testes Vitest passando. Build OK. require() limpo.

### Pendência
- Rafa precisa ligar o **conjunto** da 437 no Meta Ads Manager (ad já ligado, mas adset paused = ad não entrega). Em ~90s o sino vai notificar isso automaticamente.
- Backlog: implementar play do conjunto/ad direto pelo painel (hoje toggle só campanha; cascata existe mas não tem botão pra adset/ad isolado).

---

## Sessão 2026-04-29 noite — STATUS PÓS-PUBLISH "ATIVO ENGANOSO" (1 commit)

### Bug crítico descoberto após 8h da camp 437 sem entregar
- Camp 437 "Adeus cravos!!!" publicada 18:57 GMT-3 ficou 8h com **0 impressões / 0 cliques**.
- Painel mostrava "Ativo". Mas no Meta os 3 níveis (campaign+adset+ad) estavam **PAUSED**.
- Rafa não percebeu porque o painel mentia. Descobriu só ao abrir Meta Ads Manager.

### Causa raiz (dupla)
1. **Backend** (`routes/campaigns.js:60,78`): após publish, status local virava `'review'` ou `'active'`. Mas `publishCampaign` cria os 3 níveis PAUSED no Meta de propósito (segurança). Divergência local vs Meta.
2. **Frontend** (`AppStateContext.jsx:addAd`): otimismo criava ad com `status:'active'` e na resposta do backend só atualizava `id`, ignorando o `status` retornado. Status real ficava mascarado pra sempre.

### Fix aplicado (`6977ff8`)
- Backend: status pós-publish agora é `'paused'` (alinhado com Meta)
- Frontend: `addAd` reconcilia `status` + meta IDs com o `serverAd`
- Resultado: próxima campanha publicada aparece como **Pausado** com botão ▶ visível. Click cascateia ACTIVE pros 3 níveis (`metaWrite.updateCampaignStatus` já cascateava — só ninguém clicava porque parecia já ativo).

### Aviso #1870194 (cosmético, não bloqueia)
- Meta removeu opções "pessoas que moram / visitaram / estiveram" no targeting de localização.
- Mensagem: "Seu conjunto continuará a ser veiculado para sua seleção atual até que você o altere."
- **Não é bloqueio.** Bairros configurados continuam válidos. Atualizar manualmente é cosmético.
- Backlog: remover `location_types: ['home']` do `metaNormalize.js` (linhas 368, 405) — não urgente.

### Estado atual da camp 437 (2026-04-30 02:00 GMT-3)
- Rafa ligou conjunto + ad **manualmente no Meta Ads Manager** após diagnóstico.
- Status: anúncio em revisão Meta (PENDING_REVIEW).
- Aguardando aprovação. Quando aprovar, começa a entregar.

### Pendência
- Aguardar Meta aprovar a 437. Sync de 90s atualiza status no painel automaticamente.
- (Não-urgente) limpar `location_types: ['home']` do publish.

---

## Sessão 2026-04-29 tarde — UPLOAD CHUNKED + DASHBOARD UX (8 commits)

### Mudanças estruturais
1. **Upload de vídeo chunked** (`fedd5f7`): chunks de 3.5MB pelo backend → Meta Resumable Upload Protocol (`/advideos` com phase=start/transfer/finish). Token Meta NUNCA sai do servidor. Vídeos até 4GB com qualidade original. Mediaprocessor agora pass-through pra H.264 (sem comprimir mais pra caber em 4MB).
2. **Upload de imagem chunked** (`73bdcf9` + `5c9ce29`): mesma arquitetura, com buffer no DB (tabela `image_upload_sessions` BYTEA). Imagem até 30MB sem compressão. Tabela criada lazy no endpoint (`ensureImageSessionsTable`) porque migration inicial não rodou em deploy novo.
3. **Botão "Abrir no Meta" sempre presente** (`b30fa73`): novo helper `metaAdsManagerUrl(ad)` em Campaigns.jsx — sempre retorna URL com colunas configuradas pelo Rafa. Inclui `selected_campaign_ids` e `selected_ad_ids` quando IDs Meta válidos.
4. **Métrica "Cliques no link"** (`46a3eec`): puxa `inline_link_clicks` do Meta. Card no dashboard depois de "Cliques". `link_clicks` adicionado no schema, sync.js, metaAds.js.

### Bugs corrigidos
- **end_date no audit**: `c.end_date` no Postgres é Date object midnight UTC; `String(Date)` virava "Tue May 05" e `toBRDate` (-3h) atrasava 1 dia. Fix: `getUTCFullYear/Month/Date` pra extrair YYYY-MM-DD sem timezone shift. Commits `52351bc` + `99c7287`. **Audit campanha 436 agora 15/15 verde.**
- **Filtro "VER:" no Dashboard**: select retorna string mas `c.id` é number; comparação `===` falhava. Fix: `String(c.id) === String(selectedId)`. Inclui useEffect que reseta quando campanha sai do ar. Commit `46a3eec`.

### Incidente de deploy resolvido
Tentei `vercel deploy --prod` localmente mas o CLI não puxa env vars de prod — site quebrou (~5 min). Recuperação: empty commit (`2b29200`) pra disparar GitHub auto-deploy. **Lição:** nunca usar `vercel deploy` local nesse projeto, só push pro GitHub.

### Campanha 437 "Adeus cravos!!!" — limpeza de pele
- **Status:** PAUSED no Meta (precisa play). ID Meta `120245773279470627`.
- **Pacote:** R$ 60 × 3 (R$ 180 ticket), 8 bairros 3km (Anita, Atiradores, Saguaçu, Boa Vista, América, Glória, Centro, Costa e Silva), 28-50 anos, **gênero TODOS** (unisex), 3 interesses validados (Skincare, Cosmetics, Beauty Shop).
- **Vídeo:** "Limpeza de pele Rafa_FINAL.mp4" subiu chunked em ~3min, qualidade 100% (1ª campanha sem compressão).
- **CTA:** Saiba mais (forçado pelo fallback wa.me/, mantido).
- **Audit:** 15/15 ✅ — overall_ok:true, zero issues.
- **Decisão Rafa:** mudou copy do título da Opção 2 ("Adeus cravos · 3x R$ 60") pra "Adeus cravos!!!" (mais informal).

### Regra permanente nova (memória global)
- **Respostas curtas e diretas**: 2-5 linhas, veredicto + próximo passo, sem listas longas, sem 3 opções, sem Council exposto. Salva em `feedback_concise_responses.md` e adicionada no MEMORY.md global. Vale pra TODO projeto.

### Pendência
- 1ª campanha "Adeus cravos!!!" pausada — Rafa precisa apertar play (no sistema ou no Meta, ambos sincronizam).
- Próximo sync (90s pós-deploy) vai popular `link_clicks` da campanha 436 e 437.

---

## Sessão 2026-04-28 noite — AUDITORIA TOTAL Meta v22+ (8 commits)

### Bugs críticos descobertos e corrigidos
1. **GENDER invertido** (`94eabb7`): female=[1] e male=[2] estavam invertidos. TODA campanha "feminino" rodava pra HOMENS. Causa real do CTR alto + zero conversão da 424. Doc Meta: 1=men, 2=women.
2. **Bairros sobrepostos descartados** (`e0555f1`): dedupeOverlappingGeos descartava bairros silenciosamente. 6 bairros viravam 3 antes de chegar no Meta.
3. **6 interesses bloqueados pela política Meta de 15/jan/2026** (`ea97ad4`): "Design de sobrancelhas", "Maquiagem permanente PT-BR", "Estética facial" etc. NÃO existem mais. Validados ao vivo: TODOS retornam vazio.
4. **5 fixes Meta v22+ via agente externo** (`fc2975f`): truncar strings 125/40, clamp idade 18-65, IG 'stream'→'feed', regex WhatsApp ampla, MESSAGE_PAGE→SEND_MESSAGE.

### Sistemas criados pra prevenir regressão
- **Endpoint `/api/campaigns/:id/audit`** (`6de3b51` + `fd14ddd`): valida 14 campos local↔Meta após publicar. Critical/high/medium severity.
- **5 novos testes anti-regressão** em metaRules.test.js: GENDER guard duplo, OBJECTIVE OUTCOME_*, CTA WhatsApp imutável, CTA não-vazio, CTA_TO_DESTINATION pareamentos. Total: 29 testes.
- **interestPresets.js validado ao vivo**: todos os 15 termos antigos substituídos por validados Meta /search com audience > 10M.
- **Bug visual sync** corrigido (`f71032a`): após play/pause, força sync 2.5s pra UI não ficar 90s grudada em estado obsoleto.

### Limites do Meta que NÃO conseguimos contornar (são da plataforma)
- `location_types: ['home']` → Meta força `['home','recent']` desde jun/2025. Confirmado pela doc.
- `advantage_audience: 0` → Meta v23+ força ATIVO em alguns objetivos. Não é bug nosso.
- Endpoint `/search?type=adinterest` deprecated em v22 mas ainda funciona — migrar pra `/{accountId}/targetingsearch` em sprint futura.

### Lição registrada na memória global (2026-04-28)
**Regra ouro: testes precisam validar contra FONTE AUTORITATIVA EXTERNA (doc Meta), não contra "o que o código faz hoje".** O teste antigo de GENDER validava o valor errado — passou por meses sem alertar do bug.

### Próxima publicação Cris (PACOTE PRONTO + AGORA VALIDADO)
- Mesmo pacote de antes (nano sobrancelha, 6 bairros 3km, 28-45, feminino, 12x R$58, vídeo, fim 05/05)
- **MAS:** trocar interesses pelo preset novo: Eyebrow + Microblading + Permanent makeup (3 validados, alta audiência)
- Hard refresh (Ctrl+Shift+R) antes de criar pra pegar bundle novo
- Rodar `curl /api/campaigns/{id}/audit` após publicar pra confirmar 14 campos OK

### Pendência pós-publicação (Rafa pediu 2026-04-28 noite)
- **Remover input "adicionar interesse manual"** do CreateAd.jsx (Step 2 ou onde estiver) — agora que existe preset validado, digitar a mão = risco de termo fantasma. Manter apenas o seletor de preset por serviço (interestPresets.js).
- **Não fazer agora** — Rafa está no fluxo de publicação. Executar SOMENTE depois que a próxima campanha estiver no ar.

---


> **Atualizado:** 2026-04-28 14:50 GMT-3 (sessão diagnóstico campanha real + 2 fixes painel)
>
> **Pra Claude:** este arquivo é o **estado crítico atual** do sistema. Lê-lo no início de cada sessão evita afirmações erradas. Atualizar no fim de cada sessão se algo mudar.
>
> **Pra Rafa:** raio-X rápido do projeto.

---

## Sessão 2026-04-28 noite — 1ª tentativa de publicação + bug bairros

### Campanha 433 (deletada pelo Rafa)
- **Publicada:** 2026-04-28 20:32 GMT-3, ATIVA no Meta (ID `120245720496670627`)
- **Headline final escolhida:** `Nanopigmentação em Joinville!`
- **Texto final:** `Fio a fio, feito à mão pela Cris. De R$ 699,00 por R$ 497 ou 12x de R$ 58. Só esta semana! Me chama no WhatsApp.` (variação do Rafa misturando Opção 3 + desconto cruzado)
- **Vídeo:** "Nano 12x 58.mp4"
- **Orçamento:** R$ 15/dia, fim 05/05/2026 23:59
- **Bairros configurados:** 6 (Anita, Atiradores, Saguaçu, América, Glória, Boa Vista)
- **Bairros que chegaram no Meta:** apenas 3 (Anita, Saguaçu, Glória) — bug do split de anéis
- **Status final no Meta:** Campaign+AdSet ACTIVE, Ad PENDING_REVIEW
- **Decisão Rafa:** DELETOU pra refazer (provavelmente quer corrigir bairros + ajustar copy/vídeo)

### Bug confirmado: split de anéis perde bairros
- Painel tinha 5 bairros com `radius:1` e Boa Vista com `radius:2`
- Sistema enviou pro Meta só os 3 com radius coincidente (3km cada)
- 3 bairros desapareceram silenciosamente
- **Backlog técnico:** investigar `metaNormalize.js` / `publishCampaign` — quando `ringsMode:"1"` e bairros têm raios diferentes, alguns são descartados sem aviso ao usuário

---

## Sessão 2026-04-28 — Diagnóstico campanha real + 2 fixes painel

### Estado real da campanha 424 ("Últimas vagas para nanopigmentação!")
- **Status:** ACTIVE (rodando 2,5 dias contínuos sem pausa)
- **Spent:** R$ 40,04 (matemática Rafa: 15/dia × 2,5d = R$ 37,5 — bate)
- **Clicks:** 235 / **Impressions:** 7.252 / **Reach:** 5.275
- **CTR:** 3,24% (excelente, 3x média estética)
- **CPC:** R$ 0,17 (excelente)
- **Conversions internas (mapeadas de clicks):** 235
- **Mensagens reais no WhatsApp da Cris:** 0 (Cris confirmou)

### Decisão estratégica registrada
- Diagnóstico: anúncio chama atenção MUITO bem (CTR alto), mas oferta/criativo NÃO fecha
- 235 cliques sem 1 mensagem em 2,5 dias = sinal estatístico suficiente
- Não vale esperar mais 4 dias do mesmo criativo
- Hipóteses Rafa (legenda no meio + valor visível + condição/urgência) = corretas
- **Próximo anúncio:** 4-5 bairros classe média-alta (Anita Garibaldi, Atiradores, Saguaçu, Boa Vista) + faixa 28-42 + interesses específicos + novo vídeo (legenda+valor+urgência) + aceitar CPC R$ 0,40-0,80 pra qualificar

### 2 fixes aplicados (commits e120260 + a50ed45)
- **Bug B (e120260):** `rowToAd` em routes/campaigns.js — `results` e `costPerResult` ficavam zerados mesmo com sync mapeando conversions. Agora deriva: results=conversions, costPerResult=spent/conversions.
- **Bug A (a50ed45):** sync.js — `payload.meta.campaign.status` e `payload.meta.ad_set.status` ficavam grudados em PAUSED do snapshot do publish. Agora atualiza com c.raw.status fresco do Meta a cada sync.

### Erro de método registrado (memória global atualizada)
- Afirmei "campanha PAUSED" olhando `m.campaign.status` (cache antigo) sem conferir `c.status` raiz (estado vivo)
- Rafa percebeu pela matemática (gastou R$ 40 = 2,5d × R$15 = consistente com rodando)
- Nova memória: `feedback_verify_primary_source_not_cache.md` — fonte primária sempre, nunca cache

### Pendências (após Rafa pausar)
- Confirmar com Cris quais bairros mais aparecem na agenda dela (refinar lista de bairros)
- Backlog: feature "duplicar campanha pausada" no wizard (não existe rota /duplicate hoje)
- Backlog: campos `meta.ad_set.status` derivam de campaign — ideal seria buscar status real do adset separadamente

### Backlog priorizado (decidido por Rafa em 2026-04-28)
- **Feature: "Adicionar novo anúncio em campanha existente"** — permitir trocar criativo (vídeo/texto) mantendo campanha+conjunto+aprendizado. Útil pra: (1) trocar vídeo cansado após 30+ dias, (2) substituir criativo sem zerar fase de aprendizado.
- **Feature: A/B test de criativos no mesmo conjunto** — publicar 2-3 anúncios competindo pelo mesmo público; Meta entrega mais pro que converte mais. Útil pra escolher copy/visual vencedor sem palpite.
- **Status:** Rafa quer fazer DEPOIS. Não nesta sessão. Implementar quando ele tiver uma campanha já validada pra cima da qual rodar A/B.

### Próxima campanha (Rafa vai criar 2026-04-28 à noite) — PACOTE FECHADO
- **Serviço:** Nanopigmentação de sobrancelhas
- **Valor:** R$ 696 (12x de R$ 58) — corrigido em 2026-04-28 19:30 (era R$ 56, valor real é R$ 58)
- **Copy (V3 — 3 opções refeitas com base no print do vídeo, 2026-04-28 19:30):**
  - **Opção 1 (recomendada — escassez direta):**
    - Título: `Nanopigmentação · 3 vagas esta semana`
    - Texto: `Sobrancelha pronta sem maquiagem. 12x R$ 58. Só 3 vagas pra esta semana — me chama no WhatsApp.`
  - **Opção 2 (rotina aspiracional):**
    - Título: `Acorde pronta · Nanopigmentação`
    - Texto: `Sobrancelha desenhada todo dia, sem retoque. 12x R$ 58. Vagas limitadas esta semana — chama no WhatsApp.`
  - **Opção 3 (artesanal + autoridade):**
    - Título: `Nanopigmentação em Joinville · 3 vagas`
    - Texto: `Fio a fio, feito à mão pela Cris. 12x R$ 58. Só 3 vagas esta semana — me chama no WhatsApp.`
  - **Decisão Rafa:** _pendente — vai escolher antes de subir_
  - **Decisão sobre vídeo:** Rafa vai REFAZER o vídeo (em vez de mostrar valor com desconto cruzado). Valor 12x R$ 58 vai pra copy do anúncio, não pro overlay do vídeo.
- **Targeting fechado:**
  - **Bairros (6, 3km de raio cada):** Anita Garibaldi, Atiradores, Saguaçu, Boa Vista, América, Glória
  - **Faixa etária:** 28-45
  - **Gênero:** feminino
  - **Interesses:** Design de sobrancelhas, Maquiagem permanente, Sobrancelhas micropigmentadas, Estética avançada, Procedimentos estéticos
  - **CPC esperado:** R$ 0,40-0,80 (mais qualificado que os R$ 0,17 anteriores)
- **Destino:** wa.me/5547997071161 (mesmo número, fallback wa.me como antes)
- **Vídeo:** Rafa vai REFAZER o vídeo. Valor 12x R$ 58 SAI do overlay do vídeo (vai pra copy do anúncio). Manter gancho inicial + CTA "chama no WhatsApp" no final. Capa custom só se 1º frame for fraco.
- **Antes de subir nova:** pausar campanha 424 atual no AdManager.

---

## Integrações Meta (`curl https://criscosta.vercel.app/api/health/full`)

| Item | Estado | Detalhe |
|---|---|---|
| Banco Neon | ✅ ok | Conectado via `@neondatabase/serverless` HTTP (não-WS) |
| Meta Ads | ✅ ok | Conta `act_1330468201431069`, token válido por ~56 dias |
| Page Facebook | ✅ ok | `108033148885275` (criscosta_sobrancelhas) |
| Instagram Business | ✅ ok | `17841456891955614` |
| IA Groq | ✅ ok | Configurado |
| Webhook Meta | ✅ ok | Ativo (HMAC-SHA256 validado) |
| Health endpoint live | ✅ ok | Bate `/me` no Meta a cada hit |

## Saldo Meta

- **Spend cap:** R$ 2.526,56
- **Amount spent:** R$ 2.425,54
- **Disponível:** R$ 101,02 (Rafa adicionou crédito 2026-04-25)

## Última publicação Meta

✅ **1ª campanha real ATIVA em 2026-04-26 madrugada.** Rafa ativou no Ads Manager.

**Métricas das primeiras ~10h** (snapshot 09:56 GMT-3):
- Cliques: 40
- Gasto: R$ 6,02
- CPC implícito: R$ 0,15 — **excelente** pra Joinville/estética
- Status: em fase de aprendizado Meta (~7 dias até estabilizar)
- Próxima revisão: 02/05 (sábado, 7 dias) e 04/05 (segunda, routine semanal)

## Página /relatorios (sessão 2026-04-26 segunda parte)

Nova seção na sidebar abaixo de Anúncios. 3 tipos amigáveis pra leigos:

- **📊 Sua campanha** — performance, gasto, cliques, mensagens
- **🩺 Sistema** — saúde da plataforma, integrações Meta
- **⏰ Lembretes** — avisos pontuais programados

**Endpoints:**
- `GET /api/reports` (lista, filtros: kind, severity, campaign_id)
- `POST /api/reports` (ingestão, header `X-Report-Secret` opcional)
- `POST /api/reports/generate/campaign` (snapshot grátis, sem IA)
- `POST /api/reports/generate/system` (snapshot grátis, sem IA)
- `PATCH /api/reports/:id/read` + `DELETE /api/reports/:id`

**Tabela `reports`** criada lazy (CREATE IF NOT EXISTS na 1ª chamada). Zero impacto em sqlite.js / schema.sql do core.

**Routine Claude semanal** — `trig_01A45kPNkKtbhWpXTFdPrVJL`
- Cron: `0 11 * * 1` = toda segunda 8h GMT-3
- Modelo: claude-sonnet-4-6 (~R$ 0,40-2/mês)
- Repo: rafaelrac25-crypto/traffic-manager
- Painel: https://claude.ai/code/routines/trig_01A45kPNkKtbhWpXTFdPrVJL
- Próximo disparo: 2026-04-27 (amanhã)
- Posta automaticamente em `/api/reports` com `kind=campaign source=routine-weekly`

## DECISÃO ARQUITETURAL importante (2026-04-26): Consultor IA respeita aprendizado Meta

`getPerformanceIssues` em `frontend/src/pages/Campaigns.jsx:454` **não tinha** noção de idade da campanha nem proporcionalidade. Sugeria "Aumente o orçamento ou melhore a imagem" pra qualquer anúncio com <500 cliques — incluindo campanhas com 9h de vida.

**Pior anti-padrão:** aumentar orçamento >20% **reseta** a fase de aprendizado do Meta. Sistema sugeria exatamente o que prejudicava o algoritmo.

**Nova lógica (commit `5976046`):**
- Bloqueia sugestões de ajuste nos primeiros 7 dias (mostra dias restantes)
- Sinais críticos sempre alertam (zero cliques após 24h, conversão baixa com volume relevante)
- Pós-aprendizado: avalia CPC proporcional (R$2 threshold) em vez de cliques absolutos

Sistema agora concorda com gestor de tráfego humano que recomendou "não mexer 6-7 dias".

## DECISÃO ARQUITETURAL importante (2026-04-26): Fallback wa.me/

Page da Cris **NÃO tem WhatsApp linkado oficialmente** no campo `whatsapp_number` da Page (apesar do número estar no Portfólio Empresarial). Click-to-WhatsApp formal (`destination_type: WHATSAPP`) **falha com erro 100/2446885**.

**Solução implementada:** quando objetivo é "messages" E destURL contém `wa.me/`, sistema **automaticamente** monta campanha como TRÁFEGO:
- objective: `OUTCOME_TRAFFIC` (em vez de `OUTCOME_ENGAGEMENT`)
- optimization_goal: `LINK_CLICKS` (em vez de `CONVERSATIONS`)
- destination_type: undefined
- CTA: `LEARN_MORE` com `value.link = wa.me/...`

Comportamento pro usuário final = idêntico ao Click-to-WhatsApp formal. Mesmo método que outras agências usam. Implementado em `frontend/src/utils/metaNormalize.js` (commit `d789f68`).

## Sessão 2026-04-25/26 — 21 commits significativos

### Driver DB
- `0103ff6` — pg → @neondatabase/serverless (Pool/WebSocket)
- `1a19135` — Pool/WS → neon() HTTP (fim das conexões zumbi)

### Pipeline de vídeo (RESOLVIDO em camadas)
- `8f3fea9` — upscale automático proporcional (videoCompressor `computeTargetDims`)
- `0263494` — fallback final dá mensagem clara em vez de devolver original sem upscale
- `0e97ad3` — pula MediaRecorder quando precisa upscale (não amplia)
- `738d087` — botões CloudConvert/Convertio/FreeConvert na mensagem de erro HEVC
- `199cefc` — detector real de codec (avc1 vs hvc1) + reset input file
- `bd8af28` — canvas upscale fallback quando FFmpeg.wasm trava (memória do navegador)

### Meta API erros (todos fixados)
- `8ec096a` — sanitizeCtaValue por tipo (erro 105/1815630)
- `21dc855` — bid_strategy explícito na campanha CBO (erro 100/1815857)
- `581fa08` / `a4caf2f` — endpoint /api/platforms/meta/diagnose-page
- `d789f68` — fallback wa.me/ automático (erro 100/2446885)

### UX bloqueios
- `aef799e` — handleCancel com confirm + saveDraft auto + traduz "Failed to fetch"
- `0be5040` — hotfix do crash `handleCancel is not defined` (escopo errado)
- `eeaeb24` — remove painel "Resumo do investimento" do Step4
- `b6d510b` — remove regra CSS `nav > div:active scale(.98)` que fazia 2 botões da sidebar animarem juntos

### Sidebar polimentos
- `ce46fdd` — gap entre Dashboard e Criar Anúncio (6px → 14px)
- `6d7248a` — transition só em transform/shadow (não em background/border)

## Bugs conhecidos abertos

**Nenhum bloqueante.** Itens 🟡 da auditoria:
- `'Mande uma mensagem'` e `'Enviar mensagem'` ambos mapeados pra MESSAGE_PAGE (redundância benigna — mantido, ambos válidos)
- `/mapa-de-calor` redireciona pra `/` (HeatMap removido conscientemente — Meta não diferencia bairros do mesmo anel)
- Flash visual de ~2s ao adicionar ad antes da resposta do servidor (otimismo aceitável)

## Checkup geral 2026-04-27 (tarde) — 4 fixes P0/P1 aplicados

Auditoria via 2 agentes paralelos (backend+Meta / frontend+ghost) +
checks ao vivo. Sistema em PROD continuou green durante o trabalho.

**Fixes aplicados (3 commits):**

- `12ab4b1` — fix(sync): mapear `clicks → conversions` em
  messages/wa.me/ + dedup insights (UNIQUE INDEX parcial em PG e
  SQLite). Resolve "card Custo por resultado mostrava — apesar de 176
  mensagens recebidas".
- `e0c5572` — fix(webhook): IIFE async fire-and-forget agora captura
  exceções pelo Sentry com tags. Painel não fica desatualizado em
  silêncio se sync falhar.
- `4d85aee` — feat(meta): retry exponencial com `MAX_RETRIES=3`,
  backoff por código (`META_ERROR_MAP.backoffMs`), e
  `POST_RETRY_WHITELIST = {4,17,32,613}` pra evitar duplicar criação de
  recurso. Rate limit consumido a cada tentativa.

**Findings P0/P1 ainda abertos (backlog priorizado):**

- (P1) Race condition em `metaToken.js` refresh — lock em `Map()` local
  não protege multi-instância serverless. Baixa probabilidade. Fix:
  lock distribuído via DB row.
- (P1) `metaRateLimit.js` em memória — multi-instância pode duplicar
  quota. Fix: bucket persistido em DB ou Vercel KV (mas KV foi
  descontinuado — usar Postgres com SELECT FOR UPDATE).
- (P1) Sync não popula `reach` nem `frequency` (sync.js fields incompletos).
  Métrica Frequência adicionada hoje no Dashboard só aparece quando
  sync puxar isso. Fix: adicionar `reach,frequency` à lista de fields
  do GET insights.
- (P1) `health.js` faz live ping no Meta a cada hit — smoke test 15min
  queima ~96 pings/dia da quota 180/h. Fix: cache 60s no resultado do
  ping live.
- (P1) FFmpeg.wasm nunca dá `.dispose()` — memory leak no upload de
  vídeo. Fix: chamar `ffm.terminate()` em cleanup do `compressVideo`.
- (P1) `CreateAd.jsx` preflight sem AbortController — setState em
  componente desmontado. Fix: `AbortSignal` no fetch.
- (P1) Bump v22 pode ter quebrado `insights.date_preset` em endpoint
  específico (hipótese, não verificado). Fix: testar GET insights ao
  vivo após próxima campanha.

**Findings P2/P3 (tech debt, não urgente):**

- Ghost code: 3 funções no `Dashboard.jsx` declaradas mas não
  renderizadas (`DualLineChart`, `MiniCalendar`, `RingPerformanceTeaser`)
  — sobra do refactor. Bundle gordo.
- `setTimeout` sem cleanup em `AIAssistant.jsx`.
- Hardcoded colors em alguns componentes (não usam `var(--c-...)`).
- `alt` text genérico em previews do Wizard.
- `console.info` do videoCompressor em prod (intencional pra
  observabilidade — manter).
- Sentry sanitize cobre breadcrumb mas não `request.body` em error
  context.

## Backlog (decidido em 2026-04-27)

- **Alerta email saldo < R$ 20:** adiado. Caminho recomendado quando voltar:
  hook no `/api/health/full` (já é batido a cada 15min pelo smoke test do
  GitHub Actions) + Resend pra envio + flag `last_balance_alert_at` no DB
  pra não duplicar. Janela útil entre R$ 20 e R$ 0 ≈ 32h com budget diário
  R$ 15. Implementação ~30min em 1 commit.

## Decisão (2026-04-27): redesign visual fica pra DEPOIS

Skill oficial Anthropic `frontend-design` confirmada como confiável e
disponível pra instalação (`/plugin install anthropics/claude-code`).
Rafa decidiu **adiar** o redesign visual pra validar o aplicativo
primeiro com a 1ª campanha real. Sequência prevista: validar → coletar
dados (~2-3 semanas pós fase de aprendizado) → aí sim aplicar
`frontend-design` em branch isolada.

## Sprint UX Dashboard 2026-04-27 (tarde) — refactor pra leigo

Commit `8625371`. Decidido com Rafa via Council (decisões expostas).

**Tirado** (Rafa pediu — eu tinha enviesado pra "só adicionar"):
- MiniCalendar do Dashboard (já tem `/calendario`)
- Histórico de datas comerciais (sino + página de calendário cobrem)
- Gráfico "Resultados ao longo do tempo" com placeholder permanente
- Empty state visual do RingPerformanceCard (oculta seção inteira até ter dado real)

**Adicionado** (poucos, alto valor):
- **LearningPhaseCard adaptativo** — aparece quando há campanha active <7d, some sozinho quando estabiliza. Avisa pra não mexer em orçamento (regra Meta: alterações >20% resetam aprendizado)
- **CTR e Frequência** no CampaignMetricsBlock (condicional, só mostra quando dado existe). Frequência fica laranja >2,5 (público saturando)
- **Saldo "≈ X dias de veiculação"** no BalanceCard, calculado via soma dos daily budgets das campanhas active
- **Tooltips `?`** em cada métrica explicando em PT-BR pra leigo

**Ajustado**:
- Saudação neutra: "Boa tarde 👋" (sem nome — pode ser Rafa, Cris, ou outra pessoa)
- "seus anúncios" → "seu anúncio" quando 1 só

**Council** (instalado em commit `70d90c0`): 5 agentes especializados em
gestor de tráfego pago Cris/Joinville. Veto crítico: Validator e Risk
Reviewer. Documentado em `COUNCIL.md`.

**videoCompressor logging** (commit `d262479`): log estruturado quando
upload de vídeo termina — quando Rafa for fazer próximo upload, console
mostra qual pass venceu (720p/480p/360p).

## Sprint de limpeza 2026-04-27 (manhã)

5 commits aplicados em prod, sem mexer na campanha rodando:

- `065e873` — fix(reports): checar `FB_APP_SECRET` em vez de `META_APP_SECRET` (corrige falso positivo do snapshot de sistema)
- `1f8d775` — refactor(meta): centralizar `API_VERSION` em `services/metaApiVersion.js` + bump v20→v22 (com env override `META_API_VERSION`)
- `df10ca7` — chore(cta): remover CTAs dead code (`Reservar agora`, `Ver cardápio` — turismo/restaurante, fora do nicho)
- `fadbefd` — feat(routes): `/desempenho` redireciona pra `/relatorios` em vez de `/`
- `458e024` — chore(build): rebuild frontend dist

**Validado em prod (2026-04-27 11:20 GMT-3):** `POST /api/reports/generate/system` agora retorna "✅ Webhook Meta — Secret configurado" (era falso positivo). 23 testes Vitest passando.

## Decisões registradas (memória do Claude)

- ✅ **Manter horário comercial** (`adset_schedule`) — Cris atende horário comercial, leads frios à noite
- ❌ **NÃO adicionar campo "Descrição"** (30 chars) — placements de IG/mobile não exibem
- ✅ **Manter contadores de caracteres** atuais (texto principal 125 / título 40)
- ✅ **Fallback wa.me/ é o caminho preferencial** — funciona sempre, mesmo método de agências tradicionais
- ⏳ **Quando Cris linkar WhatsApp na Page formalmente**, sistema continua usando wa.me/ enquanto destURL for esse formato (não force migrate)

## Arquitetura — referência rápida

- **Backend:** Node + Express + SQLite (dev) / Postgres Neon (prod via HTTP driver)
- **Frontend:** React + Vite + Tailwind, Vite build → `frontend/dist/` (commitado)
- **Deploy:** Vercel (criscosta.vercel.app), repo `rafaelrac25-crypto/traffic-manager`
- **Auth:** removida (uso interno)
- **OAuth Meta:** completo, token criptografado AES-256-GCM, refresh automático <15 dias com lock
- **Vercel CLI:** instalada e linkada (`rafaelrac25-7792s-projects/traffic-manager`, projectId `prj_FGKb5yXAPIAFtB0CAw3bpob3y96e`)

## Pipeline de mídia (vídeo) — fluxo final

1. **Detecção de codec** lendo header (avc1 vs hvc1)
2. **HEVC** → mensagem amigável + 3 botões pra conversão online (CloudConvert / Convertio / FreeConvert)
3. **H.264** → tenta FFmpeg.wasm com upscale proporcional (computeTargetDims, 600px mínimo)
4. **FFmpeg falha** (memória do navegador, codec exótico) → tenta canvas + MediaRecorder com upscale
5. **Tudo falha** → mensagem clara com botões pra conversor online
6. **Reset do input** após cada tentativa (permite re-upload do mesmo arquivo)

## Documentos importantes

- `CLAUDE.md` — instruções pro Claude (regras Cris, regra Joinville)
- `~/CLAUDE.md` (global) — gatilho "retomar projeto" inclui `curl /api/health/full`
- `PROJECT_MAP.md` — mapa completo do código (3000+ linhas)
- `STATE_MACHINE.md` — estados Meta e reações do sistema
- `PROTECTION_SETUP.md` — setup Sentry + Vercel email alerts
- `.planning/audit/SUMMARY.md` — auditoria v1 completa

## Skills/serviços externos

- **Sentry** — ✅ ATIVO front + back. DSN setados. Tokens sanitizados.
- **GitHub Actions** — smoke (15min) + synthetic (diário 09h GMT-3). Issues automáticas em falha.
- **Vercel CLI** — ✅ instalada (v52), linkada
- **Vercel email alerts** — Rafa precisa ativar em https://vercel.com/account/notifications

## Proteções ativas

✅ Health endpoint valida token Meta LIVE
✅ 23 tests Vitest (`npm test`, ~1s)
✅ Smoke test GitHub Actions
✅ Synthetic test GitHub Actions
✅ Sentry frontend + backend
✅ Driver Neon HTTP (sem conexões persistentes a expirar)
✅ Pipeline de vídeo com 3 fallbacks (FFmpeg → canvas → conversor online)
✅ Fallback wa.me/ automático pra Click-to-WhatsApp
⏳ Vercel email alerts (Rafa precisa ativar manualmente)

## Próximo passo planejado

1. **Ativar a 1ª campanha publicada** (manualmente no painel ou Ads Manager) pra começar a rodar
2. **Ativar Vercel email alerts** (1 min, manual)
3. **Após 7-14 dias rodando**: revisar métricas reais e decidir se vale adicionar features de targeting (lookalike, custom audiences, status de relacionamento, eventos da vida)
4. **Backlog 🟡** (limpeza CTAs duplicados, upgrade v20→v22 da Graph API, redirects legados)

---

## Sessão 2026-05-01 noite — VISÃO META v2 (HIERARQUIA 3 NÍVEIS) — 1 commit

### Implementação completa: campanha → conjunto → anúncio

**Commit:** `5022295` feat(v2): Visão Meta — hierarquia 3 níveis

**Backend (somente adiciona, nada removido):**
- `metaWrite.duplicateAdSet` — POST /{adset_id}/copies (deep_copy=true, PAUSED, rename suffix " — v2") + overrides via updateAdSetMeta
- `metaWrite.createAdInExistingAdSet` — reusa creative do adset OU clona com overrides
- `GET /api/campaigns/:id/hierarchy` — campaign + adsets + ads aninhados ao vivo do Meta
- `POST /api/campaigns/:id/duplicate-adset` — duplica adset c/ overrides (targeting, budget, age, name)
- `POST /api/campaigns/:id/adsets/:adsetId/ads` — cria ad novo no adset (PAUSED), reusa creative do 1º ad ou clona com overrides
- `PATCH /api/campaigns/:id/budget-safe` — clamp ±20%, retorna 400 se passar com max_safe_increase/decrease detalhado

**Frontend:**
- `pages/CampaignsHierarchy.jsx` — master-detail (lista campanhas à esquerda, hierarquia à direita), 3 modais (BudgetEdit, DuplicateAdSet, NewAdInAdSet), avisos verde ✓ (seguro) / vermelho ⚠ (reseta aprendizado), breadcrumb dinâmico
- `Sidebar.jsx` — item "Visão Meta" com badge NOVO
- `App.jsx` — rota `/campanhas-v2`

**Validação ao vivo (criscosta.vercel.app/campanhas-v2):**
- ✅ HTTP 200 na rota nova
- ✅ GET /hierarchy/437 retornou campaign+adset+ads com IDs Meta corretos
- ✅ PATCH /budget-safe bloqueio >20% funcionando (R$20→R$100 = 400%, retornou erro detalhado)
- ✅ PATCH /budget-safe mudança 5% (R$20→R$21) PASSOU pro Meta — INADVERTIDAMENTE alterou a 437 ativa no teste, **REVERTIDO IMEDIATAMENTE pra R$20** (diff de 5% não reseta aprendizado mas precisa avisar Rafa)
- ⚠ duplicate-adset e adsets/:id/ads validados só por body validation (não rodados ao vivo pra não sujar o Meta sem autorização)

**Comportamento de aprendizado (memória externa validada):**
- Mudança ≤20% de orçamento: NÃO reseta (sistema permite)
- Renomear: NÃO reseta
- Duplicar adset: aprendizado novo do zero (Meta trata como entidade nova) — UI avisa
- Criar ad novo no adset: RESETA aprendizado do adset — UI avisa em vermelho
- Mudar criativo/copy/imagem/CTA/URL de ad existente: divergência entre fontes (não implementado edição direta — sistema empurra duplicação como caminho seguro)

**Endpoints e UI antigas intocadas.** 436 e 437 continuam com mesmos botões em /anuncios.

### Pendência
- Rafa testar /campanhas-v2 no painel ao vivo
- Validar fluxo completo de duplicar conjunto + criar ad novo no Meta (precisa autorização do Rafa pra rodar live)

---

## Sessão 2026-05-01 noite — STATUS INDIVIDUAL + ADVANTAGE+ + A/B TEST (1 commit)

**Commit:** `c220ebe` feat(v2): play/pause individual + Advantage+ + Teste A/B

### Implementação completa em 3 frentes

**1. Status individual de conjunto e anúncio**
- `metaWrite.updateAdSetStatus(creds, adsetId, status)`
- `metaWrite.updateAdStatus(creds, adId, status)`
- `PATCH /api/campaigns/adsets/:adsetId/status` (avisa se ancestral PAUSED)
- `PATCH /api/campaigns/ads/:adId/status` (avisa CAMPAIGN/ADSET PAUSED)
- UI: botão verde ▶ / cinza ⏸ em cada AdSetCard e AdCard
- Confirmação antes de PAUSAR (window.confirm). Ativar é direto.
- Optimistic update + rollback se Meta recusar (busyIds previne double-click)

**2. Toggle Advantage+ Público**
- `metaWrite.setAdvantageAudience(creds, adsetId, enabled)` — merge correto do targeting
- `PATCH /api/campaigns/:id/adsets/:adsetId/advantage-audience` body {enabled}
- UI: switch dourado no card do conjunto. Default OFF (regra Joinville mantida).
- Confirmação destacada ao LIGAR: "Pode entregar fora dos bairros + reseta aprendizado"
- Quando OFF, força `targeting_relaxation_types: { lookalike: 0, custom_audience: 0 }`

**3. Teste A/B oficial Meta (Split Test)**
- `metaWrite.createABTest` via POST /act_X/ad_studies (type=SPLIT_TEST)
- Cells com `treatment_percentage` somando 100 e adsets array
- Validação: duração 4-30 dias (Meta exige mínimo 4)
- Cria cell B duplicando o adset base via duplicateAdSet (+ overrides conforme variável)
- `metaWrite.getABTestResults`, `listABTests`, `stopABTest`
- Endpoints:
  - `POST /api/campaigns/:id/ab-test` — pré-condição: campanha ACTIVE
  - `GET /api/campaigns/:id/ab-tests` — lista com status ao vivo do Meta
  - `GET /api/campaigns/ab-tests/:studyId` — detalhes
  - `POST /api/campaigns/ab-tests/:studyId/stop` — encerra (POST end_time=agora)
- UI: botão "🧪 Criar teste A/B" no header da campanha
- Modal CreateABTestModal:
  - Variável: público / posicionamento / criativo
  - Conjunto base (dropdown adsets da campanha)
  - Override conforme variável (idade / placement / creative-later)
  - Slider duração 4-30 dias
  - Slider divisão 10-90% (default 50/50)
  - Bloqueia se campanha não está ACTIVE
- Card ABTestCard com progress bar dia X de Y + botão "Encerrar antes"

### UX leigo (cuidados)
- Confirmações em pt-BR explicando consequência antes de pausar/ligar Advantage+
- Tooltip em todos os botões
- Toast verde sucesso, vermelho erro (6s)
- busy state em todos os botões durante request
- Aviso quando ativar ad mas campanha/adset estão pausados ("não vai entregar até...")

### Validação backend (sintaxe + endpoint contracts)
- `node --check` em metaWrite.js + routes/campaigns.js → OK
- Build frontend OK (1.15s)
- Endpoints novos respondem 400 com erro detalhado quando body incompleto
- 437/436 NÃO foram tocadas — apenas leitura

### Riscos antecipados e tratados
- **Cascade play campanha** vai ativar adsets/ads novos junto: documentado, default PAUSED minimiza
- **A/B test em campanha pausada**: bloqueado no backend (retorna 400)
- **Mudança targeting reseta aprendizado**: Advantage+ avisa explicitamente
- **Double-click**: busyIds previne
- **Rollback**: optimistic update reverte se Meta recusar

### Pendência (manual com autorização)
- Rafa testar play/pause em adset/ad pelo painel
- Rafa criar 1 teste A/B real em campanha futura (não recomendado em 437/436 ativas)
- Backlog: editor direto de criativo (decisão atual: duplicar conjunto é o caminho)

---

## Sessão 2026-05-03 — Refino IA (Groq)

**Commit:** `8594f59` feat(ai): consultor sênior + estrutura título/descritivo/CTA + sem emoji/#/1ª pessoa

### Mudanças no SYSTEM_PROMPT (backend/src/routes/ai.js)
- **Posicionamento:** "assistente" → "consultor sênior de tráfego pago e copy"
- **Estrutura obrigatória de toda resposta:**
  1. TÍTULO (≤60 chars, só primeira maiúscula, sem ponto)
  2. DESCRITIVO (2-4 linhas, específico Cris/Joinville)
  3. CTA (linha de ação concreta com WhatsApp/agenda)
- **Proibições rígidas (Rafa pediu):**
  - SEM emojis (só se pedir "com emoji")
  - SEM caractere `#` (zero markdown header)
  - SEM hashtags por padrão
  - SEMPRE segunda pessoa "você/teu" — NUNCA "nós/eu/a gente/vamos/nosso"
  - Bullets só em listas ≥3 itens
- **Processo de raciocínio interno** (4 passos antes de responder, não exposto)
- **Lista "evite genérico"** com substituições concretas (R$/bairro/prazo/serviço)
- **Temperature** 0.7 → 0.5 (menos genérico)

### Não tocado
- Modelos (llama-3.3-70b texto · llama-4-scout vision) intactos
- Frontend AIAssistant.jsx intacto (só renderiza resposta)
- Lista de SERVIÇOS OFICIAIS preservada
- Endpoints intactos

### Próximo
- Rafa testar chat IA in-app pra validar tom novo
- Se algum item escapar (emoji/#/1ª pessoa), reforçar regra ou baixar temperature mais

---

## Sessão 2026-05-03 — Padrão visual: ícones stroke + bordas finas + pop-ups opacos

**Commit:** `f3be313` feat(ui): icones stroke + tokens semanticos + bordas finas + popups opacos

### Decisões durables (regras pra todo novo componente)
1. **Ícones SVG = sempre STROKE.** Padrão canônico:
   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">`
2. **Cor padrão de ícone = `currentColor`** (herda contexto = rosa do --c-accent)
3. **Cores semânticas em CSS vars** (use SEMPRE estas, não hex hardcoded):
   - `var(--c-success)` verde — ok/ativo/conectado/check
   - `var(--c-warning)` amarelo — atenção/pendente/loading/clock
   - `var(--c-info)` azul — informativo/dica/help
   - `var(--c-attention)` laranja — alerta/destaque/urgente
4. **Borda lateral de alerta** (border-left) **= 2px** (não 3, não 4). Aplica em TODO card de alerta no sistema.
5. **Pop-ups/modais** = `className="ccb-card ccb-modal"`.
   `.ccb-modal` força bg `var(--c-modal-bg)` (.96 light · .94 dark) + blur(28px) + saturate(140%) pra contraste de leitura.

### Aplicações nesta sessão
- **Ícones convertidos:** Campaigns (Pause/Play/Dots) + SystemStatus (StatusIcon)
- **Tokens novos** no `:root`, `[data-theme="light"]` e `[data-theme="dark"]`
- **6 bordas afinadas:** Dashboard 1693, Audiences 441, Rejected 33, CreateAd 1929/3848/3884
- **8 modais opacificados:** Calendar (2x), Campaigns (2x), CampaignsHierarchy (1x), CreateAd (3x), References (1x)

### Build
- 838 kB (índice), zero impacto vs commit anterior.

### Próximo
- Rafa validar in-app pop-up de anúncio em /anuncios e bordas em /
- Se algum modal novo for criado, lembrar `className="ccb-card ccb-modal"`

---

## Sessão 2026-05-03 — Rascunho no wizard + Icon stroke (1ª leva)

### Commits
- `ce5152b` feat(wizard): salvar como rascunho (alternativa a publicar)
- `2951379` feat(ui): emojis decorativos -> Icon stroke nas 4 telas principais

### Rascunho no wizard
- Backend POST /api/campaigns aceita `publish_mode='draft'` (skip Meta + status='draft')
- Frontend handlePublish(asDraft) bypassa validacao/upload/Meta quando true
- 2 botoes no Step 5: "Salvar como rascunho" (cinza outline) + "Publicar campanha" (rosa)
- Lista /anuncios mostra rascunhos com badge cinza "Rascunho" + filtro
- Pra publicar depois: clicar editar -> wizard reabre -> botao Publicar normal

### Icon component (`frontend/src/components/Icon.jsx`)
- 60+ ícones SVG stroke monocromaticos no padrao Lucide-style
- API: `<Icon name="check" color="success" size={18} />`
- Cores semanticas: success (verde), warning (amarelo), info (azul), 
  attention (laranja), danger (vermelho), accent (rosa explicito)
- Default `currentColor` herda contexto (rosa via --c-accent)
- Mapeamento emoji->name documentado no rodape do arquivo

### Conversao emoji -> Icon (1ª leva)
- Dashboard.jsx: 14 convertidos
- Campaigns.jsx: 14 convertidos
- CampaignsHierarchy.jsx: 16 convertidos
- CreateAd.jsx: 30+ convertidos (PublishModal, banners, presets, controles)

**Mantidos como string (correto):** emojis em title/message de notification, 
template literals que viram payload/copy do anuncio, caracteres tipograficos 
(->, --), emoji em <option> HTML.

### Pendente (próxima leva — 15 arquivos menores)
Audiences, Calendar, CreativeLibrary, Investment, References, Rejected,
Relatorios, History, AIAssistant, RingRecommendation, Sidebar, SplashScreen,
SpyCompetitor, SystemStatus, App.jsx

### Diagnostico Page WhatsApp (Cris ainda precisa configurar)
- Page criscosta_sobrancelhas (108033148885275) — phone_listed +5547997071161 ok
- whatsapp.number_publicly_listed: NULL (Cris precisa adicionar como 
  "WhatsApp" em Sobre/Informacoes da Page do Facebook)
- can_run_click_to_whatsapp: false
- Quando virar true, trocar CTA padrao dos novos anuncios pra WHATSAPP_MESSAGE

---

## Sessão 2026-05-03 — 2a leva emojis + cores semanticas + splash 3s

**Commit:** `fa4d4ce` feat(ui): emojis 2a leva + cores semanticas + splash 3s

### Concluído
- **Emojis -> Icon (2a leva):** ~44 conversoes em 15 arquivos restantes
  (Audiences, Calendar, CreativeLibrary, Investment, References, Rejected,
   Relatorios, History, App, AIAssistant, RingRecommendation, SpyCompetitor,
   SystemStatus). Sidebar/SplashScreen ja estavam limpos.
- **Cores semanticas em Campaigns/CampaignsHierarchy:**
  - active = var(--c-success) verde
  - paused/pending/with_issues = var(--c-warning) amarelo (era laranja)
  - disapproved = var(--c-attention) laranja
- **Play/Pause em /anuncios:**
  - PlayIcon (vai dar play) = stroke verde
  - PauseIcon (ja rodando) = stroke amarelo
  - Stroke 2.2 pra contraste
- **Splash 3s** (era 4s): HOLD_MS 3400 -> 2400

### Mantidos como dado de configuracao (correto)
- FORMAT_META.emoji em References (catalogo de formatos)
- KINDS.emoji em Relatorios (tipos de relatorio)
- TYPE_META.icon em History (20+ tipos de evento)
- colors.emoji em App.jsx NotificationDropdown (vindo de contexto)
Refatorar exigiria migrar catalogos inteiros — fora do escopo da regra.

### Pendente / pos-validacao Rafa
- Aguardando confirmacao Rafa: cron sync Meta (item 6) ou
  feature recomendacao por bairro (item 7) — proximo passo
- WhatsApp Page: Cris ainda precisa adicionar como WhatsApp em Sobre
  (suporte Meta esta atendendo o Rafa nessa frente)
- Dataset Meta acabou de ser configurado pelo Rafa

---

## Sessão 2026-05-03 — Cron + Recomendacao bairro + Play/Pause + UI

**Commit:** `725caa5` feat: cron sync Meta + recomendacao por bairro + cores play/pause + UI fixes

### Cron sync Meta (item 6 fechado)
- vercel.json: `crons` 1x/dia 12h UTC = 9h BRT
- GET /api/cron/sync-meta self-call em POST /api/campaigns/sync-meta-status
- Auth opcional via env CRON_SECRET (Vercel injeta automaticamente)
- Hobby plan limita 1x/dia. Pra freq maior precisa upgrade

### Recomendacao investimento por bairro (item 7 fechado — esqueleto)
- frontend/src/data/serviceInsights.js (novo): algoritmo puro
- CreateAd Step1: select "Servico promovido" com 13 servicos da Cris
- CreateAd Step2: banner sugestao bairro (silencioso sem dados)
- Campaigns AdPreviewModal: painel Top 3 bairros + Aplicar sugestao
- AppStateContext: watcher dispara notificacao a cada 6h, throttle 24h
- backend GET /api/campaigns/analytics/insights-by-service?service=ID
- **Sem dados na 1a semana = silencioso**. Vai aprendendo conforme campanhas
  novas marcam `service` no payload e acumulam insights por bairro.

### Cores Play/Pause (regra global)
- Lista /anuncios: PlayIcon verde, PauseIcon amarelo
- /campanhas-v2 PlayPauseButton (campaign+adset+ad): icone amarelo se vai
  pausar (active), verde se vai ativar (paused), bg neutro var(--c-surface)

### UI fixes
- CampaignsHierarchy statusLabel: 'Rodando' -> 'Ativo', cores via vars
- Botoes do AdSet (Duplicar/Editar/+Anuncio/Meta/Excluir): linha so com
  flex nowrap + scroll horizontal
- Botoes Campanha (Meta/Editar orcamento/Criar A/B): mesma diagramacao

### Catalogos refatorados (emoji -> Icon)
- KINDS em Relatorios (campaign=chart-bar, system=shield, reminder=clock)
- FORMAT_META em References (reels=video, carousel=refresh, image=image)
- TYPE_META em History: NAO refatorado (catalogo de 20+ tipos com mix
  de simbolos tipograficos -- proxima leva)

### Pendente (proxima leva)
- Refatorar TYPE_META em History.jsx (20+ tipos: 📅 🗑 🚀 ✅ 💰 🔗 💳 ⚠ ❌ 🔐 🔥 📉)
- Pre-preencher locations no CreateAd quando vier de "Aplicar sugestao"
  (location.state.prefillLocations ja eh enviado, mas wizard ainda nao consome)
- Code-splitting do bundle (869kB)

---

## Sessão 2026-05-03 — Cron resolvido + CTAs + Upload modal + UI fixes

### Commits desta leva
- `517f0a9` feat(cta): adiciona Fale conosco/Agendar/Reservar para wa.me + sino cinza
- `34b1012` fix(cron): trim defensivo no CRON_SECRET
- `ed6acb8` feat(modal): upload de midia no "+ Anuncio novo" do conjunto
- `716d0d2` fix(cron): https.request nativo + endpoint /ping diagnostico
- `cc7f579` fix(vercel): remove cron config temporariamente
- `764eec2` fix(cron): self-call usa VERCEL_PROJECT_PRODUCTION_URL (alias publico)
- `7189c18` feat(cron): reativa cron sync-meta 1x/dia 9h BRT

### Cron sync Meta — 100% funcional
- `vercel.json` crons[]: `0 12 * * *` UTC = 9h BRT, dispara `/api/cron/sync-meta`
- `backend/src/routes/cron.js`:
  - `https.request` nativo (compat Node 14+, evita fetch global)
  - Trim defensivo no CRON_SECRET (tolera whitespace)
  - Self-call usa `VERCEL_PROJECT_PRODUCTION_URL` (alias publico criscosta.vercel.app)
    em vez de `VERCEL_URL` (deploy-especifico bloqueado por Deployment Protection)
- Endpoint `/api/cron/ping` (sem auth) pra diagnostico
- CRON_SECRET no Vercel = `BKzBv6G7XV1p9kN_TjuIMboXHfjgnlewgab4zhSVqo4`
- Vercel Deployment Protection com bypass para Automation configurado pelo Rafa

### CTAs novos pra wa.me
- `metaRules.js` CTA_TO_META: 'Fale conosco'->CONTACT_US, 'Agendar'/'Reservar'->BOOK_TRAVEL
- `CreateAd.jsx` Step5: pra messages+wa.me agora libera 4 CTAs
  (Saiba mais, Fale conosco, Agendar, Reservar) — antes era so Saiba mais
- `metaNormalize.js` WAME_SAFE_CTAS aceita LEARN_MORE/CONTACT_US/BOOK_TRAVEL
  sem rebaixar pra LEARN_MORE
- Recomendacao gestor: usar BOOK_TRAVEL ('Agendar') filtra curiosos
  (CTR cai 10-30%, mensagens reais sobem muito mais)

### UI fixes
- App.jsx sino: sem notificacao = var(--c-text-3) cinza (igual MoonIcon dark);
  com notificacao = var(--c-accent) rosa pulsando
- CampaignsHierarchy statusLabel: 'Rodando' -> 'Ativo' (mais natural)
- PlayPauseButton (visao Meta): bg neutro, icone amarelo se vai pausar
  (status ACTIVE), verde se vai dar play (status PAUSED). Mesma regra
  global do PlayIcon/PauseIcon em /anuncios.
- Botoes do AdSet (Duplicar/Editar/+Anuncio/Meta/Excluir) flex nowrap +
  scroll horizontal
- Botoes da Campanha (Meta/Editar orcamento/Criar A/B) idem

### Catalogos refatorados (emoji -> Icon stroke)
- KINDS em Relatorios.jsx: campaign=chart-bar, system=shield, reminder=clock
- FORMAT_META em References.jsx: reels=video, carousel=refresh, image=image

### Upload de midia no modal "+ Anuncio novo" (CampaignsHierarchy)
- Modal NewAdInAdSetModal agora aceita upload de imagem ou video
- uploadIfNeeded: video usa uploadVideoChunked + extractVideoThumbnail +
  uploadMedia pra capa; imagem >3.5MB usa uploadImageChunked
- Validacao: img <=10MB, video <=100MB
- Backend POST /:id/adsets/:adsetId/ads aceita campo media opcional
- createAdInExistingAdSet em metaWrite.js: clona creative se ha overrides
  OU nova midia; suporta 4 casos (img->img, vid->vid, img->vid, vid->img);
  cleanup de creative orfao se POST do ad falhar
- Flow sem midia (reusar creative existente): comportamento intacto

### Bug raiz dos emails de falha do Vercel — RESOLVIDO
3 problemas encadeados:
1. CRON_SECRET com whitespace -> Vercel rejeitava header -> deploy falhava
2. Build cached antigo (sem cron.js) -> /api/cron retornava HTML SPA
3. Self-call usava VERCEL_URL (deploy-especifico com Protection) -> 401

Solucao final: env var limpa + VERCEL_PROJECT_PRODUCTION_URL +
Bypass Deployment Protection no Vercel.

### Pendente (proxima leva)
- Refatorar TYPE_META em History.jsx (catalogo grande)
- Pre-preencher locations no CreateAd quando vier de "Aplicar sugestao"
  (location.state.prefillLocations ja eh enviado)
- Code-splitting do bundle (~870kB)
- Testar upload de midia no modal com Meta real (so foi testado em build local)

### Estado de todas integracoes (validado ao vivo)
- DB Neon: ok
- Meta Ads (act_1330468201431069): ok, token valido 48 dias
- Groq: ok
- Webhook Meta: ok
- Cron Vercel: ativo (proxima execucao automatica amanha 9h BRT)

---

## Game Boy Agency — hotfix hook PostToolUse (2026-05-04 19:25 BRT)

Bug: hook agency-emit.js chamava process.exit(0) imediatamente apos disparar
fetch, matando o processo antes do POST async resolver. Resultado: nenhum
evento real do CLI chegava ao endpoint /api/agency/event — feed mostrava
apenas eventos demo antigos de 27/Fev.

Fix em C:\Users\Rafa\.claude\hooks\agency-emit.js:
- end handler agora async; `await post(ev)` antes do exit
- post() retorna a promise do fetch (era fire-and-forget)

Validacao: POST direto retornou {"ok":true,"id":"3f00686d..."} e GET /recent
mostra evento "validacao do hook fix" persistido. Endpoint, hook, settings,
DB — todos validados ao vivo.

Warning cosmetico libuv no Windows (`Assertion failed: !(handle->flags &
UV_HANDLE_CLOSING)`) nao bloqueia entrega do evento; e bug conhecido de
fetch+abort+exit no Node Windows. Pode ser resolvido depois removendo
AbortController do post().

Nota: hook so dispara em sessoes do CLI iniciadas APOS o fix. A sessao
atual nao roda esse hook ate Rafa reiniciar o CLI.

---

## Game Boy Agency — Fase 2 deployada (2026-05-04 19:33 BRT)

Cena pixel-art DMG always-visible em criscosta.vercel.app/agencia.
Commit fe82197 (range fase 2: cb29c5f → fe82197). Deploy READY ~21s,
chunk Agency-DwmVcTIy.js = 15.4kB em prod, paleta verde DMG + labels
de agente confirmados via curl --compressed.

Arquivos novos:
- frontend/src/utils/agencyArt.js (paleta, drawScene, drawAgent, FONT_3x5)
- frontend/src/pages/AgencyScene.jsx (Canvas 320x180 escalado, rAF loop)

Edição: frontend/src/pages/Agency.jsx — importa AgencyScene e renderiza
acima do feed de texto (que vira log abaixo).

Visual: escritório retrô — janela com sol/nuvens, parede com quadro de
notas + relógio + estante + planta, chão de madeira, café, 8 mesas em
2 fileiras (4 trás compactas + 4 frente maiores, mesa central de
Claude Code com 2 monitores). 8 personagens com silhueta diferenciada
por acessório (coroa Claude, cartola Opus, lupa Explore, beanie test,
etc). Labels pixel 3x5 embaixo de cada personagem.

Animação: 4fps em 4 frames. Idle ambient = blink aleatório + braços ao
lado. Ativação por evento = 4s "aceso" com balão de fala pulsando + braços
digitando. Mapping agente é fuzzy (resolveAgent) — eventos com nomes
variados caem nos 8 slots fixos.

Pendente:
- Rafa abrir /agencia e validar visualmente (1 evento por agente já
  semeado em prod pra cena ficar visualmente populada)
- Reiniciar CLI pra hook PostToolUse alimentar a cena com eventos reais
  da próxima sessão (fix do hook foi commitado em sessão anterior)
- Fase 3 (futuro): se Rafa pedir, evoluir pra Spline 3D ou aumentar
  detalhes (chuva na janela, dia/noite por hora, sub-agentes correndo
  entre mesas)
