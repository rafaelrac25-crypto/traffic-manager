/**
 * Inicialização do Sentry pro backend Express.
 *
 * Se SENTRY_DSN não estiver setado, vira no-op silencioso (não envia nada).
 *
 * Como ativar:
 *   1. Criar projeto em https://sentry.io (free tier sobra)
 *   2. Copiar DSN do projeto Node
 *   3. Adicionar `SENTRY_DSN` em Vercel → Settings → Environment Variables
 *   4. Redeploy automático já cobre
 */

const Sentry = require('@sentry/node');

let initialized = false;

/**
 * Sanitiza URLs/strings que possam ter token Meta antes de gravar
 * em breadcrumb/error context. Cobre:
 *   - graph.facebook.com/.../oauth/access_token?fb_exchange_token=... (token + app_secret)
 *   - qualquer URL com access_token=, client_secret=, fb_exchange_token=
 */
function sanitizeUrl(url) {
  if (typeof url !== 'string') return url;
  return url
    .replace(/access_token=[^&]+/gi, 'access_token=[REDACTED]')
    .replace(/client_secret=[^&]+/gi, 'client_secret=[REDACTED]')
    .replace(/fb_exchange_token=[^&]+/gi, 'fb_exchange_token=[REDACTED]')
    .replace(/code=[^&]+/gi, 'code=[REDACTED]'); /* OAuth code também é sensível */
}

function initSentry() {
  if (initialized) return false;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  /* Try/catch defensivo — se DSN é malformado (typo na Vercel), Sentry.init
     lança SyntaxError sincronamente e derrubaria o boot do app inteiro.
     Falhamos silencioso e logamos pra Rafa investigar. */
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      /* 10% das requests geram traces — suficiente pra investigação sem
         estourar quota free tier. */
      tracesSampleRate: 0.1,
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration(),
      ],
      /* Filtra ruído conhecido */
      ignoreErrors: [
        'ECONNRESET',
        'EHOSTUNREACH',
      ],
      /* Sanitiza tokens em breadcrumbs HTTP — sem isso, URLs do refresh
         token (`?fb_exchange_token=...&client_secret=...`) iriam em texto
         puro pro Sentry caso a request falhasse. */
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb?.category === 'http' || breadcrumb?.category === 'fetch') {
          if (breadcrumb.data?.url) {
            breadcrumb.data.url = sanitizeUrl(breadcrumb.data.url);
          }
        }
        return breadcrumb;
      },
      /* Sanitiza request URL quando erro acontece numa rota que recebeu
         token via querystring (raro mas possível). */
      beforeSend(event) {
        if (event.request?.url) {
          event.request.url = sanitizeUrl(event.request.url);
        }
        if (event.request?.query_string) {
          event.request.query_string = sanitizeUrl(event.request.query_string);
        }
        return event;
      },
    });
    initialized = true;
    console.log('[sentry] inicializado em modo', process.env.NODE_ENV || 'development');
    return true;
  } catch (e) {
    console.error('[sentry] falha ao inicializar (DSN malformado?):', e.message);
    return false;
  }
}

/* Setup do error handler do Express — DEVE ser chamado depois de todas
   as rotas, antes de qualquer middleware de erro custom. */
function setupExpressErrorHandler(app) {
  if (!initialized) return;
  try {
    Sentry.setupExpressErrorHandler(app);
  } catch (e) {
    console.error('[sentry] falha ao registrar error handler:', e.message);
  }
}

module.exports = {
  initSentry,
  setupExpressErrorHandler,
  sanitizeUrl,
  Sentry,
};
