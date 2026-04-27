import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { RejectSubscriptionDto } from './dto';

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard)
export class AdminBillingController {
  constructor(private readonly billingService: BillingService) {}

  private assertAdmin(req: any) {
    if (req?.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admin users can access this resource');
    }
  }

  /**
   * List all subscriptions that are waiting for manual payment verification.
   *
   * GET /admin/subscriptions/pending
   */
  @Get('pending')
  getPending(@Req() req: any) {
    this.assertAdmin(req);
    return this.billingService.getPendingSubscriptions();
  }

  /**
   * Approve a pending subscription and activate it.
   *
   * POST /admin/subscriptions/:id/approve
   */
  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    this.assertAdmin(req);
    const adminUserId = req.user?.userId as string | undefined;
    return this.billingService.approveSubscription(id, adminUserId ?? '');
  }

  /**
   * Reject a pending subscription with a rejection note.
   *
   * POST /admin/subscriptions/:id/reject
   */
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: RejectSubscriptionDto,
  ) {
    this.assertAdmin(req);
    const adminUserId = req.user?.userId as string | undefined;
    return this.billingService.rejectSubscription(
      id,
      adminUserId ?? '',
      dto.note,
    );
  }
}
