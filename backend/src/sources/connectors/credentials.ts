import * as crypto from 'crypto';

// AES-256-GCM keyed off the CREDENTIALS_KEY env var. The key is read once
// at module load (caching is fine — rotation requires a process restart
// anyway because every existing ciphertext was bound to the previous key).
//
// Wire format: `<iv>.<ciphertext>.<tag>`, all base64. GCM means we get
// authenticated encryption — tampering with the ciphertext or tag fails
// `setAuthTag`/`final` instead of returning bogus plaintext.

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function loadKey(): Buffer {
  const hex = process.env.CREDENTIALS_KEY;
  if (!hex) {
    throw new Error(
      'CREDENTIALS_KEY env var is required to encrypt/decrypt source ' +
      'credentials. Generate one with `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"` ' +
      'and add it to backend/.env (or copy from backend/.env.example).',
    );
  }
  if (hex.length !== 64) {
    throw new Error(
      `CREDENTIALS_KEY must be 64 hex chars (32 bytes); got ${hex.length}.`,
    );
  }
  return Buffer.from(hex, 'hex');
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), enc.toString('base64'), tag.toString('base64')].join('.');
}

export function decryptSecret(encoded: string): string {
  const parts = encoded.split('.');
  if (parts.length !== 3) {
    throw new Error('Encrypted credential is not in the expected `iv.ct.tag` format');
  }
  const [ivB64, encB64, tagB64] = parts;
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
