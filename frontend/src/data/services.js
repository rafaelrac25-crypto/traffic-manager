/**
 * Serviços/procedimentos da Cris Costa Beauty.
 * Fonte oficial enviada pelo Rafa em 2026-04-20.
 *
 * Cada serviço tem:
 *   - id: chave estável pra referenciar em ads, relatórios e filtros
 *   - label: nome em PT-BR usado na UI
 *   - category: grupo (sobrancelhas, labios, cilios, pele, etc)
 *   - tier: faixa de ticket (alto/medio-alto/medio/entry) — referencia para
 *           orçamento sugerido, perfil de público e ciclo de recompra
 *   - ticketRange: faixa de preço estimada em R$ (ilustrativa)
 *   - interests: interesses do Meta Ads alinhados ao procedimento
 *   - keywords: termos pra busca/chat bot
 *   - synonyms: variações comuns do nome (para matching em texto livre)
 *
 * Use `SERVICES` pra UI/relatórios e `getService(id)` pra lookup.
 * Compatível com o trigger da feature "recomendação por bairro × serviço".
 */

export const SERVICES = [
  {
    id: 'micro-sobrancelha',
    label: 'Micropigmentação de sobrancelhas',
    category: 'sobrancelhas',
    tier: 'alto',
    ticketRange: { min: 450, max: 900 },
    durationMin: 120,
    interests: ['Sobrancelhas', 'Maquiagem permanente', 'Beleza e cosméticos', 'Cuidados com a pele'],
    keywords: ['micro sobrancelha', 'micropigmentação', 'sobrancelha definida', 'design permanente'],
    synonyms: ['microblading', 'sobrancelha fio a fio', 'micro de sobrancelha'],
  },
  {
    id: 'revitalizacao-labial',
    label: 'Revitalização labial',
    category: 'labios',
    tier: 'alto',
    ticketRange: { min: 500, max: 900 },
    durationMin: 120,
    interests: ['Lábios', 'Maquiagem permanente', 'Autoestima', 'Beleza e cosméticos'],
    keywords: ['glow lips', 'lábio aquarelado', 'revitalização', 'lábio pigmentado', 'BB lips'],
    synonyms: ['glow lip', 'aquarelado labial', 'BB lip', 'micropigmentação labial'],
  },
  {
    id: 'micro-capilar',
    label: 'Micropigmentação capilar',
    category: 'cabelo',
    tier: 'alto',
    ticketRange: { min: 700, max: 1500 },
    durationMin: 180,
    interests: ['Cabelo e penteados', 'Autoestima', 'Beleza masculina', 'Cuidados pessoais'],
    keywords: ['tricopigmentação', 'micro capilar', 'calvície', 'careca disfarce'],
    synonyms: ['tricopigmentação', 'micro no couro cabeludo', 'SMP'],
  },
  {
    id: 'design-sobrancelha',
    label: 'Design de sobrancelhas',
    category: 'sobrancelhas',
    tier: 'entry',
    ticketRange: { min: 40, max: 80 },
    durationMin: 30,
    interests: ['Sobrancelhas', 'Cuidados com a pele', 'Maquiagem'],
    keywords: ['design sobrancelha', 'modelar sobrancelha', 'depilação de sobrancelha'],
    synonyms: ['desing de sobrancelhas', 'design de sobrancelha'],
  },
  {
    id: 'design-sobrancelha-tintura',
    label: 'Design de sobrancelhas com tintura/henna',
    category: 'sobrancelhas',
    tier: 'medio',
    ticketRange: { min: 60, max: 120 },
    durationMin: 45,
    interests: ['Sobrancelhas', 'Henna', 'Maquiagem', 'Beleza natural'],
    keywords: ['henna sobrancelha', 'tintura sobrancelha', 'design + henna'],
    synonyms: ['henna', 'tintura de sobrancelha', 'design com henna'],
  },
  {
    id: 'brow-lamination',
    label: 'Brow lamination',
    category: 'sobrancelhas',
    tier: 'medio',
    ticketRange: { min: 150, max: 280 },
    durationMin: 60,
    interests: ['Sobrancelhas', 'Brow lamination', 'Maquiagem', 'Autocuidado'],
    keywords: ['brow lamination', 'alinhamento de sobrancelha', 'brow lift'],
    synonyms: ['lamination', 'alinhamento de sobrancelha', 'brow lift'],
  },
  {
    id: 'lash-lifting',
    label: 'Lash lifting',
    category: 'cilios',
    tier: 'medio',
    ticketRange: { min: 120, max: 220 },
    durationMin: 60,
    interests: ['Cílios', 'Lash lifting', 'Maquiagem', 'Beleza feminina'],
    keywords: ['lash lifting', 'permanente de cílios', 'curvatura de cílios'],
    synonyms: ['permanente de cílio', 'elevação de cílios'],
  },
  {
    id: 'extensao-cilios',
    label: 'Extensão de cílios',
    category: 'cilios',
    tier: 'medio-alto',
    ticketRange: { min: 180, max: 380 },
    durationMin: 120,
    interests: ['Extensão de cílios', 'Cílios', 'Maquiagem', 'Beleza feminina'],
    keywords: ['extensão de cílios', 'alongamento de cílios', 'volume russo', 'fio a fio'],
    synonyms: ['alongamento', 'cílios postiços fixos', 'volume brasileiro'],
  },
  {
    id: 'limpeza-de-pele',
    label: 'Limpeza de pele',
    category: 'pele',
    tier: 'medio',
    ticketRange: { min: 150, max: 320 },
    durationMin: 60,
    interests: ['Cuidados com a pele', 'Skincare', 'Limpeza de pele', 'Autocuidado'],
    keywords: ['limpeza de pele', 'extração', 'cravos', 'pele oleosa'],
    synonyms: ['extração', 'limpeza facial', 'higienização facial'],
  },
  {
    id: 'microagulhamento-facial',
    label: 'Microagulhamento facial',
    category: 'pele',
    tier: 'medio-alto',
    ticketRange: { min: 200, max: 500 },
    durationMin: 60,
    interests: ['Cuidados com a pele', 'Anti-idade', 'Dermatologia estética', 'Skincare'],
    keywords: ['microagulhamento', 'dermaroller', 'colágeno', 'cicatriz de acne'],
    synonyms: ['dermaroller', 'microneedling', 'micro facial'],
  },
  {
    id: 'peeling',
    label: 'Peeling',
    category: 'pele',
    tier: 'medio-alto',
    ticketRange: { min: 180, max: 450 },
    durationMin: 60,
    interests: ['Cuidados com a pele', 'Dermatologia estética', 'Anti-idade', 'Skincare'],
    keywords: ['peeling', 'renovação celular', 'manchas', 'melasma'],
    synonyms: ['peeling químico', 'peeling de diamante', 'peeling facial'],
  },
  {
    id: 'crescimento-fortalecimento',
    label: 'Protocolo crescimento e fortalecimento',
    category: 'cabelo',
    tier: 'medio-alto',
    ticketRange: { min: 200, max: 500 },
    durationMin: 60,
    targets: ['sobrancelhas', 'barba', 'cabelo'],
    interests: ['Cabelo e penteados', 'Barba', 'Sobrancelhas', 'Tratamentos capilares'],
    keywords: ['crescimento', 'fortalecimento', 'alopecia', 'queda'],
    synonyms: ['protocolo capilar', 'crescimento de barba', 'fortalecimento de fio'],
  },
  {
    id: 'despigmentacao-quimica',
    label: 'Despigmentação química',
    category: 'correcao',
    tier: 'alto',
    ticketRange: { min: 300, max: 700 },
    durationMin: 90,
    interests: ['Correção de micropigmentação', 'Beleza e cosméticos'],
    keywords: ['despigmentação', 'remoção', 'correção', 'clareamento de pigmento'],
    synonyms: ['remoção de micro', 'apagar sobrancelha', 'despigmentar'],
  },
];

