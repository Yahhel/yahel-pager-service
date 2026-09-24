import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { configs } from '../configs';
import { isTestEnv } from './helper.util';

export const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('hex');

export const safeEqual = (a?: string, b?: string) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

export const generateOtpCode = () =>
  isTestEnv()
    ? configs().auth.testToken
    : randomInt(100_000, 1_000_000).toString();

export const isDuplicateKeyError = (e: any) => e?.code === 11000;
