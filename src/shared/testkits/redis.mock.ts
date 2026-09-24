// In-memory stand-in for redis.util, used with jest.mock('<path>/utils/redis.util', ...)
const store = new Map<string, any>();

export const redisUtilMock = {
  store,
  isRedisConnected: true,
  redisClient: null,
  startRedis: jest.fn(),
  redisSet: jest.fn(async (key: string, value: any) => {
    store.set(key, JSON.parse(JSON.stringify(value)));
  }),
  redisGet: jest.fn(async (key: string) => store.get(key) ?? null),
  redisDel: jest.fn(async (key: string) => {
    store.delete(key);
  }),
  redisDelMany: jest.fn(async (keys: string[]) => {
    keys.forEach((key) => store.delete(key));
  }),
  redisSAdd: jest.fn(async (key: string, value: string | string[]) => {
    const set: Set<string> = store.get(key) ?? new Set();
    [value].flat().forEach((v) => set.add(v));
    store.set(key, set);
  }),
  redisSRem: jest.fn(async (key: string, value: string | string[]) => {
    const set: Set<string> = store.get(key);
    [value].flat().forEach((v) => set?.delete(v));
  }),
  redisSMembers: jest.fn(async (key: string) => [...(store.get(key) ?? [])]),
  redisExpire: jest.fn(async () => 1),
  redisIncrBy: jest.fn(async (key: string, increment: number) => {
    const next = (store.get(key) ?? 0) + increment;
    store.set(key, next);
    return next;
  }),
};
