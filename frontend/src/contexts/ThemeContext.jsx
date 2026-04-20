import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ isDark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      /* Migração one-shot da chave antiga sem prefixo */
      const legacy = localStorage.getItem('theme');
      if (legacy != null && localStorage.getItem('ccb_theme') == null) {
        localStorage.setItem('ccb_theme', legacy);
        localStorage.removeItem('theme');
      }
      return localStorage.getItem('ccb_theme') === 'dark';
    } catch { return false; }
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      localStorage.setItem('ccb_theme', isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggle: () => setIsDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return ctx || { isDark: false, toggle: () => {} };
}
