import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() — Guard ကို skip
 * သုံး: register, login, refresh, health, browse tickets
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);