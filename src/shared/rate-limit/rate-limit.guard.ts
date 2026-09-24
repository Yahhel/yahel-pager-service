import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';
import {
  RateProfileType,
  TenantPlan,
} from '@shared/interfaces/rate-limit.type';
import {
  RATE_PROFILE_METADATA_KEY,
  SKIP_RATE_LIMIT_METADATA_KEY,
  getAdjustedLimit,
  getRateProfileConfig,
} from '@shared/configs/rate-profiles.config';
import { getIpAddress } from '@shared/utils/helper.util';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const profile =
      this.reflector.getAllAndOverride<RateProfileType>(
        RATE_PROFILE_METADATA_KEY,
        [context.getHandler(), context.getClass()],
      ) || 'default';

    const user = request.user;
    const tenant = request.tenant;
    const ip = getIpAddress(request);
    const endpoint = `${request.method}:${request.route?.path || request.url}`;

    const rateLimitContext = {
      tenantId: tenant?.id,
      tenantPlan: tenant?.plan as TenantPlan,
      userId: user?.id,
      ip,
      integrationId: request.headers['x-integration-id'],
      profile,
      endpoint,
    };

    const result = await this.rateLimitService.checkRateLimit(rateLimitContext);
    const config = getRateProfileConfig(profile);
    const limit = getAdjustedLimit(
      config.limit,
      rateLimitContext.tenantPlan || TenantPlan.STARTER,
    );

    const resetTime =
      Math.ceil(Date.now() / 1000) + Math.ceil(result.msBeforeNext / 1000);

    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, result.remainingPoints),
    );
    response.setHeader('X-RateLimit-Reset', resetTime);
    response.setHeader('X-RateLimit-Window', config.windowSeconds);

    if (!result.allowed) {
      const retryAfter = Math.ceil(result.msBeforeNext / 1000);
      response.setHeader('Retry-After', retryAfter);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter,
          limit,
          remaining: 0,
          reset: resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
