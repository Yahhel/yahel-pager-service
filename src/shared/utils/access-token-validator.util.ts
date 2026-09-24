import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { convertToKey, getPlatformIssuer, isMobile } from './helper.util';
import { ApiReq, ReqType, UserTokenData } from '../interfaces';
import { redisDelMany, redisGet, redisSMembers, redisSRem } from './redis.util';

export async function validateAccessTokenAfterRefreshOrRevoke(
  context: ExecutionContext,
) {
  const ctx = context.switchToHttp();
  const req = ctx.getRequest();
  const isValid = await validateAccess(req);
  if (isValid !== true) throw new UnauthorizedException();
}

export async function validateAccess(request: ApiReq) {
  const authToken = request.headers.authorization;

  if (!authToken) return true; // No bearer token supplied for non secure URL.

  const [bearerHead, accessToken] = authToken.split(' ');

  if (!bearerHead || bearerHead !== 'Bearer' || !accessToken) return false;
  const path = request.route?.path || request.url;
  const isPublicEndpoint = path.includes('/public');

  // Checking if the token is an old after refresh/revoke had taken place.
  // Note: some webhook comes with authorization key in the headers
  if (accessToken && !path.includes('/webhooks/public')) {
    const dUser: any = await global.jwtService.decode(accessToken);
    if (!dUser) return false;
    const {
      issuer,
      issuerEmail,
      issuerSub,
      issuerOriginator,
      issuerIdPrefix,
      issuerHashPrefix,
    } = getPlatformIssuer();

    const hashToken = convertToKey(
      dUser.iss + dUser.plem + dUser.plcd || '',
      issuerHashPrefix,
    );

    if (
      dUser.iss !== issuer ||
      dUser.sub !== issuerSub ||
      !dUser.plid?.includes(issuerIdPrefix) ||
      dUser.plem !== issuerEmail ||
      dUser.plto !== issuerOriginator ||
      hashToken !== dUser.plhh
    ) {
      return isPublicEndpoint; // if public endpoint, and authorization is coming from 3rd party then let it pass
    }

    const key = convertToKey(accessToken, 'Authorization');
    const tokenData: UserTokenData = await redisGet(key);
    return !(!tokenData || tokenData?.accessToken !== accessToken);
  }

  if (path.includes('/public')) return true;

  return false;
}

export const getUserTokenKeys = (userId: string) => `auths:users:${userId}`;

export const getTokenKeys = (tokenData: UserTokenData) => [
  convertToKey(tokenData.accessToken, 'Authorization'),
  `Refresh_token:${tokenData.tokenType}:${tokenData.refreshToken}`,
  tokenData.revokeToken,
];

export const accessLogout = async (req: ApiReq, userId: string) => {
  const keys = await getRequestTokenKeys(req);
  if (!keys.length) return true;

  await Promise.all([
    redisDelMany(keys),
    redisSRem(getUserTokenKeys(userId), keys),
  ] as any);

  return true;
};

export const accessLogoutAll = async (
  userId: string,
  exceptKeys: string[] = [],
) => {
  const userTokenKeys = getUserTokenKeys(userId);
  const keys: string[] = await redisSMembers(userTokenKeys);
  const revokedKeys = keys.filter((key) => !exceptKeys.includes(key));
  if (!revokedKeys.length) return true;

  await Promise.all([
    redisDelMany(revokedKeys),
    exceptKeys.length
      ? redisSRem(userTokenKeys, revokedKeys)
      : redisDelMany([userTokenKeys]),
  ] as any);
  return true;
};

export const getRequestTokenKeys = async (req: ApiReq) => {
  const [, accessToken] = (req.headers.authorization || '').split(' ');
  if (!accessToken) return [];
  const tokenData: UserTokenData = await redisGet(
    convertToKey(accessToken, 'Authorization'),
  );
  return tokenData ? getTokenKeys(tokenData) : [];
};

export const getRequestTokenType = (req: ApiReq) =>
  isMobile(req) ? ReqType.MOBILE : ReqType.WEB;
