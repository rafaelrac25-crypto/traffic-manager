/**
 * Regras de correção para anúncios reprovados pelo Meta.
 *
 * Cada entrada mapeia um padrão do motivo (lowercase) para:
 *  - hint: sugestão de correção exibida ao usuário
 *  - step: índice do passo do wizard CreateAd que o usuário provavelmente errou
 *          (0: Objetivo · 1: Público · 2: Orçamento/data · 3: Criativo · 4: Revisão)
 *  - fields: chaves do formulário que devem ser destacadas como suspeitas
 */

export const REJECTION_RULES = [
  {
    match: 'políticas de anúncio',
    hint: 'Revise o texto e a imagem: evite promessas exageradas, linguagem sensacionalista e comparações.',
    step: 3,
    fields: ['primaryText', 'headline', 'mediaFiles'],
  },
  {
    match: 'conteúdo sensível',
    hint: 'Substitua imagens com pele excessivamente exposta ou procedimentos invasivos.',
    step: 3,
    fields: ['mediaFiles'],
  },
  {
    match: 'texto enganoso',
    hint: 'Seja claro sobre preço, prazo e resultado. Evite termos como "milagroso", "garantido" ou "instantâneo".',
    step: 3,
    fields: ['primaryText', 'headline'],
  },
  {
    match: 'antes e depois',
    hint: 'Imagens de antes/depois em estética são limitadas — use foto do procedimento ou resultado sutil.',
    step: 3,
    fields: ['mediaFiles'],
  },
  {
    match: 'direitos autorais',
    hint: 'Use apenas imagens próprias, licenciadas ou do seu portfólio.',
    step: 3,
    fields: ['mediaFiles'],
  },
  {
    match: 'qualidade baixa',
    hint: 'Use imagens em alta resolução, bem iluminadas e com o produto/serviço claro.',
    step: 3,
    fields: ['mediaFiles'],
  },
  {
    match: 'público',
    hint: 'Revise faixa etária, localização e interesses — o Meta não permite segmentar por características sensíveis.',
    step: 1,
    fields: ['ageRange', 'locations', 'interests'],
  },
  {
    match: 'destino',
    hint: 'A URL ou número de WhatsApp está inválido, quebrado ou não bate com o anúncio. Verifique o destino.',
    step: 3,
    fields: ['destUrl', 'ctaButton'],
  },
];

const DEFAULT_RULE = {
  hint: 'Revise texto, imagem e público-alvo conforme as políticas do Meta Ads.',
  step: 3,
  fields: [],
};

export function getRejectionInfo(reason = '') {
  const lower = String(reason).toLowerCase();
  const match = REJECTION_RULES.find(r => lower.includes(r.match));
  return match || DEFAULT_RULE;
}
