/**
 * Presets de interesses Meta pré-curados por serviço da Cris.
 *
 * **TODOS os termos abaixo foram VALIDADOS AO VIVO contra Meta API
 * (/api/platforms/meta/search-interests) em 2026-04-28.** A política
 * Meta de 15/jan/2026 removeu centenas de interesses granulares de
 * cosméticos/estética — os presets antigos ("Design de sobrancelhas",
 * "Maquiagem permanente" PT-BR, "Cuidados com a pele", "Estética facial",
 * "Procedimentos estéticos", etc.) NÃO existem mais no catálogo.
 *
 * Cada termo deve ser pesquisável via Meta /search?type=adinterest com
 * audience > 10M. Quando rodar audit pré-publicação, qualquer termo que
 * não retorne match será descartado silenciosamente.
 *
 * Manutenção: revalidar a lista a cada 90 dias OU quando Meta anunciar
 * mudança de política de targeting (changelog Marketing API).
 */

export const INTEREST_PRESETS = [
  {
    id: 'limpeza-pele',
    service: 'Limpeza de pele',
    emoji: '🧴',
    description: 'Ticket de entrada — público amplo interessado em skincare',
    interests: [
      'Skincare',         /* → "Cuidados com a pele (cosméticos)" 257M */
      'Cosmetics',        /* → "Cosméticos (cuidados pessoais)" 954M */
      'Beauty Shop',      /* → "Beauty Shop" 32M (comportamento de compra) */
    ],
  },
  {
    id: 'micropigmentacao-labial',
    service: 'Micropigmentação labial',
    emoji: '💋',
    description: 'Ticket alto — mulheres que investem em beleza duradoura',
    interests: [
      'Permanent makeup', /* → "Maquiagem permanente" 35M */
      'Cosmetics',        /* → "Cosméticos" 954M */
      'Beauty Shop',      /* → "Beauty Shop" 32M */
    ],
  },
  {
    id: 'nanopigmentacao-sobrancelhas',
    service: 'Nanopigmentação de sobrancelhas',
    emoji: '🪄',
    description: 'Ticket alto — concentrado em quem já entende valor de pigmentação (sem Eyebrow amplo)',
    interests: [
      'Microblading',     /* → "Microblading" 22M (técnica irmã, intent alto) */
      'Permanent makeup', /* → "Maquiagem permanente" 35M (categoria irmã) */
      'Beauty Shop',      /* → "Beauty Shop" 32M (comportamento de COMPRA, não só consumo de conteúdo) */
    ],
  },
  {
    id: 'brow-lamination',
    service: 'Brow lamination',
    emoji: '✨',
    description: 'Ticket médio — tendência de sobrancelhas naturais volumosas',
    interests: [
      'Eyebrow',          /* → "Sobrancelha" 80M */
      'Microblading',     /* → "Microblading" 22M */
      'Beauty Shop',      /* → "Beauty Shop" 32M */
    ],
  },
  {
    id: 'lash-lifting',
    service: 'Lash lifting',
    emoji: '👁️',
    description: 'Ticket de entrada/médio — alta conversão, volume alto',
    interests: [
      'Eyelashes',        /* → "Extensão de cílios (cosméticos)" 26M */
      'Cosmetics',        /* → "Cosméticos" 954M */
      'Beauty Shop',      /* → "Beauty Shop" 32M */
    ],
  },
];

/* Helper: retorna preset por ID. */
export function getInterestPreset(id) {
  return INTEREST_PRESETS.find(p => p.id === id) || null;
}
