import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';

const QUICK_PROMPTS = [
  'Crie um texto para anúncio de design de sobrancelhas',
  'Headline para promoção de limpeza de pele',
  'CTA para stories de alongamento de cílios',
  'Como funciona o sistema de agendamento?',
  'Texto para anúncio de pacote de estética completa',
];

// Comprime a imagem iterativamente até garantir base64 < 3MB (limite Groq: 4MB)
function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      function tryCompress(maxDim, quality) {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result;
            const sizeBytes = Math.round((dataUrl.length * 3) / 4); // base64 → bytes aprox
            if (sizeBytes > 3 * 1024 * 1024 && quality > 0.3) {
              // ainda grande: reduz qualidade ou dimensão
              const nextQuality = quality > 0.5 ? quality - 0.15 : quality - 0.1;
              const nextDim = quality <= 0.5 ? Math.round(maxDim * 0.75) : maxDim;
              tryCompress(nextDim, Math.max(nextQuality, 0.2));
            } else {
              resolve(dataUrl);
            }
          };
          reader.readAsDataURL(blob);
        }, 'image/jpeg', quality);
      }

      tryCompress(1024, 0.8);
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

    const userMessage = {
      role: 'user',
      content: msg || '',
      ...(imagePreview && { imagePreview }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    let imageData = null;
    if (imageBase64) {
      imageData = { base64: imageBase64.split(',')[1], mimeType: 'image/jpeg' };
    }
    setImageBase64(null);
    setImagePreview(null);

    try {
      const res = await api.post('/api/ai/chat', {
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        image: imageData,
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
          background: open ? '#333' : 'linear-gradient(135deg, #C13584, #7D4A5E)',
          color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(193,53,132,.4)',
          transition: 'all .2s',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
      >
        {open ? '×' : '✦'}
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
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border)', background: 'linear-gradient(135deg, #C13584 0%, #7D4A5E 100%)', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>✦</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>Assistente IA</div>
                <div style={{ fontSize: '10px', opacity: .8 }}>Cris Costa Beauty</div>
              </div>
            </div>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

            {messages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>✦</div>
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
                  background: m.role === 'user' ? 'linear-gradient(135deg, #C13584, #7D4A5E)' : m.error ? '#FDEAED' : 'var(--c-surface)',
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
                    <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C13584', animation: `bounce 1s ${i * .2}s infinite` }} />
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
                border: `1.5px solid ${imagePreview ? '#C13584' : 'var(--c-border)'}`,
                background: imagePreview ? 'linear-gradient(135deg, #C13584, #7D4A5E)' : 'var(--c-surface)',
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
                background: canSend ? 'linear-gradient(135deg, #C13584, #7D4A5E)' : 'var(--c-border)',
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
