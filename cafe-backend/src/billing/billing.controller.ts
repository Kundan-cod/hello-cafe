import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { BillingService } from './billing.service';
import { RequestSubscriptionDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * List all active subscription plans available to cafes.
   *
   * GET /plans
   */
  @Get('plans')
  getPlans() {
    return this.billingService.listActivePlans();
  }

  /**
   * Cafe submits a manual payment request for verification.
   *
   * POST /subscriptions/request
   */
  @Post('subscriptions/request')
  requestSubscription(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Body() dto: RequestSubscriptionDto,
  ) {
    const userId = req.user?.userId as string | undefined;
    return this.billingService.createSubscriptionRequest(
      tenantId,
      userId ?? '',
      dto,
    );
  }

  /**
   * Get the latest subscription record for the current cafe (tenant),
   * including plan and status. Used to reflect pending/active state in UI.
   *
   * GET /subscriptions/me
   */
  @Get('subscriptions/me')
  getMyLatestSubscription(@Tenant() tenantId: string) {
    return this.billingService.getLatestSubscriptionForTenant(tenantId);
  }
}
