import { ReqType } from './req.type';
import { UserRole } from './user.type';

export enum SessionRestriction {
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  TWO_FACTOR_SETUP = 'TWO_FACTOR_SETUP',
}

export type AccessTokenPayload = {
  sub: string;
  sid: string;
  jti: string;
};

export type TwoFactorChallengePayload = {
  sub: string;
  jti: string;
  stage: '2fa_pending';
};

export type AuthSession = {
  userId: string;
  roles: UserRole[];
  restrictions: SessionRestriction[];
  jti: string;
  refreshTokenHash: string;
  tokenType: ReqType;
};

export type AuthUser = {
  _id: string;
  sid: string;
  roles: UserRole[];
  restrictions: SessionRestriction[];
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expireDurationSeconds: number;
  roles: UserRole[];
  restrictions: SessionRestriction[];
};

export type TwoFactorChallengeResponse = {
  requiresTwoFactor: true;
  tempToken: string;
};

export enum AuthCodePurpose {
  EMAIL_VERIFICATION = 'email-verification',
  PASSWORD_RESET = 'password-reset',
  TWO_FACTOR_LOGIN = '2fa-login',
}
