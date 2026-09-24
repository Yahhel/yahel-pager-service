import {
  Injectable,
  ExecutionContext,
  CanActivate,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PasswordResetStatus } from '@shared/interfaces';
import { validateAccessTokenAfterRefreshOrRevoke } from '@shared/utils/access-token-validator.util';

@Injectable()
export class JwtAdminsGuard
  extends AuthGuard('jwt-admin')
  implements CanActivate
{
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await validateAccessTokenAfterRefreshOrRevoke(context);
    const isActivated = (await super.canActivate(context)) as boolean;

    // Admins complete these via /v1/auth routes, which only need JwtUsersGuard
    const { user } = context.switchToHttp().getRequest();
    if (user.passwordResetStatus === PasswordResetStatus.REQUIRED)
      throw new ForbiddenException(
        'Change your default password to access admin features',
      );
    if (!user.twoFactorEnabled)
      throw new ForbiddenException('Enable 2FA to access admin features');

    return isActivated;
  }
}
