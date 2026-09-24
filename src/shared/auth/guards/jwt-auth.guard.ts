import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_RESTRICTED_KEY } from '../../decorators';
import { AuthUser } from '../../interfaces';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (!user.restrictions?.length) return true;

    const allowRestricted = this.reflector.getAllAndOverride<boolean>(
      ALLOW_RESTRICTED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowRestricted) return true;

    throw new ForbiddenException({
      message: 'Complete the required account steps to continue.',
      restrictions: user.restrictions,
    });
  }
}
