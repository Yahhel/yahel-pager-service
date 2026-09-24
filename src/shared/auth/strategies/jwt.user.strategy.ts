import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../schemas';
import { UserStatus } from '../../interfaces';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtUserStrategy extends PassportStrategy(Strategy, 'jwt-user') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: User) {
    const userExist = await this.authService.findByEmail(payload.email);
    if (!userExist || userExist.status !== UserStatus.ACTIVE)
      throw new UnauthorizedException();
    return {
      ...payload,
      roles: userExist.roles,
      twoFactorEnabled: userExist.twoFactorEnabled,
      passwordResetStatus: userExist.passwordResetStatus,
    };
  }
}
