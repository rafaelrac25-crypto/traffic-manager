import React, { useState, useRef, useCallback } from 'react';
import api from '../services/api';

const STEPS = ['Plataforma', 'Objetivo', 'Criativo', 'Público', 'Orçamento', 'Publicação'];

const INSTAGRAM_ICON = (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="26" height="26">
    <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="#000" strokeWidth="2"/>
    <circle cx="12" cy="12" r="4.5" stroke="#000" strokeWidth="2"/>
    <circle cx="17.5" cy="6.5" r="1.2" fill="#000"/>
  </svg>
);

const GOOGLE_ADS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="26" height="26">
    <path d="M3.5 17.5L9 7.5L14.5 17.5H3.5Z" stroke="#000" strokeWidth="2" strokeLinejoin="round"/>
    <circle cx="18.5" cy="14.5" r="4" stroke="#000" strokeWidth="2"/>
  </svg>
);

const PLATFORMS = [
  { id: 'meta',   icon: INSTAGRAM_ICON, bg: '#f5f5f5', name: 'Tráfego Instagram' },
  { id: 'google', icon: GOOGLE_ADS_ICON, bg: '#f5f5f5', name: 'Google Ads' },
];

const OBJECTIVES = [
  { id: 'vendas',     icon: '🛒', name: 'Vendas',        desc: 'Vender produtos ou serviços' },
  { id: 'cadastros',  icon: '👥', name: 'Cadastros',     desc: 'Capturar leads e contatos' },
  { id: 'trafego',    icon: '🌐', name: 'Visitas ao site', desc: 'Mais pessoas no meu site' },
  { id: 'engajamento',icon: '❤️', name: 'Engajamento',   desc: 'Curtidas, seguidores, comentários' },
  { id: 'contato',    icon: '📞', name: 'Contato',       desc: 'WhatsApp, ligações ou mensagens' },
  { id: 'loja',       icon: '🏪', name: 'Loja física',   desc: 'Levar pessoas à loja' },
];

const BUDGETS = [
  { val: 20,  est: '~R$ 600/mês' },
  { val: 50,  est: '~R$ 1.500/mês' },
  { val: 100, est: '~R$ 3.000/mês' },
  { val: 200, est: '~R$ 6.000/mês' },
];

// ── Utilitários de rascunho ──────────────────────────────────────────────────
function loadDrafts() {
  try { return JSON.parse(localStorage.getItem('ad_drafts') || '[]'); } catch { return []; }
}
function saveDraftToStorage(draft) {
  const drafts = loadDrafts();
  const idx = drafts.findIndex(d => d.id === draft.id);
  if (idx >= 0) drafts[idx] = draft; else drafts.unshift(draft);
  localStorage.setItem('ad_drafts', JSON.stringify(drafts));
}
export function deleteDraft(id) {
  const drafts = loadDrafts().filter(d => d.id !== id);
  localStorage.setItem('ad_drafts', JSON.stringify(drafts));
}
export function getDrafts() { return loadDrafts(); }
// ─────────────────────────────────────────────────────────────────────────────

