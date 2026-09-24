import { SetMetadata } from '@nestjs/common';

export const ALLOW_RESTRICTED_KEY = 'allowRestrictedSession';

/** Lets a session with pending account steps (password change, 2FA setup) reach this route. */
export const AllowRestricted = () => SetMetadata(ALLOW_RESTRICTED_KEY, true);
