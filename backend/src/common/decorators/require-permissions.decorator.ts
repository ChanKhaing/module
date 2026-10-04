import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * @RequirePermissions('ticket:create')
 * @RequirePermissions('order:read', 'order:cancel')
 *
 * Route ကို permission လိုအပ်အောင် သတ်မှတ်
 * - Admin → bypass
 * - User တွင် permission အားလုံး ရှိရ
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);