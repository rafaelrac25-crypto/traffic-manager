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

/* Sanitiza URLs que possam conter token Meta antes de gravar em
   breadcrumb. Mesma proteção do backend (sentry.js). */
function sanitizeUrl(url) {
  if (typeof url !== 'string') return url;
  return url
    .replace(/access_token=[^&]+/gi, 'access_token=[REDACTED]')
    .replace(/client_secret=[^&]+/gi, 'client_secret=[REDACTED]')
    .replace(/fb_exchange_token=[^&]+/gi, 'fb_exchange_token=[REDACTED]')
    .replace(/code=[^&]+/gi, 'code=[REDACTED]');
}

export function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; /* Sem DSN, modo no-op silencioso */

  /* Try/catch defensivo — DSN malformado lança SyntaxError sincronamente
     e derrubaria o React mount. Falhamos silencioso e logamos. */
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: 'traffic-manager@1.0.0',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
      ],
      /* Sanitiza URLs em breadcrumbs HTTP — protege contra vazamento de
         token Meta caso alguma chamada de fetch falhe e seja capturada. */
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb?.category === 'fetch' || breadcrumb?.category === 'xhr') {
          if (breadcrumb.data?.url) {
            breadcrumb.data.url = sanitizeUrl(breadcrumb.data.url);
          }
        }
        return breadcrumb;
      },
      beforeSend(event) {
        if (event.request?.url) event.request.url = sanitizeUrl(event.request.url);
        return event;
      },
    });
    initialized = true;
  } catch (e) {
    console.error('[sentry] falha ao inicializar (DSN malformado?):', e?.message || e);
  }
}

/* Re-exporta o ErrorBoundary do Sentry pra quem quiser usar em vez do
   custom em main.jsx. */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
export { Sentry };
