const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey() {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) throw new Error('TOKEN_ENC_KEY ausente no ambiente');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY deve ser 32 bytes em base64');
  return key;
}

function encrypt(plaintext) {
  if (plaintext == null) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(combined) {
  if (!combined) return null;
  const [ivB64, tagB64, encB64] = String(combined).split(':');
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Formato de token encriptado inválido');
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
