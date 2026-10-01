import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';
import { GoneException, UnauthorizedException } from '@nestjs/common';
import { ApiReq, FilePublicUrlPayload } from '@shared/interfaces';
import { getBaseUrl } from './helper.util';
import { redisGet, redisSet, redisDel } from './redis.util';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  // No hardcoded fallback: a known default secret would let anyone forge file links
  const secret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET is not set');
  return createHash('sha256').update(secret).digest();
}

/**
 * Generic encrypt function using AES-256-GCM
 */
export function encrypt(data: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string | null {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encrypted] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return null;
  }
}

export function encryptObject<T = any>(data: T): string {
  return encrypt(JSON.stringify(data));
}

export function decryptObject<T = any>(encryptedData: string): T | null {
  const decrypted = decrypt(encryptedData);
  if (!decrypted) return null;

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return null;
  }
}

/**
 * @param ttlSeconds  How long the token is valid. Defaults to 300 (5 minutes).
 * @param ott         One-time token flag. Use false for audio/video, whose players
 *                    make several range requests with the same link. Defaults to true.
 */
export function buildFileToken(
  fileId: string,
  ttlSeconds = 300,
  ott = true,
): string {
  const iat = Date.now();
  const exp = iat + ttlSeconds * 1000;
  return encryptObject<FilePublicUrlPayload>({ fileId, iat, exp, ott });
}

/**
 * Injects a `public_url` onto a lean File object or a bare file ID string.
 * URL format: <baseUrl>/api/v1/files/stream/<fileId>?fk=<signed_token>
 * The token is AES-256-GCM encrypted, time-limited, and (by default) one-time-use.
 *
 * @example injectFilePublicUrl('69deaf80f0067e7955e08188', req)
 * @example injectFilePublicUrl({ _id: '...', metadata: {...} }, req)
 */
export function injectFilePublicUrl(
  file: string,
  req: ApiReq,
  options?: { ttlSeconds?: number; ott?: boolean },
): { _id: string; public_url: string };
export function injectFilePublicUrl<T extends { _id: any }>(
  file: T,
  req: ApiReq,
  options?: { ttlSeconds?: number; ott?: boolean },
): T & { public_url: string };
export function injectFilePublicUrl<T extends { _id: any }>(
  file: T | string,
  req: ApiReq,
  options?: { ttlSeconds?: number; ott?: boolean },
): (T & { public_url: string }) | { _id: string; public_url: string } {
  const base = typeof file === 'string' ? file : file._id.toString();
  const token = buildFileToken(base, options?.ttlSeconds, options?.ott);
  const public_url = `${getBaseUrl(req)}/api/v1/files/stream/${base}?fk=${encodeURIComponent(token)}`;
  const source = typeof file === 'string' ? { _id: file } : file;
  return { ...source, public_url };
}

export function injectFilePublicUrls<T extends { _id: any }>(
  files: T[],
  req: ApiReq,
  options?: { ttlSeconds?: number; ott?: boolean },
): (T & { public_url: string })[] {
  return files.map((file) => injectFilePublicUrl(file, req, options));
}

const FILE_TOKEN_KEY = (fingerprint: string) => `FILE_TOKEN:${fingerprint}`;

/**
 * Validates a signed file token and claims it in Redis.
 * Returns token metadata needed for post-stream cleanup.
 * Throws UnauthorizedException or GoneException on any failure.
 */
export async function validateAndConsumeFileToken(
  rawToken: string,
  fileId: string,
): Promise<{ ott: boolean; fingerprint: string; exp: number }> {
  const payload = decryptObject<FilePublicUrlPayload>(rawToken);
  if (!payload || payload.fileId !== fileId)
    throw new UnauthorizedException('Invalid token');
  if (Date.now() > payload.exp) throw new GoneException('Token expired');

  const fingerprint = createHash('sha256').update(rawToken).digest('hex');
  const key = FILE_TOKEN_KEY(fingerprint);
  const ttlSeconds = Math.max(Math.ceil((payload.exp - Date.now()) / 1000), 1);

  const isOTT = payload.ott ?? true;
  if (isOTT) {
    // SET NX is atomic, so two simultaneous requests can't both claim the token
    const claimed = await redisSet(
      key,
      { status: 'used' },
      { EX: ttlSeconds, NX: true },
    );
    if (claimed !== 'OK') throw new GoneException('Token already used');
  } else {
    // Multi-use tokens stay valid until exp unless explicitly destroyed
    const existing = await redisGet(key);
    if (existing?.status === 'destroyed')
      throw new GoneException('Token already used');
  }

  return { ott: isOTT, fingerprint, exp: payload.exp };
}

/**
 * Destroys a consumed file token so it can never be reused:
 * 1. Deletes the 'used' marker (ott memory cleanup).
 * 2. Re-sets the key as 'destroyed' with the remaining TTL so any
 *    subsequent attempt is rejected for the full original token lifetime.
 */
export async function destroyFileToken(
  fingerprint: string,
  exp: number,
): Promise<void> {
  const key = FILE_TOKEN_KEY(fingerprint);
  const remainingTtl = Math.max(Math.ceil((exp - Date.now()) / 1000), 1);
  await redisDel(key);
  await redisSet(key, { status: 'destroyed' }, { EX: remainingTtl });
}
