# CRITICAL_STATE — traffic-manager

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
