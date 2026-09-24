import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiReq } from '@shared/interfaces';
import { ROLES_KEY } from '@shared/decorators';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiReq>();
    const path = request.route?.path || request.url;

    // Skip role checks for routes containing '/public'
    if (path.includes('/public')) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.roles?.some((role: string) => requiredRoles.includes(role))) {
      throw new ForbiddenException('Access to this resource is forbidden');
    }

    return true;
  }
}
