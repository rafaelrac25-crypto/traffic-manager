# Feature pendente — Recomendação de investimento por bairro × serviço

**Status:** registrada 2026-04-20, aguarda integração Meta real + lista de serviços.
**Pré-requisitos:**
1. OAuth Meta + sync real funcionando (hoje é mock)
2. `insights` persistido por `{adId, bairro, dia}` (precisa de agregação por localização na API do Meta)
3. Lista de serviços definida pelo Rafa (ainda não enviada — esperar)

---

## Objetivo

Depois que os anúncios reais começarem a gerar métricas (via sync Meta), o sistema deve
automaticamente identificar quais **bairros de Joinville** estão performando melhor para
cada **tipo de serviço** da Cris Costa Beauty (ex: micropigmentação labial, lash lamination,
microagulhamento de sobrancelha, extensão de cílios, etc) e recomendar onde aumentar o
investimento.

## Entradas

1. **Métricas reais** por campanha × bairro × dia (via sync Meta)
2. **Lista de serviços** da Cris (Rafa vai enviar). Exemplo:
   ```js
   const SERVICES = [
     'micropigmentacao-labial',
     'lash-lamination',
     'microagulhamento-sobrancelha',
     'extensao-cilios',
     // ...
   ];
   ```
3. **Marcação do serviço na campanha** — cada anúncio precisa de campo `service: string` (ou tag)
   preenchido no Step 3 (Criativo) ou 4 (Publicação).

## Saída — 3 pontos de contato

### 1. Step 2 do CreateAd (Localização) — sugestão resumida
Ao escolher bairros, se houver histórico do serviço dessa campanha,
mostrar um banner **discreto** (não polui):

> 💡 Para **micropigmentação labial**, historicamente Glória e Saguaçu tiveram CPR 35% menor
> que a média. Considere priorizar.

Design: 1 linha, fundo suave, fechável.

### 2. Mapa de Calor — seção por campanha ativa
Na página `/mapa-de-calor`, ao filtrar por campanha específica, adicionar painel:

- **Top 3 bairros** com melhor CPR histórico pro serviço dessa campanha
- Sugestão de redistribuição de orçamento (semelhante ao `suggestOptimizedSplit` já
  existente em `data/performanceMock.js`)
- Botão "Aplicar sugestão" que ajusta bairros/raio no próximo anúncio

### 3. Sino de notificações — alerta de insight
Quando o algoritmo identificar **diferença significativa** (ex: bairro X com CPR 40%+
menor que a média há mais de 7 dias), disparar notificação:

> 🔥 Oportunidade detectada
> Glória está convertendo 42% melhor que a média para lash lamination.
> Considere aumentar investimento ou criar anúncio focado.

Kind: `insight-high-performer` ou `insight-low-performer`.

## Algoritmo (esboço)

```js
// Para cada campanha com serviço definido:
//   Para cada bairro ativo:
//     CPR_bairro = spend_bairro / conversions_bairro
//     Baseline_servico = média CPR histórica do serviço (≥30 dias ou ≥100 conv)
//     delta = (Baseline_servico - CPR_bairro) / Baseline_servico
//     se delta >= 0.25 → alerta positivo
//     se delta <= -0.30 → alerta negativo (bairro queimando orçamento)
```

## Estrutura de dados nova

Tabela/coluna a adicionar:
- `ads.service` — string (referência a um ID da lista de serviços)
- `insights_by_district` — tabela de agregação `{ad_id, district_name, date, spend, clicks, conversions}`

## Ponto de entrada do código (quando implementar)

- `frontend/src/data/serviceInsights.js` (novo) — lógica de cálculo e recomendação
- `frontend/src/pages/CreateAd.jsx` — adicionar campo `service` + banner no Step2Audience
- `frontend/src/pages/HeatMap.jsx` — adicionar painel de top bairros no `CampaignDetailPanel`
- `frontend/src/contexts/AppStateContext.jsx` — novo watcher que dispara `insight-*` notifications

## Respeita regras já estabelecidas

- **Joinville only**: geofence de 60km já filtra. Recomendações só entre os 18 bairros.
- **Sino só pra alertas**: essa notificação É um alerta acionável — encaixa.
- **UI compacta**: banner no Step2 deve ser 1 linha, fechável. Painel no HeatMap não pode
  empurrar o mapa pra baixo da dobra.

## Gatilho pra começar

Quando Rafa confirmar:
1. Enviou a lista de serviços
2. Integração Meta real já está trazendo insights por localização
