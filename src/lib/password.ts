import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hash de contraseñas/PINs con scrypt (nativo de Node, sin dependencias).
 * Formato:  scrypt$<salt_hex>$<hash_hex>
 *
 * `verifyPassword` acepta además valores LEGACY en texto plano (sin prefijo `scrypt$`) para poder
 * migrar de forma transparente: tras un login/validación correcta se re-guarda hasheado.
 */

const PREFIX = 'scrypt$';
const KEYLEN = 32;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN);
  return `${PREFIX}${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function isHashed(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(PREFIX);
}

export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  if (!isHashed(stored)) {
    // Legacy (texto plano): comparación en tiempo constante
    const a = Buffer.from(plain);
    const b = Buffer.from(stored);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const [, saltHex, hashHex] = stored.split('$');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(plain, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
