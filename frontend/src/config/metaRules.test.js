/**
 * Tests pros caminhos críticos de regras Meta. Cobre:
 * - autoRingsCount: heurística de classificação automática
 * - classifyRings: distribuição de bairros em anéis
 * - toMetaBudgetCents: conversão R$ → centavos
 * - Estabilidade dos mapas Meta v20 (não regressão silenciosa)
 *
 * Esses tests rodam no `npm test` e protegem contra mudança acidental
 * em `metaRules.js` ou `metaNormalize.js` que quebre o pacto com a Meta API.
 */

import { describe, it, expect } from 'vitest';
import {
  autoRingsCount,
  classifyRings,
  toMetaBudgetCents,
  OBJECTIVE_TO_META,
  CTA_TO_META,
  MIN_DAILY_PER_RING_BRL,
  GENDER_TO_META,
  CTA_TO_DESTINATION,
  MESSAGING_CTAS,
} from './metaRules';

describe('autoRingsCount — heurística conservadora', () => {
  it('retorna 1 anel quando count <= 2', () => {
    expect(autoRingsCount(1, 10)).toBe(1);
    expect(autoRingsCount(2, 50)).toBe(1);
  });

  it('retorna 1 anel quando spread <= 3km (mesmo com muitos bairros)', () => {
    expect(autoRingsCount(20, 2)).toBe(1);
    expect(autoRingsCount(20, 3)).toBe(1);
  });

  it('retorna 3 anéis APENAS com count >= 8 E spread >= 6km', () => {
    expect(autoRingsCount(8, 6)).toBe(3);
    expect(autoRingsCount(20, 50)).toBe(3);
  });

  it('NÃO retorna 3 anéis quando só uma condição bate', () => {
    expect(autoRingsCount(8, 5)).toBe(2); /* spread baixo */
    expect(autoRingsCount(7, 6)).toBe(2); /* count baixo */
  });

  it('retorna 2 anéis no caso geral (entre extremos)', () => {
    expect(autoRingsCount(5, 5)).toBe(2);
    expect(autoRingsCount(6, 4)).toBe(2);
    expect(autoRingsCount(3, 4)).toBe(2);
  });
});

describe('classifyRings — distribuição de bairros', () => {
  /* Localizações fictícias em torno de Joinville (HOME_COORDS) */
  const home = { lat: -26.30, lng: -48.85 }; /* Centro Joinville (aprox) */
  const close = { lat: -26.30, lng: -48.85, name: 'Bairro A', radius: 3 };
  const far = { lat: -26.10, lng: -48.85, name: 'Bairro B', radius: 5 }; /* ~22km */

  it('retorna buckets vazios quando não há localizações', () => {
    const r = classifyRings([], 'auto');
    expect(r).toEqual({ primario: [], medio: [], externo: [] });
  });

  it('força 1 anel quando ringsMode = "1"', () => {
    const locs = [close, { ...far, name: 'X1' }, { ...far, name: 'X2' }];
    const r = classifyRings(locs, '1');
    expect(r.primario.length).toBe(3);
    expect(r.medio).toEqual([]);
    expect(r.externo).toEqual([]);
  });

  it('1 anel quando 1 bairro só (auto)', () => {
    const r = classifyRings([close], 'auto');
    expect(r.primario.length).toBe(1);
    expect(r.medio).toEqual([]);
  });

  it('dedupe por nome — mesmo bairro 2x vira 1', () => {
    const dup = { ...close, name: 'Bairro A' };
    const r = classifyRings([close, dup], '1');
    expect(r.primario.length).toBe(1);
  });

  it('respeita ringsMode "3" mesmo com poucos bairros (cap em valid.length)', () => {
    const r = classifyRings([close, far], '3');
    /* Math.min(3, 2) = 2 anéis */
    expect(r.primario.length + r.medio.length + r.externo.length).toBe(2);
  });

  it('ringsMode === false (legado) força 1 anel', () => {
    const r = classifyRings([close, far], false);
    expect(r.primario.length).toBe(2);
    expect(r.medio).toEqual([]);
  });
});

describe('toMetaBudgetCents — conversão BRL → centavos', () => {
  it('R$15 → 1500 cents', () => {
    expect(toMetaBudgetCents(15)).toBe(1500);
  });

  it('R$15.50 → 1550 cents', () => {
    expect(toMetaBudgetCents(15.50)).toBe(1550);
  });

  it('arredonda corretamente (não trunca)', () => {
    expect(toMetaBudgetCents(15.555)).toBe(1556);
    expect(toMetaBudgetCents(15.554)).toBe(1555);
  });

  it('retorna 0 pra entrada inválida', () => {
    expect(toMetaBudgetCents(0)).toBe(0);
    expect(toMetaBudgetCents(-5)).toBe(0);
    expect(toMetaBudgetCents('abc')).toBe(0);
    expect(toMetaBudgetCents(null)).toBe(0);
    expect(toMetaBudgetCents(undefined)).toBe(0);
  });

  it('aceita string numérica', () => {
    expect(toMetaBudgetCents('15')).toBe(1500);
    expect(toMetaBudgetCents('15.50')).toBe(1550);
  });
});

describe('Mapas Meta v20 — estabilidade contratual', () => {
  it('OBJECTIVE_TO_META: todos os 9 objetivos locais mapeados', () => {
    const required = [
      'brand_awareness', 'reach', 'traffic', 'engagement', 'leads',
      'messages', 'app_installs', 'sales', 'store_traffic',
    ];
    required.forEach(k => {
      expect(OBJECTIVE_TO_META[k]).toBeDefined();
      expect(OBJECTIVE_TO_META[k]).toMatch(/^OUTCOME_/);
    });
  });

  it('messages mapeia pra OUTCOME_ENGAGEMENT (Meta v20 ODAX)', () => {
    expect(OBJECTIVE_TO_META.messages).toBe('OUTCOME_ENGAGEMENT');
  });

  it('CTA_TO_META: cobre os CTAs principais que Cris usa', () => {
    expect(CTA_TO_META['WhatsApp']).toBe('WHATSAPP_MESSAGE');
    expect(CTA_TO_META['Enviar mensagem']).toBe('MESSAGE_PAGE');
    expect(CTA_TO_META['Saiba mais']).toBe('LEARN_MORE');
  });

  it('CTA_TO_DESTINATION: WhatsApp → WHATSAPP, Mensagem → INSTAGRAM_DIRECT', () => {
    expect(CTA_TO_DESTINATION.WHATSAPP_MESSAGE).toBe('WHATSAPP');
    expect(CTA_TO_DESTINATION.MESSAGE_PAGE).toBe('INSTAGRAM_DIRECT');
    expect(CTA_TO_DESTINATION.CALL_NOW).toBe('PHONE_CALL');
  });

  it('MESSAGING_CTAS contém todos os 4 CTAs de mensageria', () => {
    expect(MESSAGING_CTAS).toContain('WHATSAPP_MESSAGE');
    expect(MESSAGING_CTAS).toContain('MESSAGE_PAGE');
    expect(MESSAGING_CTAS).toContain('CALL_NOW');
    expect(MESSAGING_CTAS).toContain('SEND_MESSAGE');
  });

  it('GENDER_TO_META: female=[1], male=[2], all=[]', () => {
    expect(GENDER_TO_META.female).toEqual([1]);
    expect(GENDER_TO_META.male).toEqual([2]);
    expect(GENDER_TO_META.all).toEqual([]);
  });

  it('MIN_DAILY_PER_RING_BRL = 7 (regra Meta + folga 15%)', () => {
    expect(MIN_DAILY_PER_RING_BRL).toBe(7);
  });
});
