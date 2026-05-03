# Auditoria Meta — Síntese Executiva (2026-04-24)

3 agentes auditaram em paralelo: Auth/Token (5 arquivos), Publish/Media (6 arquivos), Sync/Status/Health (6 arquivos). 17 arquivos da camada Meta cobertos. Achados verificados manualmente nos pontos mais críticos (file:line citados confirmados no código).

## Estado geral

**Sólido pra publicar a 1ª campanha** — happy path funciona. Há **3 bugs reais que vale corrigir antes** (~1h de trabalho) e **4 fragilidades que importam pra operação contínua** (mas não pra 1º publish).

---

## 🔴 Crítico — corrigir antes de publicar 1ª campanha

### 1. Race condition no refresh de token (`metaToken.js:61-94`) — **VERIFICADO**
- **O que é:** Quando token tem <15 dias pra expirar, função `refreshIfNeeded` não tem trava. Se 2 requests chegam juntos, ambos disparam refresh; o último UPDATE no banco invalida o token do primeiro. O 1º request usa token zumbi e Meta rejeita com erro 190.
- **Quando bate:** Você clicar Publicar e simultaneamente atualizar a página, ou abrir 2 abas, ou backend fizer 2 chamadas em paralelo.
- **Probabilidade:** Baixa-média pra usuário único, mas real. Hoje seu token tem 57 dias — só será gatilhado quando chegar a 15 dias (~1 mês).
- **Fix:** Adicionar Promise lock por plataforma. ~15min.

### 2. Vídeo não-pronto não aborta publicação (`metaWrite.js:165-167`)
- **O que é:** `waitForVideoReady` faz polling com timeout de 60s. Se vídeo não fica `ready` no prazo, a função retorna `{ ready: false }` mas **publicação continua**. Cria creative + ads referenciando vídeo em processamento. Meta rejeita com erro 1492013.
- **Quando bate:** Vídeos >15MB ou Meta lento. Cleanup dispara depois, mas você vê erro genérico ("Parâmetro inválido"), não claro.
- **Probabilidade:** Média se você usar vídeo. Baixa se só imagem.
- **Fix:** Se `!ready` após timeout, `throw` antes de criar creative + aumentar timeout pra 120s. ~10min.

### 3. Polling Meta pode congelar silenciosamente (`AppStateContext.jsx:245-249`) — **VERIFICADO**
- **O que é:** Polling roda a cada 90s e chama `runMetaSync()`. Se uma sync demora >90s (Meta lento), `setInterval` dispara o próximo tick antes do anterior terminar. Se Meta trava de vez, `metaSyncing` fica `true` pra sempre, polling congela. Widget Status do Sistema continua mostrando "verde" porque ele não checa se polling está vivo.
- **Quando bate:** Meta com latência alta (acontece de tempos em tempos), ou rede sua oscilando.
- **Probabilidade:** Baixa-média.
- **Fix:** Verificar `metaSyncing` antes de chamar + timeout de 60s no fetch interno. ~15min.

---

## 🟠 Alto — não bloqueia 1º publish, mas vale corrigir nas próximas semanas

### 4. Sem transação DB após `publishCampaign` (`campaigns.js:57-91`)
- **O que é:** Meta cria a campanha, retorna IDs, e o backend faz `INSERT` no banco local. Se o INSERT falhar (timeout Vercel), campanha existe no Meta mas não no painel.
- **Probabilidade:** Baixa (INSERT é rápido). Impacto: alto (campanha órfã, difícil de recuperar).
- **Fix:** Detectar duplicata antes do INSERT + envolver em try/catch que rolla pro Meta se falhar. ~30min.

### 5. Health endpoint mente quando token é revogado externamente (`health.js:41-85`) — **VERIFICADO**
- **O que é:** `/api/health/full` lê flag `needs_reconnect` do banco, **não faz chamada real ao Meta**. Se você revogar acesso no Facebook (Configurações → Apps), o flag não atualiza automaticamente — health continua dizendo "Meta: ok".
- **Probabilidade:** Baixa (você não vai revogar manualmente). Mas deixa o widget de saúde com credibilidade reduzida.
- **Fix:** Adicionar 1 chamada leve `GET /me` ao Graph dentro do `checkMeta()`. ~15min.

