import { SetMetadata } from '@nestjs/common';

export const SKIP_WRAP_KEY = 'skipWrap';
export const SkipWrap = () => SetMetadata(SKIP_WRAP_KEY, true);