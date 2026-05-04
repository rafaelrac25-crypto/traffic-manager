const META_ERROR_MAP = {
  1: { pt: 'Erro desconhecido da Meta — tentar novamente', retry: true, backoffMs: 2000 },
  2: { pt: 'Serviço Meta temporariamente indisponível', retry: true, backoffMs: 5000 },
  4: { pt: 'Limite de taxa atingido — aguardar antes de tentar de novo', retry: true, backoffMs: 60000 },
  10: { pt: 'Permissão negada para esta ação', retry: false },
  17: { pt: 'Limite de chamadas do usuário atingido', retry: true, backoffMs: 300000 },
  32: { pt: 'Limite de chamadas da página atingido', retry: true, backoffMs: 300000 },
  100: { pt: 'Parâmetro inválido na requisição', retry: false },
  102: { pt: 'Sessão expirada — reconectar o Facebook', retry: false, reconnect: true },
  104: { pt: 'Assinatura inválida do App', retry: false },
  190: { pt: 'Token de acesso inválido ou expirado — reconectar', retry: false, reconnect: true },
  200: { pt: 'Permissão OAuth insuficiente — revisar escopos do App no Meta Developer.', retry: false, reconnect: false },
  294: { pt: 'É necessário aceitar os termos de serviço do Meta Ads', retry: false },
  368: { pt: 'Ação bloqueada temporariamente pelo Meta (política)', retry: false },
  613: { pt: 'Muitas chamadas em pouco tempo — aguardar', retry: true, backoffMs: 60000 },
  1487756: { pt: 'Criativo rejeitado pela Meta — revisar imagem/texto', retry: false },
  1487194: { pt: 'Pixel não encontrado ou inacessível', retry: false },
  1815203: { pt: 'Segmentação inválida — revisar áudio/interesses', retry: false },
  2635: { pt: 'Este App precisa passar por App Review para esta ação', retry: false },
  3018: { pt: 'Ad Account não está ativa — verificar pagamento', retry: false },
  /* Subcodes específicos vistos em produção (antes caíam em "Parâmetro inválido") */
  1870227: { pt: 'Audiência expandida (Advantage Audience) incompatível — desative ou ajuste o público', retry: false },
  1487891: { pt: 'Botão (CTA) incompatível com o objetivo da campanha — escolha um botão de família compatível (ex: Mensagens p/ campanha de Mensagens)', retry: false },
  2490408: { pt: 'Tipo de destino (destination_type) ausente ou inválido — escolha onde a conversa vai (Instagram Direct, Messenger ou WhatsApp)', retry: false },
  1492013: { pt: 'Vídeo ainda não terminou de processar no Meta — aguarde 1-2 minutos e tente novamente', retry: true, backoffMs: 60000 },
};

function parseMetaError(err) {
  const inner = err?.error || err;
  const code = inner?.code;
  const subcode = inner?.error_subcode;
  const message = inner?.message ?? String(err);
  /* error_user_msg / error_user_title são muito mais específicos que
     "Invalid parameter" e dizem EXATAMENTE qual campo está errado. */
  const userTitle = inner?.error_user_title;
  const userMsg = inner?.error_user_msg;
  const known = code != null ? META_ERROR_MAP[code] : null;

  /* Mensagem final: priorize o detalhe específico do Meta quando existir. */
  let pt = known?.pt ?? message;
  if (userMsg) {
    pt = userTitle ? `${userTitle}: ${userMsg}` : userMsg;
  }

  return {
    code: code ?? null,
    subcode: subcode ?? null,
    raw: message,
    pt,
    user_title: userTitle || null,
    user_msg: userMsg || null,
    retry: known?.retry ?? false,
    backoffMs: known?.backoffMs ?? 0,
    reconnect: known?.reconnect ?? false,
  };
}

/**
 * Whitelist de códigos seguros pra retry em métodos NÃO-idempotentes
 * (POST/DELETE). Inclui apenas códigos onde a Meta confirma que a
 * request NÃO foi processada (rate limit pré-execução).
 *
 * Em GET, qualquer código com `retry: true` pode ser tentado de novo.
 * Em POST/DELETE, só esses — pra evitar criar campanha duplicada se
 * a Meta processou mas o cliente desconectou antes de receber 200.
 */
const POST_RETRY_WHITELIST = new Set([4, 17, 32, 613]);

/**
 * Decide se um erro pode ser tentado de novo dado o método HTTP.
 *
 * @param {object} parsed — resultado de parseMetaError
 * @param {string} method — 'GET' | 'POST' | 'DELETE'
 * @returns {boolean}
 */
function isRetryableForMethod(parsed, method) {
  if (!parsed?.retry) return false;
  if (method === 'GET') return true;
  /* POST/DELETE: só rate limit confirmado (pré-execução) */
  return parsed.code != null && POST_RETRY_WHITELIST.has(parsed.code);
}

module.exports = {
  META_ERROR_MAP,
  parseMetaError,
  POST_RETRY_WHITELIST,
  isRetryableForMethod,
};
