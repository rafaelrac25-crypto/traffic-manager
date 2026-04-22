/**
 * Presets de interesses e comportamentos Meta pré-curados por serviço da Cris.
 *
 * Cada grupo tem 3 termos NOMEADOS (não IDs). O backend resolve cada nome no
 * Ad Interest Library do Meta via /search antes de publicar — se encontrar
 * um match oficial, substitui; se não, descarta o item.
 *
 * Escolha dos termos: mix de amplo (volume) + intenção (qualidade) + sinal
 * de comportamento (compra de produto/serviço relacionado). Evita termos
 * genéricos demais ('Moda') e específicos demais que Meta quase não
 * rotula ('Micropigmentação labial como interesse').
 */

export const INTEREST_PRESETS = [
  {
    id: 'limpeza-pele',
    service: 'Limpeza de pele',
    emoji: '🧴',
    description: 'Ticket de entrada — público amplo interessado em skincare',
    interests: [
      'Cuidados com a pele',
      'Cosméticos',
      'Dermatologia',
    ],
  },
  {
    id: 'micropigmentacao-labial',
    service: 'Micropigmentação labial',
    emoji: '💋',
    description: 'Ticket alto — mulheres que investem em beleza duradoura',
    interests: [
      'Maquiagem',
      'Cuidados com os lábios',
      'Procedimentos estéticos',
    ],
  },
  {
    id: 'nanopigmentacao-sobrancelhas',
    service: 'Nanopigmentação de sobrancelhas',
    emoji: '🪄',
    description: 'Ticket alto — público que valoriza design de sobrancelhas',
    interests: [
      'Design de sobrancelhas',
      'Maquiagem permanente',
      'Estética facial',
    ],
  },
  {
    id: 'brow-lamination',
    service: 'Brow lamination',
    emoji: '✨',
    description: 'Ticket médio — tendência de sobrancelhas naturais volumosas',
    interests: [
      'Design de sobrancelhas',
      'Beleza',
      'Henna para sobrancelhas',
    ],
  },
  {
    id: 'lash-lifting',
    service: 'Lash lifting',
    emoji: '👁️',
    description: 'Ticket de entrada/médio — alta conversão, volume alto',
    interests: [
      'Extensão de cílios',
      'Maquiagem',
      'Cuidados com os olhos',
    ],
  },
];

/* Helper: retorna preset por ID. */
export function getInterestPreset(id) {
  return INTEREST_PRESETS.find(p => p.id === id) || null;
}
