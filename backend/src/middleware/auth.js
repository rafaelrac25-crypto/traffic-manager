/**
 * AUTENTICAÇÃO JWT — atualmente DESATIVADA.
 *
 * Sistema é uso interno (uma única usuária, sem login).
 * Este middleware NÃO está registrado em nenhuma rota do index.js.
 *
 * Para reativar: registrar via app.use('/api', authMiddleware) ou em rotas específicas.
 * Antes de reativar, conferir que routes/auth.js (POST /setup, /login) está consistente.
 */
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
};
