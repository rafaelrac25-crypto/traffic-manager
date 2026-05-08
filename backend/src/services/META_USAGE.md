# Monitor de uso da Meta API (X-App-Usage)

Adicionado em 2026-05-08 após Meta rebaixar nosso tier de 1500 → 500 chamadas/h e bloquear a conta pessoal da Cris por uso excessivo da API.

## O que ele faz

Em cada response do Meta Graph API, lê 3 headers e calcula o pico de %:

| Header | O que mede |
|---|---|
| `x-app-usage` | uso do App ID (call_count, total_cputime, total_time) |
| `x-business-use-case-usage` | uso por Business Use Case |
| `x-ad-account-usage` | uso da ad account específica |

Cada valor vai de 0 a 100. Quando passa de ~90, Meta começa a throttlar e pode rebaixar tier permanentemente.

## Thresholds

| Pico % | Ação |
|---|---|
| 0–69 | nada |
| 70–89 | warn no log do Vercel |
| ≥90 | **aborta a request** com erro `META_USAGE_CRITICAL` (proteção dura) |

A request que passar de 90% nem é processada — falha alto pra evitar reincidência.

## Como ver o uso atual em prod

```
GET https://criscosta.vercel.app/api/health/full
```

Procurar o item `meta_usage` no array. Exemplo de saída saudável:

```json
{
  "key": "meta_usage",
  "label": "Uso da API Meta",
  "status": "ok",
  "details": "Saudável — pico 12% (call_count=12%, cputime=8%, ...)",
  "meta": { "peak_pct": 12, "observed_at": "2026-05-08T..." }
}
```

Se `status: "error"` ou `peak_pct >= 70`: **NÃO publicar nada**. Esperar pelo menos 1h pro contador zerar.

## Cap de rate limit interno

Está em `metaRateLimit.js` — `CAPACITY = 300/h`. Cobre:
- 1 publishCampaign completo (~10 calls)
- 1 sync diário automático
- ~5 diagnoses ocasionais
- Folga de 60% pra debug

## Antes de SUBIR o CAPACITY

Checklist obrigatório:

1. Rodar `/api/health/full` por 7 dias seguidos e confirmar que `meta_usage.peak_pct < 30%` em todas as medições
2. Confirmar que o tier do app não está degradado (Meta envia email quando rebaixa)
3. Subir gradualmente: 300 → 500 → 800. Nunca pular pra 1000+
4. **Avisar o Rafa** explicitamente da decisão antes do commit

Histórico ruim: cap subiu 180 → 1000 sem checklist em 2026-05-06 → bloqueio em 08/05.

## Quando o abort dispara em produção

Sintoma: usuário vê erro `Uso da API Meta em XX% — abortando pra proteger conta`.

O que fazer:
1. **Não tentar de novo nas próximas 1-2h** (Meta refaz contador a cada hora)
2. Verificar `/api/health/full` → `meta_usage` cair pra <50%
3. Se persistir >2h, possível tier degradado — Cris deve checar email do Meta sobre limite de chamadas
4. Investigar causa do pico no log do Vercel: qual endpoint estava sendo chamado quando passou de 70% (warn anterior ao abort)

## Arquivos relacionados

- `metaHttp.js` — captura headers, calcula %, aborta. Ponto único de entrada pra Meta API
- `metaRateLimit.js` — cap interno de 300/h, falha explícita em vez de bypass
- `routes/health.js` → `checkMetaUsage()` expõe estado em `/api/health/full`