export default function NewCampaignWizard({ onClose, onCreated, initialDraft }) {
  // Se vier de um rascunho, restaura o id; senão gera um novo
  const draftId = useRef(initialDraft?.id || `draft_${Date.now()}`);

  const [step, setStep] = useState(initialDraft?.step ?? 0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDraftToast, setShowDraftToast] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checks, setChecks] = useState([]);

  const [platform,   setPlatform]   = useState(initialDraft?.platform   ?? 'meta');
  const [objective,  setObjective]  = useState(initialDraft?.objective  ?? 'vendas');
  const [adName,     setAdName]     = useState(initialDraft?.adName     ?? '');
  const [adText,     setAdText]     = useState(initialDraft?.adText     ?? '');
  const [cta,        setCta]        = useState(initialDraft?.cta        ?? '');
  const [ctaLabels,  setCtaLabels]  = useState(initialDraft?.ctaLabels  ?? {});
  const [ctaEditing, setCtaEditing] = useState('');
  const ctaInputRef = useRef(null);
  const [uploaded,   setUploaded]   = useState(false);
  const [imageFile,  setImageFile]  = useState(null);
  const [imageURL,   setImageURL]   = useState('');
  const [imageMeta,  setImageMeta]  = useState(null);
  const [dragOver,   setDragOver]   = useState(false);
  const fileInputRef = useRef(null);
  const [location,   setLocation]   = useState(initialDraft?.location   ?? 'São Paulo e região, Brasil');
  const [ageRange,   setAgeRange]   = useState(initialDraft?.ageRange   ?? '25–34 anos');
  const [gender,     setGender]     = useState(initialDraft?.gender     ?? 'Feminino');
  const [interests,  setInterests]  = useState(initialDraft?.interests  ?? 'maquiagem, beleza, skincare');
  const [budget,     setBudget]     = useState(initialDraft?.budget     ?? 50);
  const [startDate,  setStartDate]  = useState(initialDraft?.startDate  ?? new Date().toISOString().split('T')[0]);
  const [endDate,    setEndDate]    = useState(initialDraft?.endDate    ?? '');
  const [publishMode,   setPublishMode]   = useState(initialDraft?.publishMode   ?? 'immediate');
  const [scheduledFor,  setScheduledFor]  = useState(initialDraft?.scheduledFor  ?? '');

  const today = new Date().toISOString().split('T')[0];

  function buildDraftState() {
    return {
      id: draftId.current,
      savedAt: new Date().toISOString(),
      step, platform, objective, adName, adText,
      cta, ctaLabels, location, ageRange, gender, interests, budget, startDate, endDate,
      publishMode, scheduledFor,
    };
  }

  function handleOverlayClick(e) {
    if (e.target !== e.currentTarget) return;
    // Só salva rascunho se algo foi preenchido
    const dirty = step > 0 || adName || adText;
    if (dirty) {
      saveDraftToStorage(buildDraftState());
      setShowDraftToast(true);
      setTimeout(() => { setShowDraftToast(false); onClose(); }, 1600);
    } else {
      onClose();
    }
  }

  function processFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const ext = file.name.split('.').pop().toUpperCase();
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX_DIM = 2000;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      // Redimensiona via canvas se exceder 2000px em qualquer dimensão
      let finalFile = file;
      let finalUrl  = url;
      const needsResize = w > MAX_DIM || h > MAX_DIM;
      const doFinalize = (fw, fh, fFile, fUrl) => {
        const ratio = fw / fh;
        const size  = (fFile.size / 1024).toFixed(0);
        const VALID_FORMATS = ['JPG','JPEG','PNG','WEBP'];
        const formatOk = VALID_FORMATS.includes(ext);
        const ratioName =
          Math.abs(ratio - 1)     < 0.05 ? '1:1 (Feed quadrado)' :
          Math.abs(ratio - 0.8)   < 0.05 ? '4:5 (Feed retrato)' :
          Math.abs(ratio - 0.5625)< 0.06 ? '9:16 (Stories / Reels)' :
          Math.abs(ratio - 1.91)  < 0.06 ? '1.91:1 (Paisagem)' : null;
        const ratioOk  = !!ratioName;
        const sizeOk   = fFile.size < 30 * 1024 * 1024;
        const minDim   = fw >= 600 && fh >= 600;
        setImageMeta({ w: fw, h: fh, size, ext, formatOk, ratioName, ratioOk, sizeOk, minDim,
          valid: formatOk && ratioOk && sizeOk && minDim });
        setImageURL(fUrl);
        setImageFile(fFile);
        setUploaded(true);
      };

      if (needsResize) {
        const scale = MAX_DIM / Math.max(w, h);
        const nw = Math.round(w * scale);
        const nh = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width  = nw;
        canvas.height = nh;
        canvas.getContext('2d').drawImage(img, 0, 0, nw, nh);
        canvas.toBlob(blob => {
          const resizedFile = new File([blob], file.name, { type: file.type });
          const resizedUrl  = URL.createObjectURL(resizedFile);
          URL.revokeObjectURL(url);
          doFinalize(nw, nh, resizedFile, resizedUrl);
        }, file.type, 0.92);
      } else {
        doFinalize(w, h, finalFile, finalUrl);
      }
    };
    img.src = url;
  }

  function handleFileInput(e) {
    processFile(e.target.files[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }

  function detectLanguage(text) {
    if (!text || text.trim().length < 10) return { lang: 'pt', ok: true, msg: '' };
    const lower = text.toLowerCase();
    const countWords = (words) => words.filter(w => new RegExp('\\b' + w + '\\b').test(lower)).length;
    const ptList = ['de','da','do','para','com','seu','sua','meu','minha','nao','sim','ou','que','uma','um','mas','por','isso','este','esta','como','mais','muito','bem','nosso','nossa','voce','agora','ja','tambem','ate','sobre','aqui','frete','gratis','desconto','produto','servico','promocao','clique','acesse','saiba','compre','garanta','colecao','beleza','skincare','maquiagem'];
    const enList = ['the','and','for','with','your','our','click','buy','now','free','discount','shop','offer','get','limited','check','out','sale','new','best','only','this','that','from','more','here','today','all'];
    const esList = ['con','los','las','del','todo','muy','bien','nuestro','compra','oferta','hoy','nuevo','gratis'];
    const ptScore = countWords(ptList);
    const enScore = countWords(enList);
    const esScore = countWords(esList);
    if (enScore > ptScore && enScore >= 2) {
      return { lang: 'en', ok: false, msg: 'Texto parece estar em ingles. Verifique se o idioma esta correto para seu publico.' };
    }
    if (esScore > ptScore + 2 && esScore >= 3) {
      return { lang: 'es', ok: false, msg: 'Texto pode estar em espanhol. Confirme o idioma antes de publicar.' };
    }
    return { lang: 'pt', ok: true, msg: '' };
  }

  function runChecks() {
    const platLabels = { meta: 'Tráfego Instagram', google: 'Google Ads' };
    const objLabels  = { vendas: 'Vendas', cadastros: 'Cadastros', trafego: 'Visitas ao site', engajamento: 'Engajamento', contato: 'Contato', loja: 'Loja física' };
    const langResult = detectLanguage(adText);

    const list = [
      // Campos obrigatórios
      { group: 'Configuração', label: 'Plataforma selecionada',  ok: !!platform,              val: platLabels[platform] || platform, fix: 'Selecione uma plataforma no passo 1.' },
      { group: 'Configuração', label: 'Objetivo definido',       ok: !!objective,             val: objLabels[objective] || objective, fix: 'Defina o objetivo no passo 2.' },
      { group: 'Criativo',     label: 'Nome do anúncio',         ok: adName.trim().length > 2, val: adName || '—',  fix: 'Preencha o nome do anúncio (mín. 3 caracteres).' },
      { group: 'Criativo',     label: 'Texto do anúncio',        ok: adText.trim().length > 9, val: adText ? `"${adText.slice(0,40)}${adText.length>40?'…':''}"` : '—', fix: 'Escreva o texto do anúncio (mín. 10 caracteres).' },
      { group: 'Criativo',     label: 'Imagem enviada',          ok: uploaded,                 val: uploaded ? (imageFile?.name || 'Enviada') : 'Não enviada', fix: 'Faça upload de uma imagem no passo 3.', warn: true },
      { group: 'Criativo',     label: 'Qualidade da imagem',     ok: !uploaded || (imageMeta?.valid ?? true), val: uploaded && imageMeta ? (imageMeta.valid ? 'Aprovada' : 'Atenção — verifique formato/proporção') : '—', fix: 'Corrija os alertas da imagem antes de publicar.', warn: true },
      { group: 'Idioma',       label: 'Idioma do texto',         ok: langResult.ok,            val: langResult.lang === 'pt' ? 'Português ✓' : langResult.lang === 'en' ? 'Inglês detectado' : 'Outro idioma detectado', fix: langResult.msg },
      { group: 'Público',      label: 'Localização',             ok: location.trim().length > 2, val: location, fix: 'Preencha a localização no passo 4.' },
      { group: 'Orçamento',    label: 'Verba diária',            ok: budget > 0,               val: budget > 0 ? `R$ ${budget}/dia` : '—', fix: 'Defina um orçamento no passo 5.' },
      { group: 'Orçamento',    label: 'Data de início',          ok: !!startDate,              val: startDate || '—', fix: 'Defina a data de início no passo 5.' },
      { group: 'Orçamento',    label: 'Data de término',         ok: !!endDate,                val: endDate || '—', fix: 'Defina a data de término no passo 5.', warn: true },
    ];
    return list;
  }

  function handlePublishClick() {
    const result = runChecks();
    setChecks(result);
    setShowConfirm(true);
  }

  async function publish() {
    setLoading(true);
    try {
      await api.post('/api/campaigns', {
        name: adName || 'Nova Campanha',
        platform,
        budget,
        start_date: startDate,
        end_date: endDate,
        publish_mode: publishMode,
        scheduled_for: publishMode === 'scheduled' ? scheduledFor : null,
      });
      deleteDraft(draftId.current);
      setDone(true);
      onCreated?.();
    } catch (err) {
      alert('Erro ao criar campanha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const s = { // estilos reutilizáveis
    overlay:  { position: 'fixed', inset: 0, background: 'rgba(74,37,53,.45)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    modal:    { background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', animation: 'slideIn .3s ease' },
    header:   { padding: '24px 26px 0' },
    body:     { padding: '6px 26px 26px' },
    footer:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', borderTop: '1px solid var(--gray-200)' },
    title:    { fontSize: '15px', fontWeight: 700, color: 'var(--wine)', marginBottom: '3px' },
    sub:      { fontSize: '12px', color: 'var(--gray-600)', marginBottom: '18px', lineHeight: 1.4 },
    label:    { fontSize: '12px', fontWeight: 700, color: 'var(--wine)', marginBottom: '5px', display: 'block' },
    input:    { width: '100%', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: '9px 13px', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: 'var(--wine)', outline: 'none', background: '#fff' },
    btnPrim:  { background: 'var(--rose-deep)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
    btnGhost: { background: '#fff', color: 'var(--wine-mid)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: '9px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  };

  if (done) return (
    <div style={s.overlay} onClick={handleOverlayClick}>
      <div style={s.modal}>
        <div style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div style={{ fontSize: '56px', marginBottom: '14px', animation: 'popIn .5s cubic-bezier(.34,1.56,.64,1)' }}>
            {publishMode === 'scheduled' ? '📅' : '🎉'}
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--wine)', marginBottom: '6px' }}>
            {publishMode === 'scheduled' ? 'Campanha agendada!' : 'Campanha enviada para revisão!'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--gray-600)', maxWidth: '340px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            <strong>"{adName || 'Nova Campanha'}"</strong>{' '}
            {publishMode === 'scheduled'
              ? <>foi agendada para <strong>{new Date(scheduledFor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong> e aparece no seu dashboard.</>
              : <>foi enviada para revisão. Quando aprovada pela plataforma, o status muda automaticamente para <strong>🟢 Rodando</strong>.</>
            }
          </p>
          {publishMode === 'scheduled' ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#EEF2FF', border: '1px solid rgba(99,102,241,.3)', color: '#4F46E5', fontSize: '12px', fontWeight: 700, padding: '7px 16px', borderRadius: '20px', marginBottom: '24px' }}>
              🔵 Agendada — aguardando disparo
            </div>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#FFFBEB', border: '1px solid rgba(245,158,11,.3)', color: '#D97706', fontSize: '12px', fontWeight: 700, padding: '7px 16px', borderRadius: '20px', marginBottom: '24px' }}>
              🟡 Em revisão pela plataforma
            </div>
          )}
          <br/>
          <button style={s.btnPrim} onClick={onClose}>Ver no Dashboard →</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.overlay} onClick={handleOverlayClick}>

      {/* Toast rascunho salvo */}
      {showDraftToast && (
        <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', background: 'var(--wine)', color: '#fff', fontSize: '13px', fontWeight: 600, padding: '11px 22px', borderRadius: '30px', boxShadow: 'var(--shadow)', zIndex: 300, display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn .2s ease', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '16px' }}>📝</span> Rascunho salvo! Você pode continuar em Campanhas.
        </div>
      )}

      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--wine)', marginBottom: '2px' }}>Criar Novo Anúncio</h2>
              <p style={{ fontSize: '12px', color: 'var(--gray-600)' }}>Passo {step + 1} de {STEPS.length} — {STEPS[step]}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--gray-400)', lineHeight: 1 }}>×</button>
          </div>

          {/* Progress bar */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= step ? 'var(--rose-deep)' : 'var(--gray-200)', transition: 'background .3s' }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={s.body}>

          {/* Step 0 — Plataforma */}
          {step === 0 && (
            <div>
              <div style={s.title}>Onde você quer anunciar?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                {PLATFORMS.map(p => (
                  <div key={p.id} onClick={() => setPlatform(p.id)} style={{
                    border: `2px solid ${platform === p.id ? 'var(--rose-deep)' : 'var(--gray-200)'}`,
                    background: platform === p.id ? 'var(--rose)' : '#fff',
                    borderRadius: 'var(--radius-sm)', padding: '28px 16px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '12px', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (platform !== p.id) e.currentTarget.style.borderColor = 'var(--rose-deep)'; }}
                  onMouseLeave={e => { if (platform !== p.id) e.currentTarget.style.borderColor = 'var(--gray-200)'; }}
                  >
                    <div style={{ width: '52px', height: '52px', background: p.bg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.icon}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wine)', textAlign: 'center' }}>{p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Objetivo */}
          {step === 1 && (
            <div>
              <div style={s.title}>Qual é o objetivo do anúncio?</div>
              <div style={s.sub}>O sistema configura as métricas certas para o que você escolher.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '9px' }}>
                {OBJECTIVES.map(o => (
                  <div key={o.id} onClick={() => setObjective(o.id)} style={{
                    border: `2px solid ${objective === o.id ? 'var(--rose-deep)' : 'var(--gray-200)'}`,
                    background: objective === o.id ? 'var(--rose)' : '#fff',
                    borderRadius: 'var(--radius-sm)', padding: '13px 10px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s',
                  }}>
                    <div style={{ fontSize: '22px', marginBottom: '5px' }}>{o.icon}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--wine)', marginBottom: '2px' }}>{o.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--gray-400)', lineHeight: 1.3 }}>{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Criativo */}
          {step === 2 && (
            <div>
              <div style={s.title}>Adicione o criativo do anúncio</div>

              {/* Input oculto */}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />

              {!uploaded ? (
                /* Zona de drop */
                <div
                  onClick={() => fileInputRef.current.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--rose-deep)' : 'var(--gray-200)'}`,
                    background: dragOver ? 'var(--rose)' : 'var(--rose-pale)',
                    borderRadius: 'var(--radius)', padding: '36px 20px', textAlign: 'center',
                    cursor: 'pointer', transition: 'all .2s', marginBottom: '14px',
                    transform: dragOver ? 'scale(1.01)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '34px', marginBottom: '8px' }}>🖼️</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--wine)', marginBottom: '4px' }}>
                    Clique para selecionar ou arraste aqui
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginBottom: '14px' }}>
                    Imagem do seu anúncio (JPG, PNG, WEBP)
                  </div>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {[['JPG ✓','var(--green-bg)','#1a6b3c'],['PNG ✓','var(--green-bg)','#1a6b3c'],['WEBP ✓','var(--green-bg)','#1a6b3c'],['GIF ✗','var(--red-bg)','#8b1c1c'],['BMP ✗','var(--red-bg)','#8b1c1c']].map(([l,bg,c]) => (
                      <span key={l} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '6px', background: bg, color: c }}>{l}</span>
                    ))}
                  </div>
                </div>
              ) : (
                /* Preview com safe-zone */
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>

                    {/* Mockup do anúncio com sobreposição */}
                    {imageMeta && (() => {
                      // A área visível no feed é sempre 1:1 centralizada na arte
                      const squarePct = imageMeta.h > imageMeta.w
                        ? (imageMeta.w / imageMeta.h) * 100   // ex: 1080/1350 = 80%
                        : 100;
                      const hasCrop   = squarePct < 99.5;
                      const cropEach  = (100 - squarePct) / 2; // % cortado topo E rodapé

                      const hatch = 'repeating-linear-gradient(45deg, rgba(220,38,38,0.58) 0px, rgba(220,38,38,0.58) 4px, rgba(220,38,38,0.16) 4px, rgba(220,38,38,0.16) 12px)';

                      return (
                        <div style={{ flexShrink: 0, width: '160px' }}>
                          <div style={{ position: 'relative', width: '160px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 3px 14px rgba(0,0,0,.18)', border: '1px solid var(--gray-200)' }}>
                            <img src={imageURL} alt="preview" style={{ display: 'block', width: '100%', height: 'auto' }} />

                            {/* Hachura vermelha — TOPO */}
                            {hasCrop && (
                              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${cropEach}%`, background: hatch, borderBottom: '2px dashed rgba(220,38,38,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '7px', color: '#fff', fontWeight: 800, textTransform: 'uppercase', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>área não visível</span>
                              </div>
                            )}

                            {/* Hachura vermelha — RODAPÉ */}
                            {hasCrop && (
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${cropEach}%`, background: hatch, borderTop: '2px dashed rgba(220,38,38,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '7px', color: '#fff', fontWeight: 800, textTransform: 'uppercase', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>área não visível</span>
                              </div>
                            )}

                            {/* Borda verde — área 1080×1080 centralizada */}
                            <div style={{ position: 'absolute', top: `${cropEach}%`, left: 0, right: 0, height: `${squarePct}%`, border: '1.5px solid #27ae60', pointerEvents: 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {hasCrop && (
                                <span style={{ background: 'rgba(39,174,96,0.88)', color: '#fff', fontSize: '7px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                                  1080×1080px visível
                                </span>
                              )}
                              {!hasCrop && (
                                <span style={{ position: 'absolute', top: '4px', left: '50%', transform: 'translateX(-50%)', background: '#27ae60', color: '#fff', fontSize: '7px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                                  área segura
                                </span>
                              )}
                            </div>
                          </div>

                          {hasCrop && (
                            <div style={{ marginTop: '7px', padding: '5px 8px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.22)', borderRadius: '6px', fontSize: '9px', color: '#b91c1c', fontWeight: 600, textAlign: 'center', lineHeight: 1.5 }}>
                              Conteúdo visível no feed:<br/>1080×1080px (centralizado)
                            </div>
                          )}

                          <button onClick={() => { setUploaded(false); setImageURL(''); setImageFile(null); setImageMeta(null); }} style={{ marginTop: '7px', width: '100%', fontSize: '10px', padding: '4px', borderRadius: '6px', border: '1px solid var(--gray-200)', background: '#fff', cursor: 'pointer', color: 'var(--gray-600)' }}>
                            Trocar imagem
                          </button>
                        </div>
                      );
                    })()}

                    {/* Diagnóstico */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--wine)', marginBottom: '10px' }}>
                        {imageFile?.name}
                      </div>

                      {imageMeta && (() => {
                        const rows = [
                          { label: 'Formato',    ok: imageMeta.formatOk, val: imageMeta.ext,                         fix: 'Use JPG, PNG ou WEBP' },
                          { label: 'Dimensões',  ok: imageMeta.minDim,   val: `${imageMeta.w} × ${imageMeta.h} px`,  fix: 'Mínimo 600 × 600 px' },
                          { label: 'Proporção',  ok: imageMeta.ratioOk,  val: imageMeta.ratioName || `${(imageMeta.w/imageMeta.h).toFixed(2)}:1`, fix: '1:1, 4:5 ou 9:16 para Instagram' },
                          { label: 'Tamanho',    ok: imageMeta.sizeOk,   val: `${imageMeta.size} KB`,                fix: 'Máximo 30 MB' },
                        ];
                        return (
                          <div style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>
                            {rows.map(r => (
                              <div key={r.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '11px' }}>
                                <span style={{ marginTop: '1px' }}>{r.ok ? '✅' : '⚠️'}</span>
                                <div>
                                  <span style={{ fontWeight: 700, color: 'var(--wine)' }}>{r.label}: </span>
                                  <span style={{ color: r.ok ? 'var(--gray-600)' : 'var(--red)' }}>{r.val}</span>
                                  {!r.ok && <div style={{ color: 'var(--gray-400)', fontSize: '10px', marginTop: '1px' }}>{r.fix}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      <div style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                        background: imageMeta?.valid ? 'var(--green-bg)' : 'rgba(255,193,7,.12)',
                        color: imageMeta?.valid ? '#1a6b3c' : '#7a4a00',
                        border: `1px solid ${imageMeta?.valid ? 'rgba(39,174,96,.3)' : 'rgba(255,193,7,.4)'}`,
                      }}>
                        {imageMeta?.valid
                          ? '✅ Imagem perfeita para Instagram!'
                          : '⚠️ Ajuste os pontos acima para melhores resultados.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={s.label}>Nome do anúncio</label>
                <input style={s.input} value={adName} onChange={e => setAdName(e.target.value)} placeholder="Ex: Batom Nude — Coleção Verão 2026"/>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={s.label}>Texto do anúncio</label>
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={3} value={adText} onChange={e => setAdText(e.target.value)} placeholder="Ex: Renove seu look com nossa coleção de verão. Frete grátis acima de R$ 150!"/>
              </div>

              {/* CTA */}
              <div>
                <label style={s.label}>Botão de chamada para ação (CTA)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '7px' }}>
                  {[
                    { id: '',           icon: '✖', label: 'Sem botão',     editable: false },
                    { id: 'whatsapp',   icon: '💬', label: 'WhatsApp',     sub: 'Enviar mensagem' },
                    { id: 'saiba_mais', icon: '📖', label: 'Saiba mais',   sub: 'Direciona ao link' },
                    { id: 'comprar',    icon: '🛒', label: 'Comprar agora', sub: 'Venda direta' },
                    { id: 'cadastro',   icon: '📝', label: 'Cadastre-se',  sub: 'Captura de leads' },
                    { id: 'site',       icon: '🔗', label: 'Acessar site', sub: 'Tráfego externo' },
                  ].map(o => {
                    const isSelected = cta === o.id;
                    const isEditing  = ctaEditing === o.id && o.id !== '';
                    const displayLabel = ctaLabels[o.id] || o.label;
                    return (
                      <div key={o.id}
                        onClick={() => { if (!isEditing) setCta(o.id); }}
                        onDoubleClick={() => {
                          if (o.id === '' || o.editable === false) return;
                          setCta(o.id);
                          setCtaEditing(o.id);
                          setTimeout(() => ctaInputRef.current?.focus(), 50);
                        }}
                        style={{
                          border: `2px solid ${isSelected ? 'var(--rose-deep)' : 'var(--gray-200)'}`,
                          background: isSelected ? 'var(--rose)' : '#fff',
                          borderRadius: 'var(--radius-sm)', padding: '9px 8px', cursor: 'pointer',
                          textAlign: 'center', transition: 'all .15s', position: 'relative',
                        }}>
                        <div style={{ fontSize: '18px', marginBottom: '3px' }}>{o.icon}</div>

                        {isEditing ? (
                          <input
                            ref={ctaInputRef}
                            value={ctaLabels[o.id] ?? o.label}
                            onChange={e => setCtaLabels(l => ({ ...l, [o.id]: e.target.value }))}
                            onBlur={() => setCtaEditing('')}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setCtaEditing(''); } }}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '100%', border: 'none', borderBottom: '1.5px solid var(--rose-deep)', background: 'transparent', fontSize: '11px', fontWeight: 700, color: 'var(--wine)', textAlign: 'center', outline: 'none', padding: '1px 2px', boxSizing: 'border-box' }}
                          />
                        ) : (
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--wine)', lineHeight: 1.2 }}>
                            {displayLabel}
                          </div>
                        )}

                        {o.sub && !isEditing && (
                          <div style={{ fontSize: '9px', color: 'var(--gray-400)', marginTop: '2px' }}>{o.sub}</div>
                        )}

                        {/* Hint de duplo clique no card selecionado */}
                        {isSelected && o.id !== '' && !isEditing && (
                          <div style={{ position: 'absolute', top: '3px', right: '4px', fontSize: '8px', color: 'var(--rose-deep)', opacity: .7 }} title="Duplo clique para editar">✏</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {cta === 'whatsapp' && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: '#1a6b3c', fontWeight: 600 }}>
                    💡 O botão abrirá o WhatsApp Business vinculado à sua conta Meta.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3 — Público */}
          {step === 3 && (
            <div>
              <div style={s.title}>Para quem é este anúncio?</div>
              <div style={s.sub}>Quanto mais preciso o público, melhor o resultado e menor o gasto por cliente.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div><label style={s.label}>Localização</label><input style={s.input} value={location} onChange={e => setLocation(e.target.value)}/></div>
                <div><label style={s.label}>Faixa etária</label>
                  <select style={s.input} value={ageRange} onChange={e => setAgeRange(e.target.value)}>
                    {['18–24 anos','25–34 anos','35–44 anos','45–54 anos'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div><label style={s.label}>Gênero</label>
                  <select style={s.input} value={gender} onChange={e => setGender(e.target.value)}>
                    {['Todos','Feminino','Masculino'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div><label style={s.label}>Interesses</label><input style={s.input} value={interests} onChange={e => setInterests(e.target.value)}/></div>
              </div>
              <div style={{ background: 'var(--green-bg)', border: '1px solid rgba(39,174,96,.3)', color: '#1a6b3c', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px', fontWeight: 600 }}>
                ✅ Público estimado: <strong>260.000 – 400.000 pessoas</strong> — tamanho ideal!
              </div>
            </div>
          )}

          {/* Step 4 — Orçamento */}
          {step === 4 && (
            <div>
              <div style={s.title}>Quanto quer investir?</div>
              <div style={s.sub}>Escolha o orçamento diário. Você pode pausar ou alterar a qualquer momento.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '9px', marginBottom: '14px' }}>
                {BUDGETS.map(b => (
                  <div key={b.val} onClick={() => setBudget(b.val)} style={{
                    border: `2px solid ${budget === b.val ? 'var(--rose-deep)' : 'var(--gray-200)'}`,
                    background: budget === b.val ? 'var(--rose)' : '#fff',
                    borderRadius: 'var(--radius-sm)', padding: '11px 8px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s',
                  }}>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--wine)' }}>R${b.val}</div>
                    <div style={{ fontSize: '10px', color: 'var(--gray-400)', marginTop: '2px' }}>por dia</div>
                    <div style={{ fontSize: '10px', color: 'var(--green)', fontWeight: 600, marginTop: '3px' }}>{b.est}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div><label style={s.label}>Data de início</label><input type="date" style={s.input} value={startDate} onChange={e => setStartDate(e.target.value)} min={today}/></div>
                <div><label style={s.label}>Data de término</label><input type="date" style={s.input} value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate}/></div>
              </div>
              <div style={{ background: 'var(--rose)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '16px' }}>
                {[
                  ['Plataforma', PLATFORMS.find(p=>p.id===platform)?.name],
                  ['Objetivo', OBJECTIVES.find(o=>o.id===objective)?.name],
                  ['Nome', adName || '(não informado)'],
                  ['Público', `${gender} · ${ageRange} · ${location}`],
                  ['Orçamento', `R$ ${budget}/dia · ${startDate} → ${endDate}`],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(201,139,131,.2)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--wine-mid)' }}>{l}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--wine)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5 — Publicação */}
          {step === 5 && (() => {
            const minDateTime = new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16);
            return (
              <div>
                <div style={s.title}>Quando publicar?</div>
                <div style={s.sub}>Escolha se quer publicar agora ou agendar para um horário específico.</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { mode: 'immediate', icon: '🚀', label: 'Publicar agora', desc: 'Envia para revisão imediatamente' },
                    { mode: 'scheduled', icon: '📅', label: 'Agendar', desc: 'Escolha data e hora para disparar' },
                  ].map(opt => (
                    <div key={opt.mode} onClick={() => setPublishMode(opt.mode)} style={{
                      border: `2px solid ${publishMode === opt.mode ? 'var(--rose-deep)' : 'var(--gray-200)'}`,
                      background: publishMode === opt.mode ? 'var(--rose)' : '#fff',
                      borderRadius: 'var(--radius)', padding: '18px 14px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s',
                    }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{opt.icon}</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--wine)', marginBottom: '4px' }}>{opt.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>

                {publishMode === 'scheduled' && (
                  <div style={{ background: 'var(--rose-pale)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px' }}>
                    <label style={s.label}>Data e hora do disparo</label>
                    <input type="datetime-local" style={s.input} value={scheduledFor} min={minDateTime}
                      onChange={e => setScheduledFor(e.target.value)} />
                    {scheduledFor && (
                      <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600, marginTop: '8px' }}>
                        ✓ Agendado para {new Date(scheduledFor).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}
                      </div>
                    )}
                  </div>
                )}

                {/* Linha do tempo de status */}
                <div style={{ background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '12px' }}>Como funciona o fluxo de status</div>
                  {[
                    { flag: '🔵', label: 'Agendado', desc: 'Campanha criada e aguardando o horário configurado', show: publishMode === 'scheduled' },
                    { flag: '🟡', label: 'Em revisão', desc: 'Enviada para Meta/Google — plataforma está analisando (1–24h)' },
                    { flag: '🟢', label: 'Rodando', desc: 'Aprovada e veiculando para o público' },
                    { flag: '⚫', label: 'Pausado', desc: 'Você pode pausar manualmente a qualquer momento' },
                  ].filter(s => s.show !== false).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{item.flag}</span>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--wine)' }}>{item.label}</span>
                        <span style={{ fontSize: '11px', color: 'var(--gray-400)', marginLeft: '6px' }}>{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

        </div>

        {/* Footer */}
        <div style={s.footer}>
          <button style={{ ...s.btnGhost, visibility: step === 0 ? 'hidden' : 'visible' }} onClick={() => setStep(s => s - 1)}>← Voltar</button>
          <div style={{ display: 'flex', gap: '5px' }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ height: '6px', borderRadius: '3px', background: i === step ? 'var(--rose-deep)' : 'var(--gray-200)', width: i === step ? '18px' : '6px', transition: 'all .2s', cursor: 'pointer' }} onClick={() => i < step && setStep(i)} />
            ))}
          </div>
          {step < STEPS.length - 1
            ? <button style={s.btnPrim} onClick={() => setStep(s => s + 1)}>Próximo →</button>
            : <button style={{ ...s.btnPrim, opacity: loading ? .6 : 1 }} onClick={handlePublishClick} disabled={loading}>
                {publishMode === 'scheduled' ? '📅 Agendar Campanha' : '🔍 Revisar e Publicar'}
              </button>
          }
        </div>

      </div>

      {/* Modal de confirmação pré-publicação */}
      {showConfirm && (() => {
        const errors   = checks.filter(c => !c.ok && !c.warn);
        const warnings = checks.filter(c => !c.ok && c.warn);
        const allOk    = errors.length === 0;
        const errTxt   = errors.length > 0 ? errors.length + ' problema(s) critico(s)' : '';
        const warnTxt  = warnings.length > 0 ? warnings.length + ' aviso(s)' : '';
        const summaryTxt = [errTxt, warnTxt].filter(Boolean).join(' e ') + '. Revise antes de publicar.';

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(74,37,53,.6)', backdropFilter: 'blur(6px)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', animation: 'slideIn .25s ease' }}>

              {/* Header */}
              <div style={{ padding: '22px 24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '22px' }}>{allOk ? '✅' : '⚠️'}</span>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--wine)' }}>
                    {allOk ? 'Tudo certo! Pronto para publicar.' : 'Atenção antes de publicar'}
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--gray-600)', marginBottom: '18px', paddingLeft: '32px' }}>
                  {allOk
                    ? 'O sistema verificou todas as configuracoes do seu anuncio.'
                    : ('Encontramos ' + summaryTxt)}
                </p>
              </div>

              {/* Checks agrupados */}
              <div style={{ padding: '0 24px', display: 'grid', gap: '4px', marginBottom: '16px' }}>
                {['Configuração','Criativo','Idioma','Público','Orçamento'].map(group => {
                  const groupChecks = checks.filter(c => c.group === group);
                  if (!groupChecks.length) return null;
                  return (
                    <div key={group}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.6px', margin: '10px 0 5px' }}>{group}</div>
                      {groupChecks.map(c => (
                        <div key={c.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '7px 10px', borderRadius: '8px', background: c.ok ? '#f8fef8' : c.warn ? 'rgba(255,193,7,.07)' : 'rgba(231,76,60,.06)', marginBottom: '3px', border: `1px solid ${c.ok ? 'rgba(39,174,96,.15)' : c.warn ? 'rgba(255,193,7,.25)' : 'rgba(231,76,60,.18)'}` }}>
                          <span style={{ fontSize: '14px', marginTop: '1px', flexShrink: 0 }}>{c.ok ? '✅' : c.warn ? '⚠️' : '❌'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--wine)' }}>{c.label}</span>
                              <span style={{ fontSize: '11px', color: 'var(--gray-600)', textAlign: 'right', maxWidth: '180px' }}>{c.val}</span>
                            </div>
                            {!c.ok && <div style={{ fontSize: '10px', color: c.warn ? '#7a4a00' : 'var(--red)', marginTop: '2px' }}>{c.fix}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Pergunta de confirmação */}
              <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--gray-100)' }}>
                {allOk ? (
                  <>
                    <div style={{ background: 'var(--rose-pale)', border: '1.5px solid var(--rose)', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wine)', marginBottom: '3px' }}>Quer publicar o anúncio agora?</div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>O anúncio será enviado imediatamente à plataforma.</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => { setShowConfirm(false); publish(); }}
                        disabled={loading}
                        style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--rose-deep)', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}>
                        {loading ? 'Publicando...' : '🚀 Sim, publicar agora'}
                      </button>
                      <button
                        onClick={() => { setShowConfirm(false); saveDraftToStorage(buildDraftState()); }}
                        style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--gray-200)', background: '#fff', color: 'var(--wine)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                        Não, salvar rascunho
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: 'rgba(231,76,60,.06)', border: '1px solid rgba(231,76,60,.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', fontSize: '12px', color: '#8b1c1c' }}>
                      {errors.length > 0
                        ? '❌ Corrija os problemas críticos antes de publicar.'
                        : '⚠️ Há avisos não críticos. Você pode publicar mesmo assim ou corrigir primeiro.'}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {warnings.length > 0 && errors.length === 0 && (
                        <button
                          onClick={() => { setShowConfirm(false); publish(); }}
                          disabled={loading}
                          style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--rose-deep)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                          🚀 Publicar mesmo assim
                        </button>
                      )}
                      <button
                        onClick={() => setShowConfirm(false)}
                        style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--gray-200)', background: '#fff', color: 'var(--wine)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                        ← Voltar e corrigir
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
