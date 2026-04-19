require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

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

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Servir frontend estático (produção)
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  // Assets com hash no nome: cache longo (imutáveis)
  app.use('/assets', express.static(path.join(frontendDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // Demais arquivos estáticos sem cache agressivo
  app.use(express.static(frontendDist, { maxAge: 0 }));

  // SPA fallback: index.html nunca cacheado — garante que o browser
  // sempre busca o HTML atual após novo deploy
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Modo local: inicia o servidor HTTP
// Modo Vercel (serverless): apenas exporta o app
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
}

module.exports = app;
