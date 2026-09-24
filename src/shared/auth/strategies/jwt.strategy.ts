import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from '../../configs';
import { AccessTokenPayload, AuthUser } from '../../interfaces';
import { AuthStoreService } from '../auth-store.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authStore: AuthStoreService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    if (!payload?.sid || !payload?.jti) throw new UnauthorizedException();

    const session = await this.authStore.getSession(payload.sid);
    if (
      !session ||
      session.userId !== payload.sub ||
      session.jti !== payload.jti
    )
      throw new UnauthorizedException('Session expired. Please log in again.');

    return {
      _id: session.userId,
      sid: payload.sid,
      roles: session.roles,
      restrictions: session.restrictions,
    };
  }
}
