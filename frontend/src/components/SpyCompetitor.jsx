import React, { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * SpyCompetitor — análise de concorrente "Lite assistido".
 *
 * Fluxo: usuário cola screenshots da Facebook Ads Library + textos (hooks/copies),
 * frontend dispara um describe-item por item em paralelo (Groq vision para imagens,
 * passthrough pra texto), depois chama /analyze pra agregar com Groq llama-3.3 e salvar.
 *
 * Sem scraping automático aqui — coleta é manual. Quando virar uso pesado,
 * troca o "coletor" sem refatorar relatório/DB.
 */

const ADS_LIBRARY_BASE = 'https://www.facebook.com/ads/library/';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SpyCompetitor() {
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [items, setItems] = useState([]); // {id, type:'image'|'text', data, label, preview?}
  const [textInput, setTextInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, stage: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => { reloadHistory(); }, []);

  async function reloadHistory() {
    try {
      const r = await api.get('/api/competitors');
      setHistory(r.data || []);
    } catch (e) {
      console.warn('falha ao listar análises', e);
    }
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    const novos = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const dataUrl = await fileToBase64(f);
      novos.push({
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'image',
        data: dataUrl,
        label: f.name,
        preview: dataUrl,
      });
    }
    setItems(prev => [...prev, ...novos]);
  }

  function addText() {
    const txt = textInput.trim();
    if (!txt) return;
    setItems(prev => [...prev, {
      id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'text',
      data: txt,
      label: 'Texto colado',
    }]);
    setTextInput('');
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function reset() {
    setName(''); setSourceUrl(''); setItems([]); setTextInput('');
    setResult(null); setError('');
    setProgress({ done: 0, total: 0, stage: '' });
  }

  async function runAnalysis() {
    setError('');
    if (!name.trim()) return setError('Informe o nome do concorrente');
    if (items.length === 0) return setError('Adicione pelo menos uma imagem ou texto');

    setIsAnalyzing(true);
    setResult(null);

    try {
      /* Etapa 1: descrever cada item em paralelo (Groq vision por imagem,
         passthrough pra texto). Cada call é leve, cabe no timeout. */
      setProgress({ done: 0, total: items.length, stage: 'Lendo criativos com IA' });

      const descriptions = [];
      let done = 0;
      await Promise.all(items.map(async (it, idx) => {
        try {
          const r = await api.post('/api/competitors/describe-item', {
            type: it.type,
            data: it.data,
            label: it.label,
          });
          descriptions[idx] = r.data?.description || '(sem descrição)';
        } catch (e) {
          descriptions[idx] = `(falha: ${e.response?.data?.error || e.message})`;
        } finally {
          done += 1;
          setProgress({ done, total: items.length, stage: 'Lendo criativos com IA' });
        }
      }));

      /* Etapa 2: agregação + persistência */
      setProgress({ done: items.length, total: items.length, stage: 'Gerando relatório' });

      const r = await api.post('/api/competitors/analyze', {
        name: name.trim(),
        source_url: sourceUrl.trim() || null,
        items: items.map(({ id, type, label }) => ({ id, type, label })),
        descriptions,
      });

      setResult(r.data);
      reloadHistory();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'erro inesperado');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function loadHistoryDetail(id) {
    setOpenId(id);
    try {
      const r = await api.get(`/api/competitors/${id}`);
      setResult({
        ...r.data,
        items_count: (r.data.items || []).length,
      });
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  async function deleteAnalysis(id) {
    if (!confirm('Apagar esta análise?')) return;
    try {
      await api.delete(`/api/competitors/${id}`);
      if (openId === id) { setOpenId(null); setResult(null); }
      reloadHistory();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  const adsLibraryHref = sourceUrl.trim() || `${ADS_LIBRARY_BASE}?active_status=active&country=BR&q=${encodeURIComponent(name)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={cardBase}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Nome do concorrente *</label>
            <input
              type="text"
              placeholder="Ex.: Studio Renata Souza"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>URL da Ads Library (opcional)</label>
            <input
              type="text"
              placeholder="https://www.facebook.com/ads/library/?id=..."
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            href={adsLibraryHref}
            target="_blank"
            rel="noopener noreferrer"
            style={btnAccent}
          >
            🔍 Abrir Ads Library do concorrente
          </a>
          <span style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>
            Tire prints dos anúncios e arraste aqui embaixo, ou copie o texto e cole no campo de texto.
          </span>
        </div>
      </div>

      <div style={cardBase}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.4px' }}>
          1. Adicione prints / imagens
        </div>
        <DropZone onDrop={handleFiles} />
      </div>

      <div style={cardBase}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.4px' }}>
          2. Cole textos (hook, copy, CTA)
        </div>
        <textarea
          rows={3}
          placeholder="Cole aqui o gancho, copy do anúncio, CTA, observações sobre estilo..."
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <button onClick={addText} disabled={!textInput.trim()} style={btnGhost}>
          + Adicionar texto
        </button>
      </div>

      {items.length > 0 && (
        <div style={cardBase}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.4px' }}>
            3. Itens coletados ({items.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
            {items.map(it => (
              <div key={it.id} style={{
                position: 'relative',
                borderRadius: '10px', overflow: 'hidden',
                border: '1px solid var(--c-border)',
                background: 'var(--c-surface)',
                aspectRatio: '1', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                padding: '8px', fontSize: '11px', color: 'var(--c-text-3)',
                textAlign: 'center',
              }}>
                {it.type === 'image' && it.preview ? (
                  <img src={it.preview} alt={it.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>
                    {it.data}
                  </div>
                )}
                <button
                  onClick={() => removeItem(it.id)}
                  style={{
                    position: 'absolute', top: '4px', right: '4px',
                    background: 'rgba(0,0,0,.65)', color: '#fff',
                    border: 'none', borderRadius: '50%', width: '22px', height: '22px',
                    cursor: 'pointer', fontSize: '13px', lineHeight: 1,
                  }}
                  title="Remover"
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={runAnalysis}
          disabled={isAnalyzing || !name.trim() || items.length === 0}
          style={{ ...btnPrimary, opacity: isAnalyzing || !name.trim() || items.length === 0 ? 0.5 : 1 }}
        >
          {isAnalyzing ? 'Analisando…' : '🤖 Analisar concorrente'}
        </button>
        {(items.length > 0 || result) && !isAnalyzing && (
          <button onClick={reset} style={btnGhost}>Limpar</button>
        )}
        {isAnalyzing && progress.total > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--c-text-3)' }}>
            {progress.stage} — {progress.done}/{progress.total}
          </span>
        )}
        {error && (
          <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>{error}</span>
        )}
      </div>

      {result && (
        <ResultPanel result={result} onClose={() => { setResult(null); setOpenId(null); }} />
      )}

      {history.length > 0 && (
        <div style={cardBase}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '12px' }}>
            Análises anteriores
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map(h => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: '10px',
                border: '1px solid var(--c-border)',
                background: openId === h.id ? 'var(--c-active-bg)' : 'var(--c-surface)',
                gap: '10px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                    {h.name}
                  </div>
                  {h.summary && (
                    <div style={{ fontSize: '11px', color: 'var(--c-text-3)', marginTop: '2px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.summary}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: 'var(--c-text-3)', marginTop: '3px' }}>
                    {new Date(h.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <button onClick={() => loadHistoryDetail(h.id)} style={smallBtn}>Abrir</button>
                <button onClick={() => deleteAnalysis(h.id)} style={{ ...smallBtn, color: '#DC2626' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DropZone({ onDrop }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        onDrop(e.dataTransfer.files);
      }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '6px', padding: '28px', borderRadius: '12px',
        border: `2px dashed ${over ? 'var(--c-accent)' : 'var(--c-border)'}`,
        background: over ? 'var(--c-active-bg)' : 'var(--c-surface)',
        cursor: 'pointer', transition: 'all .15s',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '24px' }}>🖼️</div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)' }}>
        Arraste imagens aqui ou clique para selecionar
      </div>
      <div style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>
        Aceita prints da Ads Library (JPG, PNG, WebP)
      </div>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={e => onDrop(e.target.files)}
        style={{ display: 'none' }}
      />
    </label>
  );
}

function ResultPanel({ result, onClose }) {
  const insights = result.insights || {};
  const list = (key, fallback = []) => Array.isArray(insights[key]) ? insights[key] : fallback;

  return (
    <div style={{ ...cardBase, borderColor: 'var(--c-accent)', borderWidth: '1.5px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-accent)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Relatório de espionagem
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--c-text-1)', marginTop: '2px' }}>
            {result.name}
          </div>
          {result.source_url && (
            <a href={result.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--c-accent)', wordBreak: 'break-all' }}>
              {result.source_url}
            </a>
          )}
        </div>
        <button onClick={onClose} style={smallBtn}>Fechar</button>
      </div>

      {insights.summary && (
        <Section title="Resumo">
          <p style={{ fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.6, margin: 0 }}>{insights.summary}</p>
        </Section>
      )}

      {list('patterns').length > 0 && (
        <Section title="Padrões detectados">
          <ListBlock items={list('patterns')} />
        </Section>
      )}

      {list('hooks').length > 0 && (
        <Section title="Ganchos vencedores">
          <ListBlock items={list('hooks')} accent />
        </Section>
      )}

      {list('ctas').length > 0 && (
        <Section title="CTAs observados">
          <Pills items={list('ctas')} />
        </Section>
      )}

      {list('creative_formats').length > 0 && (
        <Section title="Formatos de criativo">
          <Pills items={list('creative_formats')} />
        </Section>
      )}

      {list('recommendations').length > 0 && (
        <Section title="Recomendações para Cris Costa Beauty">
          <ListBlock items={list('recommendations')} accent />
        </Section>
      )}

      {insights._raw && (
        <Section title="Resposta crua (debug)">
          <pre style={{ fontSize: '10px', color: 'var(--c-text-3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{insights._raw}</pre>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '6px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ListBlock({ items, accent = false }) {
  return (
    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map((it, i) => (
        <li key={i} style={{ fontSize: '12.5px', color: accent ? 'var(--c-text-1)' : 'var(--c-text-2)', lineHeight: 1.55 }}>
          {String(it)}
        </li>
      ))}
    </ul>
  );
}

function Pills({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {items.map((it, i) => (
        <span key={i} style={{
          fontSize: '11px', fontWeight: 600,
          padding: '5px 10px', borderRadius: '20px',
          background: 'var(--c-active-bg)', color: 'var(--c-accent)',
        }}>
          {String(it)}
        </span>
      ))}
    </div>
  );
}

const cardBase = {
  background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
  borderRadius: '14px', padding: '18px',
};
const inputStyle = {
  width: '100%', padding: '10px 14px', fontSize: '13px',
  border: '1.5px solid var(--c-border)', borderRadius: '10px',
  background: 'var(--c-surface)', color: 'var(--c-text-1)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 700,
  color: 'var(--c-text-3)', marginBottom: '6px',
  textTransform: 'uppercase', letterSpacing: '.4px',
};
const btnPrimary = {
  padding: '12px 22px', fontSize: '13px', fontWeight: 700,
  background: 'var(--c-accent)', color: '#fff',
  border: 'none', borderRadius: '10px', cursor: 'pointer',
};
const btnAccent = {
  padding: '9px 14px', fontSize: '12px', fontWeight: 700,
  background: 'var(--c-accent)', color: '#fff',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px',
};
const btnGhost = {
  padding: '8px 14px', fontSize: '12px', fontWeight: 600,
  background: 'var(--c-surface)', color: 'var(--c-text-3)',
  border: '1.5px solid var(--c-border)', borderRadius: '10px', cursor: 'pointer',
};
const smallBtn = {
  padding: '6px 12px', fontSize: '11px', fontWeight: 700,
  background: 'var(--c-surface)', color: 'var(--c-text-2)',
  border: '1px solid var(--c-border)', borderRadius: '8px', cursor: 'pointer',
};
