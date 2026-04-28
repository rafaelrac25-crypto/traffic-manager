# CRITICAL_STATE — traffic-manager

> **Atualizado:** 2026-04-28 14:50 GMT-3 (sessão diagnóstico campanha real + 2 fixes painel)
>
> **Pra Claude:** este arquivo é o **estado crítico atual** do sistema. Lê-lo no início de cada sessão evita afirmações erradas. Atualizar no fim de cada sessão se algo mudar.
>
> **Pra Rafa:** raio-X rápido do projeto.

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
- **Valor:** R$ 672 (12x de R$ 56)
- **Copy (V2 escolhida):**
  - Título: `3 vagas de nanopigmentação`
  - Texto principal: `Acordar todo dia pronta. Nanopigmentação em 12x de R$ 56. Só 3 vagas pra esta semana — me chama agora no WhatsApp.`
- **Targeting fechado:**
  - **Bairros (6, 3km de raio cada):** Anita Garibaldi, Atiradores, Saguaçu, Boa Vista, América, Glória
  - **Faixa etária:** 28-45
  - **Gênero:** feminino
  - **Interesses:** Design de sobrancelhas, Maquiagem permanente, Sobrancelhas micropigmentadas, Estética avançada, Procedimentos estéticos
  - **CPC esperado:** R$ 0,40-0,80 (mais qualificado que os R$ 0,17 anteriores)
- **Destino:** wa.me/5547997071161 (mesmo número, fallback wa.me como antes)
- **Vídeo:** novo, com legendas em 3 momentos (gancho inicial → valor 12x R$ 56 no meio → CTA "chama no WhatsApp" no final). Capa custom só se 1º frame for fraco.
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
