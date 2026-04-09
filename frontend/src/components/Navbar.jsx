import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/campanhas', label: 'Campanhas' },
  { to: '/plataformas', label: 'Plataformas' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  function logout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="font-bold text-blue-600 text-lg">Gestor de Tráfego</span>
          {LINKS.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-medium ${location.pathname === l.to ? 'text-blue-600 border-b-2 border-blue-600 pb-0.5' : 'text-gray-600 hover:text-blue-600'}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500">Sair</button>
      </div>
    </nav>
  );
}
