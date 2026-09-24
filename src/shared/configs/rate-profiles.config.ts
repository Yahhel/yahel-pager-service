import {
  RateProfileConfig,
  RateProfileType,
  RateLimitAction,
  TenantPlan,
} from '@shared/interfaces/rate-limit.type';

export { TenantPlan, RateProfileType };

/**
 * Rate Profile Configurations
 * Base configurations that can be overridden per tenant or plan
 */
export const RATE_PROFILE_CONFIGS: Record<RateProfileType, RateProfileConfig> =
  {
    default: {
      profile: 'default',
      windowSeconds: 60,
      limit: 100,
      keyStrategy: {
        includeTenantId: true,
        includeTenantPlan: true,
        includeUserId: true,
        // No tenants here and req.user isn't set yet for global guards, so key by IP
        includeIp: true,
      },
      action: RateLimitAction.BLOCK,
      description: 'Fallback for endpoints without @RateProfile decorator',
    },

    public: {
      profile: 'public',
      windowSeconds: 60,
      limit: 5,
      keyStrategy: {
        includeTenantId: true,
        includeTenantPlan: true,
        includeUserId: false,
        includeIp: true,
      },
      action: RateLimitAction.THROTTLE,
      description: 'Unauthenticated endpoints',
    },

    sensitive: {
      profile: 'sensitive',
      windowSeconds: 300,
      limit: 5,
      keyStrategy: {
        includeTenantId: false,
        includeTenantPlan: false,
        includeUserId: false,
        includeIp: true,
      },
      action: RateLimitAction.BLOCK,
      description: 'Auth/security endpoints - prevents brute force',
    },

    interactive: {
      profile: 'interactive',
      windowSeconds: 60,
      limit: 200,
      keyStrategy: {
        includeTenantId: true,
        includeTenantPlan: true,
        includeUserId: true,
        includeIp: false,
      },
      action: RateLimitAction.THROTTLE,
      description: 'User-driven reads (dashboards, search, listings)',
    },

    transactional: {
      profile: 'transactional',
      windowSeconds: 60,
      limit: 60,
      keyStrategy: {
        includeTenantId: true,
        includeTenantPlan: true,
        includeUserId: true,
        includeIp: false,
      },
      action: RateLimitAction.BLOCK,
      description: 'Write operations (create, update, delete)',
    },

    bulk: {
      profile: 'bulk',
      windowSeconds: 3600,
      limit: 10,
      keyStrategy: {
        includeTenantId: true,
        includeTenantPlan: true,
        includeUserId: true,
        includeIp: false,
      },
      action: RateLimitAction.BLOCK,
      description: 'Batch operations (imports, exports)',
    },

    webhook: {
      profile: 'webhook',
      windowSeconds: 60,
      limit: 1000,
      keyStrategy: {
        includeTenantId: true,
        includeTenantPlan: true,
        includeUserId: false,
        includeIp: false,
        includeIntegrationId: true,
      },
      action: RateLimitAction.BLOCK,
      description: 'Inbound webhooks from third-party integrations',
    },
  };

export const PLAN_MULTIPLIERS: Record<TenantPlan, number> = {
  [TenantPlan.FREE]: 0.5,
  [TenantPlan.STARTER]: 1.0,
  [TenantPlan.PROFESSIONAL]: 2.0,
  [TenantPlan.ENTERPRISE]: 5.0,
  [TenantPlan.UNLIMITED]: 1000.0,
};

export const RATE_LIMIT_KEY_PREFIX = 'RATE_LIMIT';
export const RATE_PROFILE_METADATA_KEY = 'rate_profile';
export const SKIP_RATE_LIMIT_METADATA_KEY = 'skip_rate_limit';

export const getRateProfileConfig = (
  profile: RateProfileType,
): RateProfileConfig => {
  return RATE_PROFILE_CONFIGS[profile];
};

export const getAdjustedLimit = (
  baseLimit: number,
  plan: TenantPlan,
): number => {
  const multiplier = PLAN_MULTIPLIERS[plan] || 1.0;
  return Math.floor(baseLimit * multiplier);
};

export const applyTenantOverride = (
  baseConfig: RateProfileConfig,
  override: Partial<RateProfileConfig>,
): RateProfileConfig => {
  return {
    ...baseConfig,
    ...override,
    keyStrategy: override.keyStrategy
      ? { ...baseConfig.keyStrategy, ...override.keyStrategy }
      : baseConfig.keyStrategy,
  };
};

/**
 * Get rate limit configuration for a request
 * Flow: Decorator profile → Default profile
 */
export function getRateLimitConfigForRequest(
  decoratorProfile: RateProfileType | undefined,
  tenantPlan: TenantPlan = TenantPlan.STARTER,
): {
  profile: RateProfileType;
  config: RateProfileConfig;
  limit: number;
  threatScore: number;
  source: 'decorator' | 'default';
} {
  if (decoratorProfile) {
    const config = getRateProfileConfig(decoratorProfile);
    const adjustedLimit = getAdjustedLimit(config.limit, tenantPlan);

    return {
      profile: decoratorProfile,
      config,
      limit: adjustedLimit,
      threatScore: 80,
      source: 'decorator',
    };
  }

  const defaultConfig = getRateProfileConfig('default');
  const adjustedLimit = getAdjustedLimit(defaultConfig.limit, tenantPlan);

  return {
    profile: 'default',
    config: defaultConfig,
    limit: adjustedLimit,
    threatScore: 75,
    source: 'default',
  };
}
