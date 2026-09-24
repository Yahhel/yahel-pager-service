import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { validateAccessTokenAfterRefreshOrRevoke } from '@shared/utils/access-token-validator.util';

@Injectable()
export class JwtUsersGuard
  extends AuthGuard('jwt-user')
  implements CanActivate
{
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await validateAccessTokenAfterRefreshOrRevoke(context);
    return (await super.canActivate(context)) as boolean;
  }
}
