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
  const code = err?.code ?? err?.error?.code;
  const message = err?.message ?? err?.error?.message ?? String(err);
  const known = code != null ? META_ERROR_MAP[code] : null;
  return {
    code: code ?? null,
    raw: message,
    pt: known?.pt ?? message,
    retry: known?.retry ?? false,
    backoffMs: known?.backoffMs ?? 0,
    reconnect: known?.reconnect ?? false,
  };
}

module.exports = { META_ERROR_MAP, parseMetaError };
