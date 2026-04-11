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

  const inp = {
    width: '100%',
    border: '1.5px solid #EDCECE',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '13px',
    fontFamily: 'inherit',
    color: '#3D1F1A',
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box',
    transition: 'border-color .15s, box-shadow .15s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5E0E0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
      padding: '20px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        boxShadow: '0 24px 64px rgba(180,80,100,.13)',
        width: '100%',
        maxWidth: '380px',
        padding: '40px 36px 32px',
        animation: 'fadeIn .4s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ marginBottom: '4px', fontSize: '13px', color: '#C98B83', letterSpacing: '1px' }}>✦</div>
          <img
            src="/logo.png"
            alt="Cris Costa Beauty"
            onError={e => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
            style={{ height: '52px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
          />
          <div style={{ display: 'none', fontSize: '26px', fontWeight: 700, color: '#4A2535', letterSpacing: '-0.5px', fontFamily: 'Georgia, serif' }}>
            Cris<span style={{ color: '#C98B83' }}>Costa</span>
          </div>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#C4A09A', marginTop: '10px' }}>
            Gestor de Tráfego
          </div>
          <div style={{ fontSize: '12px', color: '#B8A0A0', marginTop: '6px', fontWeight: 400 }}>
            Insira suas credenciais para continuar
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#7D4A5E', marginBottom: '6px', letterSpacing: '.4px' }}>
              Usuário
            </label>
            <input
              type="text"
              autoComplete="username"
              required
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="seu usuário"
              style={inp}
              onFocus={e => { e.target.style.borderColor = '#C98B83'; e.target.style.boxShadow = '0 0 0 3px rgba(201,139,131,.12)'; }}
              onBlur={e => { e.target.style.borderColor = '#EDCECE'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#7D4A5E', marginBottom: '6px', letterSpacing: '.4px' }}>
              Senha
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              style={inp}
              onFocus={e => { e.target.style.borderColor = '#C98B83'; e.target.style.boxShadow = '0 0 0 3px rgba(201,139,131,.12)'; }}
              onBlur={e => { e.target.style.borderColor = '#EDCECE'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {error && (
            <div style={{
              background: '#FADBD8',
              border: '1px solid rgba(231,76,60,.25)',
              borderRadius: '9px',
              padding: '10px 13px',
              fontSize: '12px',
              color: '#8b1c1c',
              marginBottom: '16px',
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#D4A4A0' : '#C98B83',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '13px',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background .15s, transform .1s',
              letterSpacing: '.5px',
            }}
            onMouseEnter={e => { if (!loading) e.target.style.background = '#B8776F'; }}
            onMouseLeave={e => { if (!loading) e.target.style.background = '#C98B83'; }}
          >
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '22px' }}>
          <span style={{ fontSize: '10px', color: '#D4B0B0', letterSpacing: '.3px' }}>
            Sistema exclusivo · Cris Costa Beauty
          </span>
        </div>
      </div>
    </div>
  );
}
