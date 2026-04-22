const META_ERROR_MAP = {
  1: { pt: 'Erro desconhecido da Meta — tentar novamente', retry: true },
  2: { pt: 'Serviço Meta temporariamente indisponível', retry: true },
  4: { pt: 'Limite de taxa atingido — aguardar antes de tentar de novo', retry: true, backoffMs: 60000 },
  10: { pt: 'Permissão negada para esta ação', retry: false },
  17: { pt: 'Limite de chamadas do usuário atingido', retry: true, backoffMs: 300000 },
  32: { pt: 'Limite de chamadas da página atingido', retry: true, backoffMs: 300000 },
  100: { pt: 'Parâmetro inválido na requisição', retry: false },
  102: { pt: 'Sessão expirada — reconectar o Facebook', retry: false, reconnect: true },
  104: { pt: 'Assinatura inválida do App', retry: false },
  190: { pt: 'Token de acesso inválido ou expirado — reconectar', retry: false, reconnect: true },
  200: { pt: 'Permissões insuficientes — revisar escopos do OAuth', retry: false, reconnect: true },
  294: { pt: 'É necessário aceitar os termos de serviço do Meta Ads', retry: false },
  368: { pt: 'Ação bloqueada temporariamente pelo Meta (política)', retry: false },
  613: { pt: 'Muitas chamadas em pouco tempo — aguardar', retry: true, backoffMs: 60000 },
  1487756: { pt: 'Criativo rejeitado pela Meta — revisar imagem/texto', retry: false },
  1487194: { pt: 'Pixel não encontrado ou inacessível', retry: false },
  1815203: { pt: 'Segmentação inválida — revisar áudio/interesses', retry: false },
  2635: { pt: 'Este App precisa passar por App Review para esta ação', retry: false },
  3018: { pt: 'Ad Account não está ativa — verificar pagamento', retry: false },
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

module.exports = { META_ERROR_MAP, parseMetaError };
