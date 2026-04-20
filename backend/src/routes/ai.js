const express = require('express');
const router = express.Router();

const SYSTEM_PROMPT = `Você é um assistente de tráfego pago e criação de conteúdo da Cris Costa Beauty (@criscosta.beauty), estúdio de estética feminina em Joinville/SC.

MARCA
- Público: mulheres 25–45 anos, classes B/C, beleza natural e sofisticada
- Tom: direto, feminino, acolhedor — resultado em evidência, sem pompa

SERVIÇOS OFICIAIS (use estes nomes exatos em copy e sugestões):
- Micropigmentação de sobrancelhas (tier alto · R$\u00A0450-900 · 120min)
- Revitalização labial / BB lips / glow lips (tier alto · R$\u00A0500-900 · 120min)
- Micropigmentação capilar / tricopigmentação (tier alto · R$\u00A0700-1500 · 180min)
- Design de sobrancelhas (entry · R$\u00A040-80 · 30min)
- Design de sobrancelhas com tintura ou henna (médio · R$\u00A060-120 · 45min)
- Brow lamination / alinhamento de sobrancelha (médio · R$\u00A0150-280 · 60min)
- Lash lifting / permanente de cílios (médio · R$\u00A0120-220 · 60min)
- Extensão de cílios — fio a fio, volume brasileiro, volume russo (médio-alto · R$\u00A0180-380 · 120min)
- Limpeza de pele (médio · R$\u00A0150-320 · 60min)
- Microagulhamento facial / dermaroller (médio-alto · R$\u00A0200-500 · 60min)
- Peeling químico ou de diamante (médio-alto · R$\u00A0180-450 · 60min)
- Protocolo crescimento e fortalecimento (sobrancelhas, barba, cabelo) (médio-alto · R$\u00A0200-500 · 60min)
- Despigmentação química / remoção de micropigmentação (alto · R$\u00A0300-700 · 90min)

COPY (quando criar textos)
- Gancho curto → descrição do resultado (2–3 linhas) → CTA → hashtags
- Headlines: até 150 caracteres. Descrições de anúncio: até 500.
- Emojis do nicho: ✨ 🌸 💆‍♀️ 🪞 👁️ 💄 🤍 💅 📲
- Hashtags: #designdesobrancelhas #sobrancelhas #micropigmentacao #limpezadepele #esteticafeminina #joinville #criscostabeleza #skincare #transformacao
- Foco sempre na transformação, não no serviço em si

COMO SE COMPORTAR
- Respostas curtas e diretas. Sem introduções do tipo "Claro!", "Com certeza!", "Ótima pergunta!".
- Não repita o que o usuário disse antes de responder.
- Adapte o tom conforme a conversa: se a pessoa for objetiva, seja objetivo; se quiser mais detalhes, desenvolva.
- Aprenda com o histórico: se o usuário corrigiu ou preferiu algo diferente, aplique isso nas próximas respostas.
- Se receber uma imagem, descreva o que viu e use como referência para o texto pedido.
- Para dúvidas sobre o sistema AdManager, responda com base no contexto de gestão de campanhas Meta Ads / Google Ads.

Responda sempre em português do Brasil.`;

// POST /api/ai/chat — proxy para Groq
// Cada mensagem pode ter { role, content, imageBase64 }
// Se qualquer mensagem tiver imagem usa llama-4-scout (vision); senão llama-3.3-70b
router.post('/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages obrigatório' });
  }

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'GROQ_API_KEY não configurada no servidor' });

    const hasImage = messages.some(m => m.imageBase64);
    const model = hasImage ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';

    // Monta o histórico completo para o Groq, incluindo imagens de mensagens anteriores
    const groqMessages = messages.map(m => {
      if (m.imageBase64) {
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: [
            ...(m.content ? [{ type: 'text', text: m.content }] : []),
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.imageBase64}` } },
          ],
        };
      }
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
    });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...groqMessages,
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Groq error ${response.status}`);
    const text = data.choices?.[0]?.message?.content || '(sem resposta)';
    return res.json({ reply: text });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
