import { Injectable } from '@nestjs/common';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import {
  RateProfileConfig,
  RateProfileType,
  RateLimitResult,
  RateLimitContext,
  TenantPlan,
} from '@shared/interfaces/rate-limit.type';
import {
  RATE_LIMIT_KEY_PREFIX,
  getAdjustedLimit,
  getRateProfileConfig,
} from '@shared/configs/rate-profiles.config';
import { redisClient } from '@shared/utils/redis.util';

type RateLimiter = RateLimiterMemory | RateLimiterRedis;

@Injectable()
export class RateLimitService {
  private limiters: Map<string, RateLimiter> = new Map();
  private useRedis: boolean;

  constructor() {
    this.useRedis = process.env.RATE_LIMIT_STORAGE === 'redis';
  }

  private getLimiterKey(profile: RateProfileType, plan: TenantPlan): string {
    return `${profile}:${plan}`;
  }

  private getLimiter(profile: RateProfileType, plan: TenantPlan): RateLimiter {
    const limiterKey = this.getLimiterKey(profile, plan);

    if (this.limiters.has(limiterKey)) {
      return this.limiters.get(limiterKey);
    }

    const config = getRateProfileConfig(profile);
    const adjustedLimit = getAdjustedLimit(config.limit, plan);

    let limiter: RateLimiter;

    if (this.useRedis && redisClient) {
      limiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: `${RATE_LIMIT_KEY_PREFIX}:${profile}:${plan}`,
        points: adjustedLimit,
        duration: config.windowSeconds,
        inMemoryBlockOnConsumed: adjustedLimit + 10,
      });
    } else {
      limiter = new RateLimiterMemory({
        points: adjustedLimit,
        duration: config.windowSeconds,
      });
    }

    this.limiters.set(limiterKey, limiter);
    return limiter;
  }

  private buildRateLimitKey(
    context: RateLimitContext,
    config: RateProfileConfig,
  ): string {
    const parts: string[] = [context.endpoint];

    if (config.keyStrategy.includeTenantId && context.tenantId) {
      parts.push(`tenant:${context.tenantId}`);
    }

    if (config.keyStrategy.includeTenantPlan && context.tenantPlan) {
      parts.push(`plan:${context.tenantPlan}`);
    }

    if (config.keyStrategy.includeUserId && context.userId) {
      parts.push(`user:${context.userId}`);
    }

    if (config.keyStrategy.includeIp && context.ip) {
      parts.push(`ip:${context.ip}`);
    }

    if (config.keyStrategy.includeIntegrationId && context.integrationId) {
      parts.push(`integration:${context.integrationId}`);
    }

    return parts.join(':');
  }

  async checkRateLimit(context: RateLimitContext): Promise<RateLimitResult> {
    const plan = context.tenantPlan || TenantPlan.STARTER;
    const config = getRateProfileConfig(context.profile);
    const limiter = this.getLimiter(context.profile, plan);
    const key = this.buildRateLimitKey(context, config);

    try {
      const result = await limiter.consume(key, 1);

      return {
        allowed: true,
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
        consumedPoints: result.consumedPoints,
        isFirstInDuration: result.isFirstInDuration,
      };
    } catch (rejRes: any) {
      const adjustedLimit = getAdjustedLimit(config.limit, plan);
      return {
        allowed: false,
        remainingPoints: rejRes.remainingPoints || 0,
        msBeforeNext: rejRes.msBeforeNext || config.windowSeconds * 1000,
        consumedPoints: rejRes.consumedPoints || adjustedLimit,
        isFirstInDuration: false,
      };
    }
  }

  async getRateLimitInfo(
    context: RateLimitContext,
  ): Promise<Omit<RateLimitResult, 'allowed'>> {
    const plan = context.tenantPlan || TenantPlan.STARTER;
    const config = getRateProfileConfig(context.profile);
    const limiter = this.getLimiter(context.profile, plan);
    const key = this.buildRateLimitKey(context, config);

    try {
      const result = await limiter.get(key);

      if (!result) {
        const limit = getAdjustedLimit(config.limit, plan);
        return {
          remainingPoints: limit,
          msBeforeNext: 0,
          consumedPoints: 0,
          isFirstInDuration: true,
        };
      }

      return {
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
        consumedPoints: result.consumedPoints,
        isFirstInDuration: false,
      };
    } catch {
      const limit = getAdjustedLimit(config.limit, plan);
      return {
        remainingPoints: limit,
        msBeforeNext: 0,
        consumedPoints: 0,
        isFirstInDuration: true,
      };
    }
  }
}
