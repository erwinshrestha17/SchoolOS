import { Injectable } from '@nestjs/common';

@Injectable()
export class AccountingM9Service {
  health() {
    return { module: 'M9 Accounting & Finance', status: 'ready' };
  }
}
