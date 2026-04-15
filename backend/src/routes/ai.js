const express = require('express');
const router = express.Router();
const fetch = globalThis.fetch ?? require('node-fetch');

const SYSTEM_PROMPT = `Você é um assistente especializado em tráfego pago para o estúdio de estética feminina Cris Costa Beauty.

Sobre a Cris Costa Beauty:
- Estúdio de estética feminina premium
- Serviços: sobrancelhas, cílios, skincare, maquiagem, tratamentos faciais
- Público-alvo: mulheres 25-45 anos, classes B/C, região de Joinville/SC
- Tom de voz: feminino, acolhedor, sofisticado mas acessível
- Cores da marca: vinho e rosé
- Instagram: @criscosta.beauty

Seu papel:
1. Criar textos curtos e persuasivos para anúncios de tráfego pago (Meta Ads, Google Ads)
2. Sugerir CTAs, headlines, descrições de criativos
3. Tirar dúvidas sobre o funcionamento do sistema AdManager
4. Orientar sobre estratégias de tráfego pago para estética feminina

Diretrizes para copy de tráfego pago:
- Máximo 150 caracteres para headlines
- Máximo 500 caracteres para descrições
- Use gatilhos: escassez, prova social, benefício imediato
- Linguagem direta e feminina
- Sempre foque na transformação/resultado

Responda sempre em português do Brasil.`;

// POST /api/ai/chat — proxy para Gemini ou ChatGPT
router.post('/chat', async (req, res) => {
  const { model, messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages obrigatório' });
  }

  try {
    if (model === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'Gemini API key não configurada no servidor' });

      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || `Gemini error ${response.status}`);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '(sem resposta)';
      return res.json({ reply: text });

    } else if (model === 'chatgpt') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'OpenAI API key não configurada no servidor' });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
          max_tokens: 800,
          temperature: 0.7,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || `OpenAI error ${response.status}`);
      const text = data.choices?.[0]?.message?.content || '(sem resposta)';
      return res.json({ reply: text });

    } else {
      return res.status(400).json({ error: 'model deve ser "gemini" ou "chatgpt"' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
