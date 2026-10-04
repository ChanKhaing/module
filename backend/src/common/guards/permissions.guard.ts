import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
interface AuthUser {
  id?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. @RequirePermissions() metadata ဖတ်
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 2. Metadata မရှိ → skip
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;      // ← cast

    // 3. Login မလုပ်ရသေး (JwtAuthGuard က ဖမ်းပြီးသား ဖြစ်ရမယ်)
    if (!user) {
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
      });
    }

    // 4. Admin bypass
    if (user.roles?.includes('admin')) return true;

    // 5. Permission စစ်
    const userPerms = user.permissions ?? [];
    const hasAll = required.every((p) => userPerms.includes(p));

    if (!hasAll) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: `Required permissions: ${required.join(', ')}`,
      });
    }

    return true;
  }
}