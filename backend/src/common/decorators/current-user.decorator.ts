import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * @CurrentUser() — req.user ဆွဲ
 * Guard က req.user ထည့်ပြီးသား
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user;

    // @CurrentUser('sub') → user.sub ဆွဲ
    if (data && user) {
      return (user as any)[data];
    }

    return user;
  },
);


// @CurrentUser() user: JwtPayload     // full object
// @CurrentUser('sub') userId: string  // specific field