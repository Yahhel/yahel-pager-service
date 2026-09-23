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
) => {
  key = process.env.NODE_ENV + ':' + DEFAULT_KEY + key;
  return isRedisConnected
    ? await promisifySilent(
        redisClient.set(key, JSON.stringify(value), options),
        key,
      )
    : null;
};

export const redisGet = async (key: string) => {
  key = process.env.NODE_ENV + ':' + DEFAULT_KEY + key;
  const record: any = isRedisConnected
    ? await promisifySilent(redisClient.get(key), key)
    : null;
  if (record) return JSON.parse(record as any);
  return record;
};

export const redisDel = async (key: string) => {
  key = process.env.NODE_ENV + ':' + DEFAULT_KEY + key;
  isRedisConnected && (await promisifySilent(redisClient.del(key), key));
};
