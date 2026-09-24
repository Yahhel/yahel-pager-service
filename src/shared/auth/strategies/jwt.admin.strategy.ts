import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { User } from '../../schemas';
import { RoleType, UserStatus } from '../../interfaces';

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: User) {
    const userExist = await this.authService.findByEmail(payload.email);
    if (
      !userExist ||
      userExist.status !== UserStatus.ACTIVE ||
      !userExist.roles?.includes(RoleType.ADMIN)
    )
      throw new UnauthorizedException();
    return {
      ...payload,
      roles: userExist.roles,
      twoFactorEnabled: userExist.twoFactorEnabled,
      passwordResetStatus: userExist.passwordResetStatus,
    };
  }
}
