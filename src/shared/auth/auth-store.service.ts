import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { configs } from '../configs';
import { AuthCodePurpose, AuthSession, UserRole } from '../interfaces';
import { isRedisConnected, redisClient, redisKey, safeEqual } from '../utils';

const sessionKey = (sid: string) => redisKey(`auth:session:${sid}`);
const userSessionsKey = (userId: string) =>
  redisKey(`auth:user-sessions:${userId}`);
const codeKey = (purpose: AuthCodePurpose, id: string) =>
  redisKey(`auth:code:${purpose}:${id}`);
const attemptsKey = (purpose: AuthCodePurpose, id: string) =>
  redisKey(`auth:attempts:${purpose}:${id}`);
const twoFactorSetupKey = (userId: string) =>
  redisKey(`auth:2fa-setup:${userId}`);

const serializeSession = (session: Partial<AuthSession>) =>
  Object.entries(session).reduce(
    (acc, [key, value]) => {
      acc[key] = Array.isArray(value) ? JSON.stringify(value) : String(value);
      return acc;
    },
    {} as Record<string, string>,
  );

@Injectable()
export class AuthStoreService {
  private get client() {
    if (!isRedisConnected)
      throw new ServiceUnavailableException(
        'Authentication service is temporarily unavailable',
      );
    return redisClient;
  }

  /** Call before writes to Mongo that would be orphaned if a session can't be created. */
  assertAvailable() {
    void this.client;
  }

  private get sessionTtl() {
    return configs().auth.refreshTokenTtlSeconds;
  }

  async createSession(sid: string, session: AuthSession) {
    const key = sessionKey(sid);
    const userKey = userSessionsKey(session.userId);
    await this.client
      .multi()
      .hSet(key, serializeSession(session))
      .expire(key, this.sessionTtl)
      .sAdd(userKey, sid)
      .expire(userKey, this.sessionTtl)
      .exec();
  }

  async getSession(sid: string): Promise<AuthSession | null> {
    const data = await this.client.hGetAll(sessionKey(sid));
    if (!data?.userId) return null;
    return {
      ...data,
      roles: JSON.parse(data.roles || '[]'),
      restrictions: JSON.parse(data.restrictions || '[]'),
    } as AuthSession;
  }

  async rotateSession(
    sid: string,
    userId: string,
    update: Pick<AuthSession, 'jti' | 'refreshTokenHash'>,
  ) {
    const key = sessionKey(sid);
    const userKey = userSessionsKey(userId);
    await this.client
      .multi()
      .hSet(key, serializeSession(update))
      .expire(key, this.sessionTtl)
      .expire(userKey, this.sessionTtl)
      .exec();
  }

  async updateSession(sid: string, update: Partial<AuthSession>) {
    const key = sessionKey(sid);
    // Only patch live sessions so an expired key is never recreated without a TTL
    await this.client.eval(
      "if redis.call('EXISTS', KEYS[1]) == 1 then return redis.call('HSET', KEYS[1], unpack(ARGV)) end return 0",
      {
        keys: [key],
        arguments: Object.entries(serializeSession(update)).flat(),
      },
    );
  }

  async revokeSession(userId: string, sid: string) {
    await this.client
      .multi()
      .del(sessionKey(sid))
      .sRem(userSessionsKey(userId), sid)
      .exec();
  }

  async revokeUserSessions(userId: string, exceptSid?: string) {
    const userKey = userSessionsKey(userId);
    const sids: string[] = await this.client.sMembers(userKey);
    const revoked = sids.filter((sid) => sid !== exceptSid);
    if (!revoked.length) return;
    await this.client
      .multi()
      .del(revoked.map(sessionKey))
      .sRem(userKey, revoked)
      .exec();
  }

  async syncUserRoles(userId: string, roles: UserRole[]) {
    const sids: string[] = await this.client.sMembers(userSessionsKey(userId));
    if (!sids.length) return;
    const multi = this.client.multi();
    sids.forEach((sid) =>
      multi.eval(
        "if redis.call('EXISTS', KEYS[1]) == 1 then return redis.call('HSET', KEYS[1], 'roles', ARGV[1]) end return 0",
        { keys: [sessionKey(sid)], arguments: [JSON.stringify(roles)] },
      ),
    );
    await multi.exec();
  }

  async setCode(
    purpose: AuthCodePurpose,
    id: string,
    code: string,
    ttlSeconds: number,
  ) {
    await this.client
      .multi()
      .set(codeKey(purpose, id), code, { EX: ttlSeconds })
      .del(attemptsKey(purpose, id))
      .exec();
  }

  async verifyCode(purpose: AuthCodePurpose, id: string, code: string) {
    const key = codeKey(purpose, id);
    const stored: string = await this.client.get(key);
    if (!stored) return false;

    if (safeEqual(stored, code)) {
      await this.client.multi().del(key).del(attemptsKey(purpose, id)).exec();
      return true;
    }

    const attempts = await this.recordFailedAttempt(purpose, id);
    if (attempts >= configs().auth.maxCodeAttempts) await this.client.del(key);
    return false;
  }

  async recordFailedAttempt(
    purpose: AuthCodePurpose,
    id: string,
    ttlSeconds = 15 * 60,
  ): Promise<number> {
    const key = attemptsKey(purpose, id);
    const [attempts] = await this.client
      .multi()
      .incr(key)
      .expire(key, ttlSeconds)
      .exec();
    return Number(attempts);
  }

  async getFailedAttempts(purpose: AuthCodePurpose, id: string) {
    return Number((await this.client.get(attemptsKey(purpose, id))) || 0);
  }

  async setTwoFactorSetup(userId: string, secret: string) {
    await this.client.set(twoFactorSetupKey(userId), secret, {
      EX: configs().auth.twoFactorSetupTtlSeconds,
    });
  }

  async getTwoFactorSetup(userId: string): Promise<string | null> {
    return this.client.get(twoFactorSetupKey(userId));
  }

  async clearTwoFactorSetup(userId: string) {
    await this.client.del(twoFactorSetupKey(userId));
  }
}
