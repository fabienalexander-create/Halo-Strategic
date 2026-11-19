import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Encrypts the follow-up link token held on a queued META_FOLLOW_UP text, so every retry of that
// text sends the same link (Fabien, 2026-11-19) without the working token ever sitting in the
// database in readable form.
//
// AES-256-GCM: authenticated, so a tampered value fails to decrypt rather than yielding a wrong
// link. A fresh random 96-bit IV per encryption. The additional authenticated data binds each
// ciphertext to its own row ("lead_phone_verification:<id>"), so a value copied onto another row
// will not decrypt there either. Every failure returns null; callers fail closed (never send).
//
// Key: SMS_LINK_ENCRYPTION_KEY, 32 random bytes, base64. Generate with: openssl rand -base64 32

const VERSION = 'v1';

export function linkEncryptionKey(): Buffer | null {
  const raw = process.env.SMS_LINK_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  return key.length === 32 ? key : null;
}

export function linkTokenAad(verificationId: number): string {
  return `lead_phone_verification:${verificationId}`;
}

export function encryptLinkToken(rawToken: string, key: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptLinkToken(encrypted: unknown, key: Buffer, aad: string): string | null {
  if (typeof encrypted !== 'string') return null;
  const parts = encrypted.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
