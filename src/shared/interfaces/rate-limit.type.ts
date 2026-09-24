export enum TenantPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
  UNLIMITED = 'UNLIMITED',
}

export type RateProfileType =
  | 'default'
  | 'public'
  | 'sensitive'
  | 'interactive'
  | 'transactional'
  | 'bulk'
  | 'webhook';

export enum RateLimitAction {
  BLOCK = 'BLOCK',
  THROTTLE = 'THROTTLE',
}

export interface KeyStrategy {
  includeTenantId?: boolean;
  includeTenantPlan?: boolean;
  includeUserId?: boolean;
  includeIp?: boolean;
  includeIntegrationId?: boolean;
}

export interface RateProfileConfig {
  profile: RateProfileType;
  windowSeconds: number;
  limit: number;
  keyStrategy: KeyStrategy;
  action: RateLimitAction;
  description: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingPoints: number;
  msBeforeNext: number;
  consumedPoints: number;
  isFirstInDuration: boolean;
}

export interface RateLimitContext {
  tenantId?: string;
  tenantPlan?: TenantPlan;
  userId?: string;
  ip?: string;
  integrationId?: string;
  profile: RateProfileType;
  endpoint: string;
}