### 6. 50 ads aprovados = 50 sinos em sequência (`AppStateContext.jsx:430-455`)
- **O que é:** Quando você volta após dias offline e o polling captura várias transições de uma vez, dispara uma notificação por ad.
- **Probabilidade:** Alta no longo prazo (ausência de fim de semana já basta). UX ruim.
- **Fix:** Agrupar por tipo ("3 anúncios aprovados" em vez de 3 sinos). ~20min.

### 7. Insights por bairro retorna vazio em silêncio (`campaigns.js:411-412`)
- **O que é:** O endpoint `/analytics/districts` filtra por `location.name`. Se você usa coordenadas sem nome, retorna `{districts: []}` sem erro. Você acha que a feature não funciona.
- **Probabilidade:** Depende de como o wizard salva. Vale verificar.
- **Fix:** Geocodar reverso quando `name` ausente OU validar no salvar. ~30min.

---

## 🟡 Médio — bom saber, baixa urgência

8. **Cleanup de órfãos sem logging detalhado** (`metaWrite.js:277-356`) — se publish falha no anel #3 de 5, log diz "anel 3 falhou" mas não lista quais ad sets já foram criados. Dificulta debug manual.

9. **CTA WhatsApp com objetivo não-Mensagens silenciosamente vira LEARN_MORE** — quando objetivo é "Engajamento" mas CTA é WhatsApp, sistema corrige sem avisar. UX confusa.

10. **Cobertura de erros Meta incompleta** (`metaErrors.js`) — códigos 1870227 (advantage_audience), 1487891 (CTA mismatch), 2490408 (destination_type), 1492013 (vídeo não pronto) caem em mensagem genérica "Parâmetro inválido".

11. **Token decryption frágil com `:`** (`metaToken.js`) — heurística pra detectar se token está criptografado usa "contém `:`?". Token plain text com `:` quebraria. Risco ~1%, mas fix é trivial (prefix `enc:`).

12. **`page_id` confundido no payload do vídeo** (`metaNormalize.js:265`) — front envia `ad.metaAccountId` como page_id; backend sobrescreve com `creds.page_id`. Acoplamento ambíguo.

13. **Interesses fake silenciosamente descartados** (`metaWrite.js:119-139`) — se você cria interesse customizado, Meta não acha, sistema descarta sem avisar. Targeting fica mais amplo que esperado.

14. **localStorage divergente do banco** (`AppStateContext.jsx:416-427`) — se backend deleta um ad mas localStorage mantém, frontend mostra ad fantasma.

15. **Webhook signature sem log se `FB_APP_SECRET` mudar** (`webhooks.js:14-28`) — se algum dia env var ficar errada na Vercel, webhook silenciosamente para. Defensivo.

---

## 🟢 O que está bem (não listado como achado, mas notável)

- Criptografia AES-256-GCM dos tokens implementada corretamente (IV aleatório, auth tag, fail-fast se `TOKEN_ENC_KEY` ausente)
- OAuth state CSRF protegido (gerado random, validado, deletado)
- Refresh automático do long-lived token implementado (60 dias)
- Status inicial sempre `PAUSED` (você ativa manualmente — seguro)
- Schema Meta v20 correto: ODAX objectives, gender int, budget centavos, advantage_audience: 0, destination_type pra messaging
- Dedupe de geo overlap (resolve erro 1487756)
- Fallback Joinville HOME_COORDS+15km quando dedupe esvazia (mantém regra "só Joinville")
- Cleanup de órfãos no publish funciona (apenas logging que falta)

---

## Recomendação

**Antes de publicar 1ª campanha:** corrigir os 3 itens 🔴. Tempo total: **~40 minutos**.

**Depois de publicar com sucesso:** trabalhar nos 4 itens 🟠 nas próximas 1-2 semanas.

**Baixa prioridade:** os 8 itens 🟡 podem entrar em backlog conforme aparecer necessidade.
