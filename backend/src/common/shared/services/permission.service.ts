import { Injectable } from '@nestjs/common';

export interface AuthUser {
  id?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
}

@Injectable()
export class PermissionService {
  /**
   * user တွင် code ၁ ခု ရှိလား
   */
  can(user: AuthUser | undefined, code: string): boolean {
    if (!user) return false;
    if (user.roles?.includes('admin')) return true;
    return (user.permissions ?? []).includes(code);
  }

  /**
   * user တွင် code အားလုံး ရှိလား
   */
  canAll(user: AuthUser | undefined, codes: string[]): boolean {
    if (!user) return false;
    if (user.roles?.includes('admin')) return true;
    const perms = user.permissions ?? [];
    return codes.every((c) => perms.includes(c));
  }

  /**
   * user တွင် code တစ်ခုခု ရှိလား
   */
  canAny(user: AuthUser | undefined, codes: string[]): boolean {
    if (!user) return false;
    if (user.roles?.includes('admin')) return true;
    const perms = user.permissions ?? [];
    return codes.some((c) => perms.includes(c));
  }
}