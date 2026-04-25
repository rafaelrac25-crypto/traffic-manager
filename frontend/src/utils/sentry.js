/**
 * Inicialização do Sentry — captura erros de runtime no painel.
 *
 * Se VITE_SENTRY_DSN não estiver setado, o Sentry inicializa em modo no-op
 * (não envia nada). Isso permite o app rodar localmente sem Sentry e em
 * produção com Sentry, sem mexer no código — basta a env var existir.
 *
 * Como ativar:
 *   1. Criar projeto em https://sentry.io (free tier sobra pro tamanho do app)
 *   2. Copiar DSN do projeto
 *   3. Adicionar `VITE_SENTRY_DSN` em Vercel → Settings → Environment Variables
 *   4. Redeploy automático já cobre
 */

import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; /* Sem DSN, modo no-op silencioso */

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    /* 10% das navegações geram traces de performance — suficiente pra
       diagnóstico sem estourar quota free tier. */
    tracesSampleRate: 0.1,
    /* Replay desligado em sessão normal; só grava sessão quando há erro. */
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    /* Filtra ruído conhecido — ajuda a manter quota saudável */
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  });
  initialized = true;
}

/* Re-exporta o ErrorBoundary do Sentry pra quem quiser usar em vez do
   custom em main.jsx. */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
export { Sentry };
