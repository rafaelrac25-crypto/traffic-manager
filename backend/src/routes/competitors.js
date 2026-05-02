const express = require('express');
const router = express.Router();
const pool = require('../db');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const TEXT_MODEL = 'llama-3.3-70b-versatile';

const VISION_PROMPT = `Você é analista de tráfego pago. Descreva o anúncio (imagem ou print) de forma estruturada, em português do Brasil.

Retorne APENAS texto corrido (sem markdown), cobrindo:
- Tipo de criativo (foto de cliente, antes/depois, infográfico, depoimento, vídeo, etc.)
- Elementos visuais principais (pessoas, produto, ambiente, cores dominantes)
- Texto sobreposto / copy visível (transcreva literalmente)
- Tom da imagem (aspiracional, urgência, prova social, transformação)
- CTA aparente (botão, frase de ação)
- Possível ângulo de venda (preço baixo, autoridade, exclusividade, resultado rápido, etc.)

Seja específico. Evite generalidades. 4–6 frases.`;

const AGGREGATOR_PROMPT = `Você é um analista sênior de tráfego pago. Recebe descrições de anúncios e copies de UM concorrente do nicho de estética/beleza, e devolve um relatório estruturado em JSON estrito.

Estrutura obrigatória do JSON de saída:
{
  "summary": "string — 2-3 frases sobre estratégia geral do concorrente",
  "patterns": ["string", ...],
  "hooks": ["string", ...],
  "ctas": ["string", ...],
  "creative_formats": ["string", ...],
  "recommendations": ["string", ...]
}

Regras:
- "patterns": padrões repetidos (cores, mensagens, estrutura, gancho típico). 3-6 itens.
- "hooks": ganchos/headlines vencedores que ele usa. 3-6 itens, cite literalmente quando possível.
- "ctas": CTAs observados. Lista enxuta.
- "creative_formats": formatos detectados (carrossel antes/depois, vídeo de procedimento, prova social, oferta com preço, etc).
- "recommendations": 3-5 recomendações acionáveis para Cris Costa Beauty (estúdio de estética em Joinville/SC) baseadas no que o concorrente faz bem. Diretas, sem rodeios.
- Se houver poucos dados, marque "summary" com aviso ("amostra pequena, leitura preliminar").
- Português do Brasil. Sem markdown. APENAS o JSON.`;

async function groqCall(model, messages, opts = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada no servidor');

  const body = {
    model,
    messages,
    max_tokens: opts.max_tokens || 800,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.json_mode) body.response_format = { type: 'json_object' };

  const r = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Groq ${r.status}`);
  return data.choices?.[0]?.message?.content || '';
}

/* POST /api/competitors/describe-item
   Recebe 1 item (imagem base64 ou texto puro) e devolve descrição do criativo.
   Frontend dispara em paralelo um call por item — assim cada request fica
   pequeno e não estoura timeout serverless. */
router.post('/describe-item', async (req, res) => {
  try {
    const { type, data, label } = req.body || {};
    if (!type || !data) return res.status(400).json({ error: 'type e data obrigatórios' });

    if (type === 'text') {
      /* Texto colado da Ads Library: já é "descrição". Devolve direto. */
      return res.json({ description: String(data).slice(0, 4000) });
    }

    if (type === 'image') {
      /* base64 ou data URL — normaliza pra data URL */
      const dataUrl = data.startsWith('data:')
        ? data
        : `data:image/jpeg;base64,${data}`;

      const description = await groqCall(VISION_MODEL, [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT + (label ? `\n\nLabel do item: ${label}` : '') },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ], { max_tokens: 500 });

      return res.json({ description });
    }

    return res.status(400).json({ error: `type "${type}" não suportado (use image ou text)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/competitors/analyze
   Recebe nome, URL e descrições já produzidas (via /describe-item).
   Roda agregação Groq → JSON estruturado → salva no DB. */
router.post('/analyze', async (req, res) => {
  try {
    const { name, source_url, items, descriptions } = req.body || {};
    if (!name || !Array.isArray(descriptions) || descriptions.length === 0) {
      return res.status(400).json({ error: 'name e descriptions[] obrigatórios' });
    }

    const blob = descriptions
      .map((d, i) => `[ITEM ${i + 1}]\n${d}`)
      .join('\n\n');

    const userPrompt = `Concorrente: ${name}
${source_url ? `Fonte: ${source_url}\n` : ''}
Descrições dos anúncios coletados:

${blob}

Gere o JSON conforme estrutura.`;

    const raw = await groqCall(TEXT_MODEL, [
      { role: 'system', content: AGGREGATOR_PROMPT },
      { role: 'user', content: userPrompt },
    ], { json_mode: true, max_tokens: 1400, temperature: 0.5 });

    let insights;
    try {
      insights = JSON.parse(raw);
    } catch {
      /* fallback — Groq devolveu algo fora do JSON */
      insights = { summary: 'Falha ao parsear JSON do agregador', patterns: [], hooks: [], ctas: [], creative_formats: [], recommendations: [], _raw: raw };
    }

    const result = await pool.query(
      `INSERT INTO competitor_analyses (name, source_url, items, descriptions, insights)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        name,
        source_url || null,
        JSON.stringify(items || []),
        JSON.stringify(descriptions),
        JSON.stringify(insights),
      ]
    );

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      source_url: row.source_url,
      created_at: row.created_at,
      insights,
      items_count: (items || []).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/competitors — lista análises (sem payload pesado) */
router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, source_url, insights, created_at
       FROM competitor_analyses ORDER BY created_at DESC LIMIT 50`
    );
    const list = r.rows.map(row => {
      let insights = {};
      try { insights = typeof row.insights === 'string' ? JSON.parse(row.insights) : (row.insights || {}); } catch {}
      return {
        id: row.id,
        name: row.name,
        source_url: row.source_url,
        created_at: row.created_at,
        summary: insights.summary || '',
      };
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/competitors/:id — detalhe completo */
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM competitor_analyses WHERE id = $1`,
      [req.params.id]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'não encontrado' });

    const parse = (v) => {
      if (!v) return null;
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch { return v; }
    };

    res.json({
      id: row.id,
      name: row.name,
      source_url: row.source_url,
      created_at: row.created_at,
      items: parse(row.items),
      descriptions: parse(row.descriptions),
      insights: parse(row.insights),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/competitors/:id */
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(`DELETE FROM competitor_analyses WHERE id = $1`, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
