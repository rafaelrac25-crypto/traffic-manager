require('dotenv').config();

/* Sentry deve ser inicializado ANTES de qualquer require que possa lançar
   ou de criar o app — assim erros em import/setup também são capturados.
   Se SENTRY_DSN não estiver setado, vira no-op silencioso. */
const { initSentry, setupExpressErrorHandler } = require('./services/sentry');
initSentry();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({
  limit: '30mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Remove prefixo /_/backend das URLs (Vercel proxy)
app.use((req, res, next) => {
  if (req.url.startsWith('/_/backend')) {
    req.url = req.url.replace('/_/backend', '');
  }
  next();
});

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/platforms', require('./routes/platforms'));
app.use('/api/history', require('./routes/history'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/health', require('./routes/health'));
app.use('/api/reports', require('./routes/reports'));
app.use('/webhooks', require('./routes/webhooks'));

// Servir frontend estático (produção)
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  // Assets com hash no nome: cache longo (imutáveis)
  app.use('/assets', express.static(path.join(frontendDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // Demais arquivos estáticos — index: false garante que "/" caia
  // no app.get('*') abaixo (pra garantir no-store no index.html)
  app.use(express.static(frontendDist, {
    maxAge: 0,
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));

  // SPA fallback: index.html nunca cacheado — garante que o browser
  // sempre busca o HTML atual após novo deploy (inclui "/" graças ao index:false acima)
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

/* Sentry error handler DEVE ser registrado depois de todas as rotas/middlewares
   pra capturar erros que escapam do try/catch dos handlers. No-op se DSN
   não estiver setado. */
setupExpressErrorHandler(app);

// Modo local: inicia o servidor HTTP
// Modo Vercel (serverless): apenas exporta o app
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
}

module.exports = app;
