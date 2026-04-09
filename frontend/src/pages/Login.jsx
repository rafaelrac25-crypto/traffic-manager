import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/api/auth/login', form);
      localStorage.setItem('token', data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Usuário ou senha inválidos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #FDF0ED 0%, #F5E0DC 50%, #FDF0ED 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
      padding: '20px',
    }}>

      {/* Card central */}
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(74,37,53,.14)',
        width: '100%',
        maxWidth: '420px',
        overflow: 'hidden',
      }}>

        {/* Topo com logo */}
        <div style={{
          background: '#4A2535',
          padding: '36px 32px 28px',
          textAlign: 'center',
        }}>
          <img
            src="/logo.png"
            alt="Cris Costa Beauty"
            onError={e => { e.target.style.display = 'none'; }}
            style={{
              width: '160px',
              marginBottom: '14px',
              filter: 'brightness(0) invert(1) sepia(.15) saturate(.5) brightness(1.4)',
              opacity: .88,
            }}
          />
          <div style={{ color: 'rgba(245,224,220,.5)', fontSize: '10px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
            Gestor de Tráfego
          </div>
          <div style={{ color: 'rgba(245,224,220,.75)', fontSize: '13px', fontWeight: 400 }}>
            Acesse sua conta para continuar
          </div>
        </div>

        {/* Formulário */}
        <div style={{ padding: '32px' }}>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4A2535', marginBottom: '6px', letterSpacing: '.3px' }}>
                Usuário
              </label>
              <input
                type="text"
                autoComplete="username"
                required
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="seu usuário"
                style={{
                  width: '100%',
                  border: '1.5px solid #F0DDD8',
                  borderRadius: '9px',
                  padding: '11px 14px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  color: '#3D1F1A',
                  outline: 'none',
                  background: '#FEF7F5',
                  boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
                onFocus={e => e.target.style.borderColor = '#C98B83'}
                onBlur={e => e.target.style.borderColor = '#F0DDD8'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4A2535', marginBottom: '6px', letterSpacing: '.3px' }}>
                Senha
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  border: '1.5px solid #F0DDD8',
                  borderRadius: '9px',
                  padding: '11px 14px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  color: '#3D1F1A',
                  outline: 'none',
                  background: '#FEF7F5',
                  boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
                onFocus={e => e.target.style.borderColor = '#C98B83'}
                onBlur={e => e.target.style.borderColor = '#F0DDD8'}
              />
            </div>

            {error && (
              <div style={{
                background: '#FADBD8',
                border: '1px solid rgba(231,76,60,.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#8b1c1c',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#B87A92' : '#C98B83',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '13px',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
                letterSpacing: '.3px',
              }}
              onMouseEnter={e => { if (!loading) e.target.style.background = '#7D4A5E'; }}
              onMouseLeave={e => { if (!loading) e.target.style.background = '#C98B83'; }}
            >
              {loading ? 'Entrando...' : 'Entrar →'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <span style={{ fontSize: '11px', color: '#C4A09A' }}>
              Sistema exclusivo • Cris Costa Beauty
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
