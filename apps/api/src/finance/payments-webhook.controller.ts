import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { FinanceService } from './finance.service';

// @Public()
@Controller('payments/online/webhook')
export class PaymentsWebhookController {
  constructor(private readonly financeService: FinanceService) {}

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    return this.financeService.handleOnlinePaymentWebhook(
      provider,
      payload,
      headers,
    );
  }
}
