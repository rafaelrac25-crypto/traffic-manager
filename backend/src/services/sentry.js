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

function initSentry() {
  if (initialized) return false;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

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
  });
  initialized = true;
  console.log('[sentry] inicializado em modo', process.env.NODE_ENV || 'development');
  return true;
}

/* Setup do error handler do Express — DEVE ser chamado depois de todas
   as rotas, antes de qualquer middleware de erro custom. */
function setupExpressErrorHandler(app) {
  if (!initialized) return;
  Sentry.setupExpressErrorHandler(app);
}

module.exports = {
  initSentry,
  setupExpressErrorHandler,
  Sentry,
};
