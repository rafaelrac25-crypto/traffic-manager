import React, { createContext, useContext, useEffect } from 'react';

/* Tema fixo em dark — o modo light foi removido por decisao do Rafa.
   Mantemos useTheme() retornando { isDark: true, toggle: noop } pra
   nao quebrar nenhum componente existente que importa esse hook. */

const ThemeContext = createContext({ isDark: true, toggle: () => {} });

export function ThemeProvider({ children }) {
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('ccb_theme', 'dark');
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark: true, toggle: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return ctx || { isDark: true, toggle: () => {} };
}
