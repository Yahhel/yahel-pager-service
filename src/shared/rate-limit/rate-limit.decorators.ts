import { SetMetadata } from '@nestjs/common';
import { RateProfileType } from '@shared/interfaces/rate-limit.type';
import {
  RATE_PROFILE_METADATA_KEY,
  SKIP_RATE_LIMIT_METADATA_KEY,
} from '@shared/configs/rate-profiles.config';

export const RateProfile = (profile: RateProfileType) =>
  SetMetadata(RATE_PROFILE_METADATA_KEY, profile);

export const SkipRateLimit = () =>
  SetMetadata(SKIP_RATE_LIMIT_METADATA_KEY, true);
