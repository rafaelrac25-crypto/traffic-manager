import React, { useState } from 'react';
import { useAppState } from '../contexts/AppStateContext';

function formatBRL(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
}

function maskCard(v) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}
function maskExpiry(v) {
  return v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d{1,2})/, '$1/$2');
}

/* ── Ícones ── */
const CardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);
const PixIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l7-7 7 7-7 7z"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="12" y1="9" x2="12" y2="15"/>
  </svg>
);

export default function Investment() {
  const {
    funds, addFunds,
    paymentMethod, setPaymentMethod,
    LOW_BALANCE_THRESHOLD,
    pixel, setPixel,
  } = useAppState();

  const [tab, setTab]           = useState('card');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp]   = useState('');
  const [cardCvv, setCardCvv]   = useState('');
  const [pixKey,  setPixKey]    = useState('');
  const [topupValue, setTopupValue] = useState(50);
  const [msg, setMsg] = useState('');

  const quickValues = [20, 50, 100, 200, 500];

  function saveCard() {
    if (cardNumber.replace(/\D/g, '').length < 13 || !cardName) {
      setMsg('Preencha nome e número do cartão corretamente.');
      return;
    }
    setPaymentMethod({
      type: 'card',
      holder: cardName,
      last4: cardNumber.replace(/\D/g, '').slice(-4),
      exp: cardExp,
    });
    setMsg('Cartão salvo com sucesso.');
  }

  function savePix() {
    if (!pixKey) {
      setMsg('Informe uma chave PIX.');
      return;
    }
    setPaymentMethod({ type: 'pix', key: pixKey });
    setMsg('Chave PIX salva com sucesso.');
  }

  function handleTopup() {
    if (!paymentMethod) {
      setMsg('Cadastre um método de pagamento primeiro.');
      return;
    }
    if (!topupValue || topupValue <= 0) {
      setMsg('Informe um valor válido.');
      return;
    }
    addFunds(Number(topupValue));
    setMsg(`${formatBRL(topupValue)} adicionados ao saldo.`);
  }

  const lowBalance = funds < LOW_BALANCE_THRESHOLD;

  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px' }}>
          Investimento
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
          Cadastre um método de pagamento e adicione fundos para suas campanhas.
        </p>
      </div>

      {/* Saldo */}
      <div style={{
        background: lowBalance
          ? 'linear-gradient(135deg, #FEF2F2, #FDEAED)'
          : 'linear-gradient(135deg, rgba(193,53,132,.08), rgba(125,74,94,.05))',
        border: `1.5px solid ${lowBalance ? '#FCA5A5' : 'var(--c-border)'}`,
        borderRadius: '18px', padding: '24px 28px', marginBottom: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-3)', marginBottom: '6px', letterSpacing: '.5px', textTransform: 'uppercase' }}>
            Saldo disponível
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: lowBalance ? '#DC2626' : 'var(--c-accent)', lineHeight: 1 }}>
            {formatBRL(funds)}
          </div>
          {lowBalance && (
            <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '8px', fontWeight: 600 }}>
              ⚠ Saldo abaixo de {formatBRL(LOW_BALANCE_THRESHOLD)} — adicione fundos para manter suas campanhas ativas.
            </div>
          )}
        </div>
        {paymentMethod && (
          <div style={{ padding: '10px 14px', background: 'var(--c-card-bg)', borderRadius: '12px', border: '1px solid var(--c-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginBottom: '3px' }}>Método cadastrado</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
              {paymentMethod.type === 'card'
                ? `💳 •••• ${paymentMethod.last4}`
                : `⚡ PIX: ${paymentMethod.key}`}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(280px,1fr)', gap: '18px' }}>
        {/* Cadastro */}
        <div style={{
          background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
          borderRadius: '16px', padding: '22px', boxShadow: '0 2px 8px var(--c-shadow)',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '14px' }}>
            Método de pagamento
          </h3>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[
              { id: 'card', label: 'Cartão', Icon: CardIcon },
              { id: 'pix',  label: 'PIX',    Icon: PixIcon },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  flex: 1, padding: '10px', fontSize: '12px', fontWeight: 600,
                  border: `1.5px solid ${tab === id ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  background: tab === id ? 'var(--c-active-bg)' : 'var(--c-surface)',
                  color: tab === id ? 'var(--c-accent)' : 'var(--c-text-2)',
                  borderRadius: '10px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <Icon /> {label}
              </button>
            ))}
          </div>

          {tab === 'card' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text" placeholder="Nome impresso no cartão"
                value={cardName} onChange={e => setCardName(e.target.value)}
                style={inputStyle}
              />
              <input
                type="text" placeholder="0000 0000 0000 0000" inputMode="numeric"
                value={cardNumber} onChange={e => setCardNumber(maskCard(e.target.value))}
                style={inputStyle}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="text" placeholder="MM/AA"
                  value={cardExp} onChange={e => setCardExp(maskExpiry(e.target.value))}
                  style={inputStyle}
                />
                <input
                  type="text" placeholder="CVV" inputMode="numeric"
                  value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  style={inputStyle}
                />
              </div>
              <button onClick={saveCard} style={btnPrimary}>Salvar cartão</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text" placeholder="Chave PIX (CPF, e-mail, celular ou aleatória)"
                value={pixKey} onChange={e => setPixKey(e.target.value)}
                style={inputStyle}
              />
              <button onClick={savePix} style={btnPrimary}>Salvar chave PIX</button>
            </div>
          )}
        </div>

        {/* Recarga */}
        <div style={{
          background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
          borderRadius: '16px', padding: '22px', boxShadow: '0 2px 8px var(--c-shadow)',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '14px' }}>
            Adicionar fundos
          </h3>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {quickValues.map(v => (
              <button
                key={v}
                onClick={() => setTopupValue(v)}
                style={{
                  padding: '8px 14px', fontSize: '12px', fontWeight: 600,
                  border: `1.5px solid ${topupValue === v ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  background: topupValue === v ? 'var(--c-active-bg)' : 'var(--c-surface)',
                  color: topupValue === v ? 'var(--c-accent)' : 'var(--c-text-2)',
                  borderRadius: '10px', cursor: 'pointer',
                }}
              >
                {formatBRL(v)}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginBottom: '6px', fontWeight: 600 }}>
              Ou digite um valor personalizado
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', padding: '0 16px', width: '100%' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-accent)' }}>R$</span>
              <input
                type="number" min="10" step="10"
                value={topupValue} onChange={e => setTopupValue(Number(e.target.value))}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '20px', fontWeight: 700, color: 'var(--c-text-1)', fontFamily: 'inherit', padding: '10px 0', flex: 1 }}
              />
            </div>
          </div>

          <button onClick={handleTopup} style={btnPrimary}>Adicionar {formatBRL(topupValue)}</button>

          <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '12px', marginBottom: 0, lineHeight: 1.5 }}>
            O saldo é consumido automaticamente pelas campanhas ativas. Quando atingir menos de {formatBRL(LOW_BALANCE_THRESHOLD)}, avisaremos no sino de notificações.
          </p>
        </div>
      </div>

      {msg && (
        <div style={{
          marginTop: '16px', padding: '12px 16px',
          background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.3)',
          borderRadius: '10px', fontSize: '13px', color: '#16A34A', fontWeight: 600,
        }}>
          {msg}
        </div>
      )}

      {/* ── Pixel / Rastreamento de conversão ── */}
      <div style={{
        marginTop: '24px',
        background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
        borderRadius: '16px', padding: '22px', boxShadow: '0 2px 8px var(--c-shadow)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📊 Pixel de rastreamento
              {pixel?.enabled && (
                <span style={{
                  padding: '2px 8px', fontSize: '10px', fontWeight: 700,
                  background: '#DCFCE7', color: '#16A34A',
                  borderRadius: '6px', letterSpacing: '.3px',
                }}>
                  ATIVO
                </span>
              )}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--c-text-3)', margin: '4px 0 0', maxWidth: '560px', lineHeight: 1.5 }}>
              Rastreie conversões (agendamentos, contatos, compras) no seu site ou landing page para otimizar seus anúncios.
            </p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-3)' }}>
              {pixel?.enabled ? 'Ativado' : 'Desativado'}
            </span>
            <div
              onClick={() => setPixel({ ...pixel, enabled: !pixel?.enabled })}
              style={{
                width: '38px', height: '22px', borderRadius: '22px',
                background: pixel?.enabled ? 'var(--c-accent)' : 'var(--c-border)',
                position: 'relative', transition: 'background .2s',
              }}
            >
              <div style={{
                position: 'absolute',
                width: '16px', height: '16px', background: '#fff',
                borderRadius: '50%', top: '3px',
                left: pixel?.enabled ? '19px' : '3px',
                transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
              }} />
            </div>
          </label>
        </div>

        {pixel?.enabled && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 700,
                color: 'var(--c-text-3)', marginBottom: '6px',
                textTransform: 'uppercase', letterSpacing: '.4px',
              }}>
                ID do Pixel Meta
              </label>
              <input
                type="text"
                placeholder="Ex.: 1234567890123456"
                value={pixel?.pixelId || ''}
                onChange={e => setPixel({ ...pixel, pixelId: e.target.value.replace(/\D/g, '') })}
                style={inputStyle}
              />
              <p style={{ fontSize: '11px', color: 'var(--c-text-4)', margin: '6px 0 0' }}>
                Encontre no Gerenciador de Anúncios Meta → Eventos → Pixel.
              </p>
            </div>

            <div>
              <div style={{
                fontSize: '11px', fontWeight: 700, color: 'var(--c-text-3)',
                marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.4px',
              }}>
                Eventos rastreados
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                {[
                  { id: 'ViewContent', label: 'ViewContent', desc: 'Visualizou página' },
                  { id: 'Lead',        label: 'Lead',        desc: 'Enviou formulário' },
                  { id: 'Contact',     label: 'Contact',     desc: 'Clicou WhatsApp' },
                  { id: 'Purchase',    label: 'Purchase',    desc: 'Concluiu compra' },
                ].map(({ id, label, desc }) => {
                  const on = pixel?.events?.[id];
                  return (
                    <div
                      key={id}
                      onClick={() => setPixel({
                        ...pixel,
                        events: { ...pixel.events, [id]: !on },
                      })}
                      style={{
                        padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                        border: `1.5px solid ${on ? 'var(--c-accent)' : 'var(--c-border)'}`,
                        background: on ? 'var(--c-active-bg)' : 'var(--c-surface)',
                        transition: 'all .15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: on ? 'var(--c-accent)' : 'var(--c-text-2)' }}>
                          {label}
                        </span>
                        <span style={{ fontSize: '14px' }}>{on ? '✓' : '○'}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>{desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {pixel?.pixelId && (
              <div style={{
                background: 'var(--c-surface)', border: '1px dashed var(--c-border)',
                borderRadius: '10px', padding: '12px 14px',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                  Código para inserir no &lt;head&gt; do seu site
                </div>
                <pre style={{
                  fontSize: '10px', color: 'var(--c-text-2)',
                  fontFamily: 'Menlo, Consolas, monospace',
                  background: 'var(--c-card-bg)', padding: '10px', borderRadius: '6px',
                  overflow: 'auto', margin: 0, lineHeight: 1.5,
                }}>{`<script>
  !function(f,b,e,v,n,t,s){...}
  fbq('init', '${pixel.pixelId}');
  fbq('track', 'PageView');
</script>`}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 14px', fontSize: '13px',
  border: '1.5px solid var(--c-border)', borderRadius: '10px',
  background: 'var(--c-surface)', color: 'var(--c-text-1)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const btnPrimary = {
  width: '100%', padding: '12px', fontSize: '13px', fontWeight: 700,
  background: 'var(--c-accent)', color: '#fff',
  border: 'none', borderRadius: '10px', cursor: 'pointer',
};
