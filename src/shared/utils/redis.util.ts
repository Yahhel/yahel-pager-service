import { createClient } from 'redis';
import { promisifySilent } from './helper.util';
import { configs } from '../configs';

export let redisClient: any = null;
export let isRedisConnected: any = null;

const DEFAULT_KEY = 'PAGER:';

export const startRedis = async () => {
  redisClient = createClient({
    ...configs().redisConfig,
    url: process.env.REDIS_URL,
    pingInterval: 1000,
  } as any);

  redisClient.on('error', (err) => {
    isRedisConnected = false;
    console.log('Redis Client Error', err);
  });

  redisClient.on('connect', () => {
    isRedisConnected = true;
    console.log('Redis Connected');
  });

  redisClient.on('end', () => {
    isRedisConnected = false;
    console.log('Redis Connection Closed');
  });

  try {
    await redisClient.connect();
  } catch (e) {
    isRedisConnected = false;
    console.log('Redis Failure Promise Client Error', e);
  }
  return redisClient as any;
};

export const redisSet = async (
  key: string,
  value: Record<string, any>,
  options?: Record<string, any>,
  isFullKey = false,
) => {
  const defaultHeader = isFullKey ? '' : DEFAULT_KEY;
  key = process.env.NODE_ENV + ':' + defaultHeader + key;
  return isRedisConnected
    ? await promisifySilent(
        redisClient.set(key, JSON.stringify(value), options),
        key,
      )
    : null;
};

export const redisGet = async (key: string, isFullKey = false) => {
  const defaultHeader = isFullKey ? '' : DEFAULT_KEY;
  key = process.env.NODE_ENV + ':' + defaultHeader + key;
  const record: any = isRedisConnected
    ? await promisifySilent(redisClient.get(key), key)
    : null;
  if (record) {
    try {
      return JSON.parse(record as any);
    } catch {
      return record;
    }
  }
  return record;
};

export const redisDel = async (key: string, isFullKey = false) => {
  const defaultHeader = isFullKey ? '' : DEFAULT_KEY;
  key = process.env.NODE_ENV + ':' + defaultHeader + key;
  if (isRedisConnected) await promisifySilent(redisClient.del(key), key);
};

export const redisDelMany = async (keys: string[], isFullKey = false) => {
  const defaultHeader = isFullKey ? '' : DEFAULT_KEY;
  if (!keys.length) return;
  const keysAll = keys.map(
    (key) => process.env.NODE_ENV + ':' + defaultHeader + key,
  );
  if (isRedisConnected) await promisifySilent(redisClient.del(keysAll));
};

export const redisSAdd = async (
  key: string,
  value: string | string[],
  isFullKey = false,
) => {
  const defaultHeader = isFullKey ? '' : DEFAULT_KEY;
  const fullKey = process.env.NODE_ENV + ':' + defaultHeader + key;

  return isRedisConnected
    ? await promisifySilent(redisClient?.sAdd(fullKey, value))
    : null;
};

export const redisSRem = async (
  key: string,
  value: string | string[],
  isFullKey = false,
) => {
  const defaultHeader = isFullKey ? '' : DEFAULT_KEY;
  const fullKey = process.env.NODE_ENV + ':' + defaultHeader + key;

  return isRedisConnected
    ? await promisifySilent(redisClient?.sRem(fullKey, value))
    : null;
};

export const redisSMembers = async (key: string, isFullKey = false) => {
  const defaultHeader = isFullKey ? '' : DEFAULT_KEY;
  const fullKey = process.env.NODE_ENV + ':' + defaultHeader + key;

  const result = isRedisConnected
    ? await promisifySilent(redisClient?.sMembers(fullKey))
    : null;

  return result || [];
};

export const redisExpire = async (
  key: string,
  seconds: number,
  isFullKey = false,
) => {
  const defaultHeader = isFullKey ? '' : DEFAULT_KEY;
  const fullKey = process.env.NODE_ENV + ':' + defaultHeader + key;

  return isRedisConnected
    ? await promisifySilent(redisClient?.expire(fullKey, seconds))
    : null;
};

export const redisIncrBy = async (
  key: string,
  increment: number,
  isFullKey = false,
): Promise<number> => {
  const defaultHeader = isFullKey ? '' : DEFAULT_KEY;
  const fullKey = process.env.NODE_ENV + ':' + defaultHeader + key;

  return isRedisConnected
    ? await promisifySilent(redisClient?.incrBy(fullKey, increment))
    : null;
};
