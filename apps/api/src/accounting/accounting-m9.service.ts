import { Injectable } from '@nestjs/common';

@Injectable()
export class AccountingM9Service {
  health() {
    return {
      module: 'M11 Accounting and Finance',
      status: 'available',
      legacyRoute: true,
    };
  }
}
