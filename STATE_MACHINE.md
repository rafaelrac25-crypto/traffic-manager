# STATE_MACHINE — Estados de campanha Meta

Como o sistema reage aos estados de campanha/anúncio que vêm da Meta. Hoje a lógica está espalhada em 3 arquivos — esse doc é só pra ter tudo numa página.

## Origem do estado

A Meta retorna 2 campos por campanha:

- **`status`** — o que o usuário/sistema setou (ex: `ACTIVE`, `PAUSED`).
- **`effective_status`** — o que **realmente** acontece no momento (autoritativo). Ex: você seta `ACTIVE` mas a Meta mantém em `PENDING_REVIEW` até aprovar. É o `effective_status` que dispara notificação.

O sistema só usa `status` raw em casos pontuais; a fonte de verdade pras transições é **`effective_status`**.

## Estados Meta → categoria UI

`backend/src/services/metaAds.js:60-69` colapsa todos os estados Meta em 4 categorias pra UI:

| Categoria UI | `effective_status` Meta |
|---|---|
| `active` | `ACTIVE` |
| `paused` | `PAUSED` |
| `review` | `IN_PROCESS`, `PENDING_REVIEW`, `PREAPPROVED`, `PENDING_BILLING_INFO`, `WITH_ISSUES`, `PENDING_PROCESSING` |
| `ended` | `DISAPPROVED`, `ADSET_PAUSED`, `CAMPAIGN_PAUSED`, `ARCHIVED`, `DELETED` |

## Transições que o sistema reage

Polling roda a cada 90s em `frontend/src/contexts/AppStateContext.jsx:170-234`. Compara `old.effective_status` com o novo e dispara:

| Origem | Destino | Reação | Onde |
|---|---|---|---|
| qualquer | `PENDING_REVIEW` | Sino: "Anúncio em revisão no Meta" (info) | `AppStateContext.jsx:212` |
| `PENDING_REVIEW`, `PREAPPROVED`, `PENDING_BILLING_INFO` | `ACTIVE` | Sino: "Anúncio aprovado e no ar 🎉" (approved) | `AppStateContext.jsx:219` |
| qualquer (≠ `DISAPPROVED`) | `DISAPPROVED` | Sino: "Anúncio reprovado após revisão" (rejected) + entra em `/reprovados` | `AppStateContext.jsx:226` |
| `ACTIVE` → `PAUSED` (ou inverso) | manual do usuário | Sem notificação (decisão do próprio Rafa) | — |

## Caso especial: rejeição imediata no publish

Algumas reprovações acontecem **na hora** do publish, sem passar por `PENDING_REVIEW` (ex: política de conteúdo bate na hora). Esse caminho **não passa pelo polling** — é tratado direto na resposta de `POST /api/campaigns/:id/publish`.

Função: `addRejectedAd()` (mesmo arquivo `AppStateContext.jsx`). Aciona a entrada em `/reprovados` com o motivo retornado pelo Meta na chamada de criação.

## Estados raros que aparecem mas não disparam sino

- `WITH_ISSUES` — anúncio rodando mas com problema (ex: limite de gasto). UI mostra como "em revisão" pra Rafa investigar.
- `IN_PROCESS` — fase intermediária, geralmente passa pra `PENDING_REVIEW` em segundos.
- `PREAPPROVED` — Meta pré-aprovou mas ainda não liberou (geralmente aguardando billing). Conta como "review" na UI.

Esses estados foram observados mas a Meta não documenta exatamente quando aparecem; tratamos defensivamente como "review" e deixamos o ciclo seguir até `ACTIVE` ou `DISAPPROVED`.

## Onde caçar quando algo der errado

| Sintoma | Onde olhar primeiro |
|---|---|
| Sino não tocou após mudança | `AppStateContext.jsx:175-234` (transição detectada?) |
| Status na UI travado | `metaAds.js:60-69` (`effective_status` chegou novo?) |
| Quero estado ao vivo de 1 campanha | `GET /api/campaigns/:id/diagnose` |
| Quero estado ao vivo da última | `GET /api/campaigns/last/diagnose` |
