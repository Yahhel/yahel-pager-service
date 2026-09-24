import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../decorators';
import { AuthUser, UserRole } from '../../interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (!user?.roles?.some((role) => requiredRoles.includes(role)))
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    return true;
  }
}
