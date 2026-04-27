import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { BillingService } from './billing.service';

/**
 * Guard that ensures the current cafe (tenant) has an ACTIVE subscription
 * whose next billing date is in the future.
 *
 * Attach alongside JwtAuthGuard on controllers that should be protected
 * by subscription status, e.g. orders, menu, reports.
 */
@Injectable()
export class ActiveSubscriptionGuard implements CanActivate {
  constructor(private readonly billingService: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const tenantId: string | undefined =
      req?.user?.tenantId ?? req?.headers?.['x-tenant-id'];

    // If we cannot resolve tenant, let other guards/validators handle it.
    if (!tenantId) {
      return true;
    }

    const method = (req?.method || 'GET').toUpperCase();

    // Allow read‑only operations even when subscription is expired.
    // Block writes (POST, PUT, PATCH, DELETE, etc.) when subscription is not active.
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      await this.billingService.ensureTenantHasActiveSubscription(tenantId);
    }

    return true;
  }
}
