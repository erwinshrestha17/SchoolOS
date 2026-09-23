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
    const request = context.switchToHttp().getRequest<{
      auth?: { tenantId?: string };
      user?: { tenantId?: string };
    }>();
    const tenantId = request.auth?.tenantId || request.user?.tenantId;

    return next.handle().pipe(
      tap(() => {
        // Only track for non-platform tenants
        if (tenantId && tenantId !== 'platform') {
          // Usage is observational: errors are recorded without changing the response.
          void this.usageService
            .incrementUsage(tenantId, 'api.requests', 1)
            .catch((error: unknown) => {
              this.logger.error(
                `Failed to increment API usage for tenant ${tenantId}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            });
        }
      }),
    );
  }
}
