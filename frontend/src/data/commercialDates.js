/**
 * Datas comerciais brasileiras relevantes para estética feminina / Cris Costa Beauty.
 *
 * IMPORTANTE — diretrizes de comunicação:
 *  - NUNCA falar "promoção" nem "desconto agressivo".
 *  - Usar: "oportunidade", "condição especial", "poucas vagas", "agende uma avaliação",
 *    "exclusivo para", "presente que se cuida".
 *  - Foco em valor percebido, cuidado e exclusividade.
 */

/* ── Calculadores de datas móveis ── */
function nthWeekdayOfMonth(year, monthIndex, weekday, n) {
  // weekday: 0=domingo ... 6=sábado. n: 1ª, 2ª, 3ª...
  const d = new Date(year, monthIndex, 1);
  const offset = (weekday - d.getDay() + 7) % 7;
  return new Date(year, monthIndex, 1 + offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(year, monthIndex, weekday) {
  const last = new Date(year, monthIndex + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, monthIndex, last.getDate() - offset);
}

function fixedDate(year, monthIndex, day) {
  return new Date(year, monthIndex, day);
}

/* ── Páscoa (algoritmo de Gauss) ── */
function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function carnival(year) {
  const e = easter(year);
  const d = new Date(e);
  d.setDate(d.getDate() - 47);
  return d;
}

/* ── Dataset ── */
/**
 * Cada entrada define:
 *  - id: slug único
 *  - name, emoji
 *  - resolver(year): retorna Date para o ano informado
 *  - whyImportant: porquê é relevante para Cris Costa Beauty
 *  - actions: array de sugestões concretas de ação
 *  - communication: dicas de linguagem (sem promoção)
 *  - daysBefore: quantos dias antes começar a veicular
 *  - preFill: { primaryText, headline } — usado ao pré-preencher CreateAd
 *  - suggestedBudget: { daily, reason } — sugestão de investimento diário em R$
 */
export const COMMERCIAL_DATES = [
  {
    id: 'dia-da-mulher',
    name: 'Dia Internacional da Mulher',
    emoji: '💐',
    resolver: (y) => fixedDate(y, 2, 8),
    whyImportant:
      'Momento de celebrar a mulher e reforçar autocuidado. Público-alvo 100% aderente à Cris Costa Beauty — alta propensão a agendar procedimentos de beleza e relaxamento.',
    actions: [
      'Campanha "Semana da Mulher" com agenda especial de avaliações gratuitas',
      'Protocolo de cuidado facial express como experiência exclusiva',
      'Combo de spa dia das amigas (condição especial para duas clientes juntas)',
      'Conteúdo em vídeo com depoimentos de clientes',
    ],
    communication: [
      'Use "você merece", "presente que se cuida", "exclusivo para nossas mulheres".',
      'Evite termo "promoção" — substitua por "condição especial desta semana".',
      'Reforce exclusividade: "agenda limitada, poucas vagas".',
    ],
    daysBefore: 14,
    preFill: {
      primaryText:
        'Esta semana é sua. Uma pausa para se olhar no espelho e se reconhecer. Agende uma avaliação gratuita com nossa equipe e descubra o protocolo ideal para você. Vagas limitadas nesta Semana da Mulher.',
      headline: 'Seu Dia da Mulher começa aqui',
    },
    suggestedBudget: {
      daily: 40,
      reason: 'Data forte para estética feminina. Invista R$ 40/dia nos 14 dias antes para alcance consistente.',
    },
  },
  {
    id: 'carnaval',
    name: 'Carnaval',
    emoji: '🎭',
    resolver: (y) => carnival(y),
    whyImportant:
      'Semanas antes do Carnaval há pico de procura por procedimentos estéticos: depilação a laser, peeling, drenagem, bronze e preparação de pele. Pós-Carnaval, há procura por hidratação profunda e recuperação.',
    actions: [
      'Protocolo "Pré-Carnaval" com depilação + hidratação corporal',
      'Condição especial para pacote de drenagem (mínimo 5 sessões)',
      'Campanha pós-Carnaval de recuperação de pele e cabelo',
      'Anúncio com foco em agilidade: "última semana para resultados visíveis"',
    ],
    communication: [
      'Crie urgência real sem apelar: "quem agenda hoje, chega pronta".',
      'Evite imagens estereotipadas — foque em rotina de cuidado.',
    ],
    daysBefore: 21,
    preFill: {
      primaryText:
        'O Carnaval está chegando e sua pele merece chegar pronta. Agende agora seu protocolo pré-Carnaval e garanta uma das últimas vagas da nossa agenda.',
      headline: 'Últimas vagas para o seu pré-Carnaval',
    },
    suggestedBudget: {
      daily: 35,
      reason: 'Janela de 21 dias é longa — R$ 35/dia cobre o alcance sem cansar o público.',
    },
  },
  {
    id: 'dia-do-cabeleireiro',
    name: 'Dia do Cabeleireiro',
    emoji: '💇‍♀️',
    resolver: (y) => fixedDate(y, 4, 3),
    whyImportant:
      'Dia da categoria — ótima data para reforçar autoridade do salão, mostrar bastidores e valorizar profissionais. Gera conexão com o público e humaniza a marca.',
    actions: [
      'Série de posts com apresentação dos profissionais da equipe',
      'Vídeos curtos de bastidores com dicas de cuidado capilar',
      'Condição especial de escova ou hidratação exclusivamente neste dia',
    ],
    communication: [
      'Foque nos profissionais — não no desconto.',
      '"Quem cuida de você tem nome" é um bom ângulo.',
    ],
    daysBefore: 7,
    preFill: {
      primaryText:
        'Hoje é o dia deles. Quem cuida do seu cabelo com técnica, carinho e conhecimento. Conheça nossa equipe e agende um momento exclusivo com quem entende do assunto.',
      headline: 'Quem cuida de você tem nome',
    },
    suggestedBudget: {
      daily: 25,
      reason: 'Data institucional — objetivo é reconhecimento de marca, não venda direta.',
    },
  },
  {
    id: 'dia-das-maes',
    name: 'Dia das Mães',
    emoji: '🌷',
    resolver: (y) => nthWeekdayOfMonth(y, 4, 0, 2),
    whyImportant:
      'Uma das datas mais fortes comercialmente para estética feminina. Duplo público: quem se presenteia + quem compra presente para a mãe. Cartões-presente, pacotes, experiências de spa — tudo performa bem nesta janela.',
    actions: [
      'Cartão-presente digital para mães (quem compra pode ser filho, esposo)',
      'Pacote "Manhã de spa" com protocolo completo (limpeza de pele + massagem)',
      'Campanha com depoimentos de mães clientes',
      'Anúncio no Instagram com áudio emocional real (não clichê)',
    ],
    communication: [
      '"Dê de presente a única coisa que ela nunca compra pra si" funciona bem.',
      'Evite clichês ("super-heroína"). Foque em pausa, carinho, descoberta.',
      'Use "condição especial", "experiência exclusiva", "poucas vagas nesta agenda".',
    ],
    daysBefore: 21,
    preFill: {
      primaryText:
        'Ela cuida de todo mundo. Neste Dia das Mães, presenteie-a com aquilo que ela nunca compra pra si: tempo, cuidado e uma pausa bem merecida. Cartão-presente digital disponível — agenda limitada.',
      headline: 'Um presente que ela nunca compra pra si',
    },
    suggestedBudget: {
      daily: 60,
      reason: 'Data mais forte do ano para estética. Invista R$ 60/dia para maximizar vendas de cartão-presente.',
    },
  },
  {
    id: 'dia-dos-namorados',
    name: 'Dia dos Namorados',
    emoji: '💕',
    resolver: (y) => fixedDate(y, 5, 12),
    whyImportant:
      'Demanda por procedimentos estéticos sobe: depilação, skincare, tratamentos de brilho. Também abre espaço para pacotes a dois (massagem relaxante em casal).',
    actions: [
      'Pacote "Dia dos Namorados a dois" — massagem relaxante em casal',
      'Protocolo pré-encontro: skincare + designer de sobrancelhas',
      'Cartão-presente para quem quer presentear a parceira',
    ],
    communication: [
      'Fuja do clichê romântico. Fale de autocuidado + momento a dois.',
      '"Para se sentir bem quando se olha no espelho" é mais forte que "para ele".',
    ],
    daysBefore: 14,
    preFill: {
      primaryText:
        'O melhor presente começa em você. Agende nosso protocolo exclusivo de Dia dos Namorados e chegue inteira no encontro. Pacotes para duas pessoas com condição especial.',
      headline: 'Chegue inteira ao encontro',
    },
    suggestedBudget: {
      daily: 40,
      reason: 'Ticket médio alto (pacote duplo). R$ 40/dia por 14 dias rende bom retorno.',
    },
  },
  {
    id: 'dia-do-amigo',
    name: 'Dia do Amigo',
    emoji: '👯‍♀️',
    resolver: (y) => fixedDate(y, 6, 20),
    whyImportant:
      'Oportunidade para estimular indicação e vinda em grupo. Amigas saem juntas para se cuidar — conteúdo de "manhã entre amigas" performa muito bem.',
    actions: [
      'Condição especial para clientes que trazem uma amiga',
      'Pacote "manhã entre amigas" — dois protocolos simultâneos',
      'Campanha de indicação com bônus de sessão para ambas',
    ],
    communication: [
      '"Traga quem te faz bem" funciona melhor que "indique e ganhe".',
      'Foque no ritual compartilhado, não no benefício transacional.',
    ],
    daysBefore: 10,
    preFill: {
      primaryText:
        'As melhores manhãs são com quem a gente ama. Agende uma experiência a dois no nosso espaço e divida mais que um protocolo — divida um momento. Condição especial para vocês duas.',
      headline: 'Traga quem te faz bem',
    },
    suggestedBudget: {
      daily: 25,
      reason: 'Data nichada — R$ 25/dia foca público engajado e estimula indicação.',
    },
  },
  {
    id: 'dia-dos-pais',
    name: 'Dia dos Pais',
    emoji: '👨‍👧',
    resolver: (y) => nthWeekdayOfMonth(y, 7, 0, 2),
    whyImportant:
      'Data menos óbvia para estética feminina, mas cresce o público masculino em procedimentos (barba, skincare, depilação). Também é chance de comunicar carinho com o pai/sogro via cartão-presente.',
    actions: [
      'Protocolos masculinos exclusivos: barba terapia, limpeza de pele',
      'Cartão-presente "homem que se cuida"',
      'Conteúdo de depoimentos de clientes homens',
    ],
    communication: [
      'Evite linguagem caricata. Trate com a mesma naturalidade da cartela feminina.',
      '"Cuidar é coisa de homem também" é um bom gancho.',
    ],
    daysBefore: 14,
    preFill: {
      primaryText:
        'Homem que se cuida merece um espaço feito pra isso. Neste Dia dos Pais, presenteie com um protocolo exclusivo de skincare masculino ou barba terapia. Agenda limitada.',
      headline: 'Cuidar é coisa de homem também',
    },
    suggestedBudget: {
      daily: 30,
      reason: 'Público masculino é menor mas tem menos concorrência nos anúncios.',
    },
  },
  {
    id: 'dia-da-beleza',
    name: 'Dia Internacional da Beleza',
    emoji: '✨',
    resolver: (y) => fixedDate(y, 8, 9),
    whyImportant:
      'Data da profissão e do universo da beleza. Ótima para institucional, reforço de autoridade e diferenciação. Público altamente engajado no segmento.',
    actions: [
      'Série de posts com a história da Cris Costa Beauty',
      'Vídeo institucional mostrando espaço e equipe',
      'Agenda de avaliações gratuitas para clientes novas',
    ],
    communication: [
      'Fale sobre a filosofia da casa: beleza como bem-estar, não padrão.',
      'Evite termos que reduzam beleza a aparência.',
    ],
    daysBefore: 10,
    preFill: {
      primaryText:
        'Beleza é cuidado. É se olhar no espelho e se reconhecer. Neste Dia Internacional da Beleza, venha conhecer nosso espaço e conversar com nossa equipe. Avaliação gratuita para novas clientes.',
      headline: 'Beleza é se reconhecer',
    },
    suggestedBudget: {
      daily: 30,
      reason: 'Data do setor — engajamento alto com conteúdo institucional.',
    },
  },
  {
    id: 'dia-da-secretaria',
    name: 'Dia das Secretárias',
    emoji: '💼',
    resolver: (y) => fixedDate(y, 8, 30),
    whyImportant:
      'Público profissional majoritariamente feminino — alvo direto. Empresas presenteiam funcionárias; oportunidade para cartão-presente B2B.',
    actions: [
      'Cartão-presente corporativo (empresas para funcionárias)',
      'Protocolo express "pausa no expediente" (1h)',
      'Campanha com foco em bem-estar no trabalho',
    ],
    communication: [
      '"Pausa merecida" é mais forte que "homenagem".',
      'Para B2B, destaque praticidade: "cartão-presente digital, entrega imediata".',
    ],
    daysBefore: 14,
    preFill: {
      primaryText:
        'Uma pausa no meio da semana que faz diferença. Protocolo express de 1h para quem precisa de um respiro. Cartão-presente corporativo disponível — entrega digital imediata.',
      headline: 'Uma pausa bem merecida',
    },
    suggestedBudget: {
      daily: 25,
      reason: 'Foco B2B limita alcance. R$ 25/dia por 14 dias basta.',
    },
  },
  {
    id: 'outubro-rosa',
    name: 'Outubro Rosa',
    emoji: '🎗️',
    resolver: (y) => fixedDate(y, 9, 1),
    whyImportant:
      'Mês de conscientização sobre câncer de mama. Oportunidade para posicionamento de marca com causa — não transacional. Campanhas institucionais geram alta conexão emocional e autoridade.',
    actions: [
      'Conteúdo educativo sobre autoexame e prevenção',
      'Parceria com instituição local (doação parte do faturamento)',
      'Protocolos de cuidado específicos para pacientes em tratamento',
      'Série de posts com depoimentos de clientes/sobreviventes',
    ],
    communication: [
      'Nada de "ganhe desconto usando rosa". Zero oportunismo.',
      'Foque em informação, acolhimento e ação concreta (parceria real).',
    ],
    daysBefore: 20,
    preFill: {
      primaryText:
        'Outubro é mês de cuidado de verdade. Durante todo o mês, parte do valor dos nossos protocolos é destinada a uma instituição local. Agende e faça parte. Mais que beleza — cuidado.',
      headline: 'Cuidar é um ato',
    },
    suggestedBudget: {
      daily: 35,
      reason: 'Mês inteiro — R$ 35/dia garante presença sem exaurir orçamento.',
    },
  },
  {
    id: 'dia-das-criancas',
    name: 'Dia das Crianças',
    emoji: '🧸',
    resolver: (y) => fixedDate(y, 9, 12),
    whyImportant:
      'Data familiar — mães levam o dia com os filhos e depois buscam tempo para si. Ótima janela para "pós-dia das crianças" (13 e 14 de outubro): protocolo de descanso para mães.',
    actions: [
      'Campanha "depois do dia delas, o seu" (13 e 14 de outubro)',
      'Protocolo de drenagem ou massagem relaxante',
      'Condição especial para mãe + filha adolescente (a partir de 14 anos)',
    ],
    communication: [
      'Foque na mãe exausta, não na criança.',
      '"Depois do dia delas, o seu" é um ângulo forte.',
    ],
    daysBefore: 10,
    preFill: {
      primaryText:
        'Depois do dia delas, chega o seu. Agende nosso protocolo de relaxamento e recupere as energias que só mãe gasta. Vagas limitadas para os dias 13 e 14 de outubro.',
      headline: 'Depois do dia delas, o seu',
    },
    suggestedBudget: {
      daily: 30,
      reason: 'Nicho específico (mães). R$ 30/dia mantém custo por resultado baixo.',
    },
  },
  {
    id: 'dia-do-professor',
    name: 'Dia do Professor',
    emoji: '📚',
    resolver: (y) => fixedDate(y, 9, 15),
    whyImportant:
      'Categoria amplamente feminina; alta adesão a procedimentos de estética. Oportunidade para condição especial para professoras comprovadas.',
    actions: [
      'Condição especial mediante apresentação de carteirinha/contracheque',
      'Pacote "volta às aulas" (cuidado com pele cansada, olheiras)',
      'Conteúdo com depoimentos de professoras clientes',
    ],
    communication: [
      'Use "reconhecimento", não "desconto".',
      '"Para quem ensina o mundo a ler, um momento só seu" funciona bem.',
    ],
    daysBefore: 10,
    preFill: {
      primaryText:
        'Para quem ensina o mundo a ler, um momento só seu. Professoras têm condição especial na nossa agenda nesta semana. Agende e venha relaxar.',
      headline: 'Um momento só seu',
    },
    suggestedBudget: {
      daily: 25,
      reason: 'Segmentação por profissão deixa alcance menor e mais qualificado.',
    },
  },
  {
    id: 'halloween',
    name: 'Halloween',
    emoji: '🎃',
    resolver: (y) => fixedDate(y, 9, 31),
    whyImportant:
      'Oportunidade para conteúdo lúdico e viralizante — maquiagem, cuidado pós-festa (pele sensibilizada). Bom para gerar alcance orgânico em paralelo ao tráfego pago.',
    actions: [
      'Tutorial de remoção segura de maquiagem pesada',
      'Protocolo "recuperação pós-festa" para skincare',
      'Conteúdo de bastidores divertido com a equipe',
    ],
    communication: [
      'Leve, sem exagero. Não precisa de hard sell.',
      'Foque em conteúdo educacional de skincare pós-festa.',
    ],
    daysBefore: 5,
    preFill: {
      primaryText:
        'Festa boa deixa pele cansada. Nosso protocolo pós-festa recupera o viço em 1h. Agende para os primeiros dias de novembro — vagas limitadas.',
      headline: 'A pele volta ao normal em 1h',
    },
    suggestedBudget: {
      daily: 20,
      reason: 'Janela curta. R$ 20/dia suficiente para conteúdo educacional de skincare.',
    },
  },
  {
    id: 'black-friday',
    name: 'Black Friday',
    emoji: '🛍️',
    resolver: (y) => lastWeekdayOfMonth(y, 10, 5),
    whyImportant:
      'Data polêmica para estética — evitar parecer "loja de desconto". Mas bom momento para lançar cartão-presente antecipado do Natal, pacotes anuais e condição especial para fidelização.',
    actions: [
      'Cartão-presente com condição especial exclusiva do dia',
      'Pacote anual de manutenção (melhor custo-benefício)',
      'Condição para nova cliente + agendamento nos primeiros dias de dezembro',
    ],
    communication: [
      'Evite "Black Friday 70% off". Prefira "condição exclusiva desta sexta".',
      'Posicione como "ano todo por um valor especial" (pacote anual).',
    ],
    daysBefore: 14,
    preFill: {
      primaryText:
        'Uma condição especial só nesta sexta. Garanta seu pacote anual de manutenção com o melhor custo-benefício do ano. Quem decide hoje, leva o ano inteiro com a gente. Vagas limitadas.',
      headline: 'Uma condição exclusiva desta sexta',
    },
    suggestedBudget: {
      daily: 50,
      reason: 'Concorrência alta na Black Friday — R$ 50/dia necessário para manter alcance.',
    },
  },
  {
    id: 'natal',
    name: 'Natal',
    emoji: '🎄',
    resolver: (y) => fixedDate(y, 11, 25),
    whyImportant:
      'Pico de cartão-presente. Pessoas buscam presentes sofisticados e experiências. Cris Costa Beauty entra como presente "diferente" em relação ao óbvio.',
    actions: [
      'Cartão-presente com embalagem especial (físico ou digital)',
      'Pacote "kit ceia" — cabelo + maquiagem no dia 23 ou 24',
      'Campanha iniciada em 1º de dezembro com pré-venda',
    ],
    communication: [
      '"Presente que se cuida" — foco no cuidado, não no consumo.',
      'Urgência real: "entregamos cartão-presente digital até dia 24".',
    ],
    daysBefore: 25,
    preFill: {
      primaryText:
        'O presente que ela nunca compra pra si. Cartão-presente digital com entrega imediata — escolha o valor, nós cuidamos do resto. Experiência exclusiva Cris Costa Beauty.',
      headline: 'O presente que se cuida',
    },
    suggestedBudget: {
      daily: 55,
      reason: 'Concorrência muito alta no Natal. R$ 55/dia por 25 dias vale pela venda de cartão-presente.',
    },
  },
  {
    id: 'reveillon',
    name: 'Réveillon / Ano Novo',
    emoji: '🎆',
    resolver: (y) => fixedDate(y, 11, 31),
    whyImportant:
      'Dias 28, 29, 30 e 31 de dezembro são picos de procura: cabelo, maquiagem, skincare pré-festa. Agenda esgota rápido — anúncio precisa rodar com bastante antecedência.',
    actions: [
      'Agenda especial dias 28-31 com horários estendidos',
      'Pacote "prontas para o Réveillon" — cabelo + maquiagem + skincare',
      'Campanha com urgência real (agenda fechando)',
    ],
    communication: [
      'Urgência real pela agenda: "últimas vagas do ano".',
      'Foque no momento, não no valor.',
    ],
    daysBefore: 21,
    preFill: {
      primaryText:
        'As últimas vagas da nossa agenda de 2026 estão indo. Pacote completo para o Réveillon: cabelo, maquiagem e protocolo de pele para você chegar pronta na virada. Agende agora.',
      headline: 'Últimas vagas do ano',
    },
    suggestedBudget: {
      daily: 45,
      reason: 'Agenda esgota rápido — investimento maior para capturar antes dos concorrentes.',
    },
  },
];

/* ── Helpers públicos ── */

/**
 * Retorna todas as datas comerciais que caem entre `from` e `from + daysAhead` dias.
 * Cada resultado inclui `date` (Date), `key` (yyyy-mm-dd), `daysUntil` (número).
 */
export function getUpcomingCommercialDates(from, daysAhead = 30) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);

  const results = [];
  [start.getFullYear(), start.getFullYear() + 1].forEach((year) => {
    COMMERCIAL_DATES.forEach((entry) => {
      const date = entry.resolver(year);
      if (date >= start && date <= end) {
        const diffMs = date - start;
        const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const key = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        results.push({ ...entry, date, key, daysUntil, year });
      }
    });
  });

  return results.sort((a, b) => a.date - b.date);
}

/**
 * Retorna a entrada de data comercial que cai exatamente em `key` (yyyy-mm-dd), ou null.
 */
export function getCommercialDateByKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  for (const entry of COMMERCIAL_DATES) {
    const date = entry.resolver(y);
    if (date.getTime() === target.getTime()) {
      return { ...entry, date, key, year: y };
    }
  }
  return null;
}

/**
 * Janela em dias usada para alertar no sino e sugerir campanhas no calendário.
 * Todas as datas do dataset são curadas para o segmento Cris Costa Beauty,
 * portanto entram no alerta enquanto estiverem dentro desta janela.
 */
export const ALERT_WINDOW_DAYS = 45;

/**
 * Retorna as datas comerciais relevantes para Cris Costa Beauty em janela
 * de 45 dias a partir de `from`.
 */
export function getRelevantCommercialDatesInWindow(from = new Date(), daysAhead = ALERT_WINDOW_DAYS) {
  return getUpcomingCommercialDates(from, daysAhead);
}
