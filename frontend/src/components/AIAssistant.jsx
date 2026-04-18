import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';

const RobotIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <line x1="12" y1="1.5" x2="12" y2="5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="12" cy="1.5" r="1.3" fill="white"/>
    <rect x="3" y="5" width="18" height="13" rx="3" fill="white"/>
    <circle cx="9" cy="11" r="2" fill="#d68d8f"/>
    <circle cx="15" cy="11" r="2" fill="#d68d8f"/>
    <rect x="7.5" y="14.2" width="9" height="1.5" rx="0.75" fill="#d68d8f"/>
  </svg>
);

const QUICK_PROMPTS = [
  'Crie um texto para anúncio de design de sobrancelhas',
  'Headline para promoção de limpeza de pele',
  'CTA para stories de alongamento de cílios',
  'Como funciona o sistema de agendamento?',
  'Texto para anúncio de pacote de estética completa',
];

// Garante imagem ≤ 2MB binário (~2.7MB base64) — limite Groq é 4MB base64
// Testa passos do mais leve ao mais agressivo; usa o blob real para medir
const COMPRESS_STEPS = [
  { dim: 1024, quality: 0.82 },
  { dim: 800,  quality: 0.72 },
  { dim: 640,  quality: 0.62 },
  { dim: 480,  quality: 0.52 },
  { dim: 320,  quality: 0.40 },
];
const MAX_BLOB_BYTES = 2 * 1024 * 1024; // 2MB

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      function runStep(i) {
        const { dim, quality } = COMPRESS_STEPS[Math.min(i, COMPRESS_STEPS.length - 1)];
        let { width, height } = img;
        if (width > dim || height > dim) {
          if (width > height) { height = Math.round(height * dim / width); width = dim; }
          else { width = Math.round(width * dim / height); height = dim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          // Dentro do limite ou chegamos ao passo final: resolve
          if (blob.size <= MAX_BLOB_BYTES || i >= COMPRESS_STEPS.length - 1) {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          } else {
            runStep(i + 1); // ainda grande: próximo passo
          }
        }, 'image/jpeg', quality);
      }

      runStep(0);
    };
    img.src = url;
  });
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageBase64, setImageBase64] = useState(null); // dataURL já comprimida
  const [imagePreview, setImagePreview] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Escuta o evento "ai-ask" disparado pela busca do topbar
  useEffect(() => {
    function handleAsk(e) {
      const text = e.detail?.text?.trim();
      if (!text) return;
      setOpen(true);
      setTimeout(() => send(text), 250);
    }
    window.addEventListener('ai-ask', handleAsk);
    return () => window.removeEventListener('ai-ask', handleAsk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, imagePreview, imageBase64, loading]);

  async function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImage(file); // comprime para max 800px JPEG 75%
    setImageBase64(dataUrl);
    setImagePreview(dataUrl);
    e.target.value = '';
  }

  function removeImage() {
    setImageBase64(null);
    setImagePreview(null);
  }

  async function send(text) {
    const msg = text || input.trim();
    if ((!msg && !imagePreview) || loading) return;

    // Guarda o base64 puro (sem prefixo data:) dentro da própria mensagem
    // para que o histórico completo — incluindo imagens anteriores — seja
    // enviado ao modelo em cada requisição
    const userMessage = {
      role: 'user',
      content: msg || '',
      ...(imagePreview && { imagePreview }),
      ...(imageBase64 && { imageBase64: imageBase64.split(',')[1] }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setImageBase64(null);
    setImagePreview(null);
    setLoading(true);

    try {
      const res = await api.post('/api/ai/chat', {
        // Envia cada mensagem com seu imageBase64 quando houver
        messages: newMessages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.imageBase64 && { imageBase64: m.imageBase64 }),
        })),
      });
      setMessages(m => [...m, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Erro ao conectar com a IA';
      setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${errMsg}`, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  const canSend = (input.trim() || imagePreview) && !loading;

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Assistente IA"
        style={{
          position: 'fixed', bottom: '28px', right: '28px', zIndex: 500,
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #d68d8f, #7D4A5E)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(214,141,143,.4)',
          transition: 'transform .2s',
          transform: open ? 'scale(0.92)' : 'scale(1)',
        }}
      >
        <RobotIcon size={26} />
      </button>

      {/* Painel do chat */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '92px', right: '28px', zIndex: 499,
          width: '360px', height: '520px',
          background: 'var(--c-card-bg)',
          borderRadius: '20px',
          border: '1px solid var(--c-border)',
          boxShadow: '0 8px 40px rgba(0,0,0,.18)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideIn .2s ease',
        }}>

          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-border)', background: 'linear-gradient(135deg, #d68d8f 0%, #7D4A5E 100%)', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RobotIcon size={20} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>Assistente IA</div>
                  <div style={{ fontSize: '10px', opacity: .8 }}>Cris Costa Beauty</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                title="Fechar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '20px', lineHeight: 1, padding: '2px 4px', opacity: .8 }}
              >×</button>
            </div>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

            {messages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                  <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #d68d8f, #7D4A5E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <RobotIcon size={28} />
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-2)', marginBottom: '3px' }}>Como posso ajudar?</div>
                  <div style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>Crie textos, anexe referências visuais ou tire dúvidas sobre o sistema</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {QUICK_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => send(p)}
                      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '10px', padding: '7px 10px', fontSize: '11px', color: 'var(--c-text-2)', cursor: 'pointer', textAlign: 'left', transition: 'all .15s', fontFamily: 'Inter, sans-serif' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.color = 'var(--c-accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-2)'; }}
                    >{p}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '9px 12px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? 'linear-gradient(135deg, #d68d8f, #7D4A5E)' : m.error ? '#FDEAED' : 'var(--c-surface)',
                  color: m.role === 'user' ? '#fff' : m.error ? '#E74C3C' : 'var(--c-text-1)',
                  fontSize: '12px', lineHeight: 1.5,
                  border: m.role === 'assistant' ? '1px solid var(--c-border)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.imagePreview && (
                    <img
                      src={m.imagePreview}
                      alt="referência"
                      style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: m.content ? '6px' : 0, display: 'block' }}
                    />
                  )}
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '14px 14px 14px 4px', padding: '9px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d68d8f', animation: `bounce 1s ${i * .2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Preview da imagem anexada */}
          {imagePreview && (
            <div style={{ padding: '6px 12px', borderTop: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--c-surface)' }}>
              <img
                src={imagePreview}
                alt="preview"
                style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--c-border)' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--c-text-2)', flex: 1 }}>Imagem anexada</span>
              <button
                onClick={removeImage}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-4)', fontSize: '18px', lineHeight: 1, padding: '2px' }}
              >×</button>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--c-border)', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Anexar imagem de referência"
              style={{
                width: '34px', height: '34px', borderRadius: '10px',
                border: `1.5px solid ${imagePreview ? '#d68d8f' : 'var(--c-border)'}`,
                background: imagePreview ? 'linear-gradient(135deg, #d68d8f, #7D4A5E)' : 'var(--c-surface)',
                color: imagePreview ? '#fff' : 'var(--c-text-3)',
                cursor: 'pointer', fontSize: '15px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s', flexShrink: 0,
              }}
            >📎</button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Pergunte ou peça um texto..."
              rows={1}
              style={{
                flex: 1, padding: '8px 11px', fontSize: '12px',
                border: '1.5px solid var(--c-border)', borderRadius: '10px',
                background: 'var(--c-surface)', color: 'var(--c-text-1)',
                outline: 'none', resize: 'none', fontFamily: 'Inter, sans-serif',
                lineHeight: 1.4, maxHeight: '80px', overflowY: 'auto',
              }}
            />
            <button
              onClick={() => send()}
              disabled={!canSend}
              style={{
                width: '34px', height: '34px', borderRadius: '10px', border: 'none',
                background: canSend ? 'linear-gradient(135deg, #d68d8f, #7D4A5E)' : 'var(--c-border)',
                color: '#fff', cursor: canSend ? 'pointer' : 'not-allowed',
                fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s', flexShrink: 0,
              }}
            >↑</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}
