require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/platforms', require('./routes/platforms'));
app.use('/api/alerts', require('./routes/alerts'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Modo local: inicia o servidor HTTP
// Modo Vercel (serverless): apenas exporta o app
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
}

module.exports = app;