/** Lookup por id */
export function getService(id) {
  if (!id) return null;
  return SERVICES.find((s) => s.id === id) || null;
}

/** Retorna serviços de uma categoria */
export function getServicesByCategory(category) {
  return SERVICES.filter((s) => s.category === category);
}

/** Todos os interesses únicos (para sugestão no Meta Ads targeting) */
export function allServiceInterests() {
  const set = new Set();
  SERVICES.forEach((s) => (s.interests || []).forEach((i) => set.add(i)));
  return [...set].sort();
}

/** Todas as categorias presentes */
export const SERVICE_CATEGORIES = [...new Set(SERVICES.map((s) => s.category))];

/**
 * Dado um texto livre (nome do anúncio, texto do criativo etc), tenta inferir
 * qual serviço está sendo anunciado. Retorna o serviço ou null.
 */
export function inferServiceFromText(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  for (const s of SERVICES) {
    if (t.includes(s.label.toLowerCase())) return s;
    for (const kw of s.keywords || []) {
      if (t.includes(kw.toLowerCase())) return s;
    }
    for (const syn of s.synonyms || []) {
      if (t.includes(syn.toLowerCase())) return s;
    }
  }
  return null;
}

/** Texto resumido dos serviços — usado como contexto para o chat IA/Grok */
export function servicesContextForAI() {
  const lines = SERVICES.map((s) => {
    const ticket = `R$\u00A0${s.ticketRange.min}-${s.ticketRange.max}`;
    const targets = s.targets ? ` (aplica em: ${s.targets.join(', ')})` : '';
    return `- ${s.label}${targets} · ${ticket} · duração ${s.durationMin}min · tier ${s.tier}`;
  });
  return [
    'Serviços oferecidos pela Cris Costa Beauty (Joinville/SC):',
    ...lines,
    '',
    'Use esses nomes oficiais ao sugerir textos, criativos, ofertas ou públicos.',
    'Tickets são ilustrativos — pergunte à Cris pra confirmar preços atuais.',
  ].join('\n');
}
