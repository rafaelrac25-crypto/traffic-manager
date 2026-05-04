import React, { createContext, useContext, useEffect } from 'react';

/* Tema fixo em dark — o modo light foi removido por decisao do Rafa.
   toggle removido: era noop e só gerava ruído no código. */

const ThemeContext = createContext({ isDark: true });

export function ThemeProvider({ children }) {
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('ccb_theme', 'dark');
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return ctx || { isDark: true };
}
