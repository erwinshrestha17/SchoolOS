import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UsageService } from './usage.service';

@Injectable()
export class UsageInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UsageInterceptor.name);

  constructor(private readonly usageService: UsageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.auth?.tenantId || request.user?.tenantId;

    return next.handle().pipe(
      tap(async () => {
        // Only track for non-platform tenants
        if (tenantId && tenantId !== 'platform') {
          try {
            // We don't verifyLimit here to avoid blocking requests,
            // just increment for tracking. Gating is done at feature level.
            await this.usageService.incrementUsage(tenantId, 'api.requests', 1);
          } catch (error) {
            this.logger.error(
              `Failed to increment API usage for tenant ${tenantId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }),
    );
  }
}
