import { Body, Controller, Post } from '@nestjs/common';

import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto';
import { CurrentUser, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @RequirePermissions('payment:create')
  @Post()
  initiate(
    @Body() dto: InitiatePaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payments.initiate(dto, user.sub);
  }
}
