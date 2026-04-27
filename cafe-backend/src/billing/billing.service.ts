import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async listActivePlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async createSubscriptionRequest(
    tenantId: string,
    userId: string,
    dto: {
      planId: string;
      transactionId: string;
      paidAmount: number;
      screenshotUrl?: string;
    },
  ) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: {
        id: dto.planId,
        isActive: true,
      },
    });

    if (!plan) {
      throw new BadRequestException('Selected plan not found or inactive');
    }

    // Prevent multiple pending requests at the same time for a tenant.
    const existingPending = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: ['PENDING_VERIFICATION', 'PENDING_PAYMENT'] as any,
        },
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        'You already have a subscription request pending review. Please wait until it is approved or rejected before submitting a new one.',
      );
    }

    // Prevent new request if tenant already has a paid plan with more than 7 days remaining.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        planType: true,
        currentSubscriptionEnd: true,
      },
    });

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (
      tenant?.planType === 'PAID' &&
      tenant.currentSubscriptionEnd &&
      tenant.currentSubscriptionEnd > sevenDaysFromNow
    ) {
      throw new BadRequestException(
        'Your current paid plan is still active for more than 7 days. You can request a new subscription closer to the expiry date.',
      );
    }

    if (!dto.transactionId.trim()) {
      throw new BadRequestException('Transaction ID is required');
    }

    const paidAmount = dto.paidAmount;
    if (paidAmount <= 0) {
      throw new BadRequestException('Paid amount must be greater than zero');
    }

    // Create a new manual QR subscription awaiting admin verification.
    const created = await this.prisma.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'PENDING_VERIFICATION' as any,
        transactionId: dto.transactionId.trim(),
        paidAmount,
        screenshotUrl: dto.screenshotUrl?.trim() || null,
        gateway: 'MANUAL_QR',
        // New enum field – cast to any until Prisma client is regenerated.
        paymentMethod: 'ESEWA_QR' as any,
      } as any,
      include: {
        tenant: true,
      },
    });

    // Fetch submitting user details (if any) to include contact info in email.
    const submittingUser = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            contactNumber: true,
          },
        })
      : null;

    // Best-effort: notify admin by email about the new subscription request.
    const adminEmail =
      process.env.MAIL_FROM || process.env.ADMIN_USERNAME || null;

    if (adminEmail) {
      const lines: string[] = [
        'A cafe submitted a new subscription payment request.',
        '',
        `Tenant ID: ${tenantId}`,
        `Cafe name: ${created.tenant?.cafeName ?? 'N/A'}`,
        `Cafe contact number: ${created.tenant?.contactNumber ?? 'N/A'}`,
        '',
        `Requested plan: ${plan.name} (${plan.id})`,
        `Paid amount: NPR ${dto.paidAmount}`,
        `Transaction ID: ${dto.transactionId.trim()}`,
        `Screenshot URL: ${dto.screenshotUrl?.trim() || 'N/A'}`,
        '',
        `Submitted by user ID: ${userId || 'N/A'}`,
        `Submitted by user name: ${submittingUser?.name ?? 'N/A'}`,
        `Submitted by user email: ${submittingUser?.email ?? 'N/A'}`,
        `Submitted by user contact: ${submittingUser?.contactNumber ?? 'N/A'}`,
        `Submitted at: ${new Date().toISOString()}`,
        '',
        'You can review and approve/reject this request from the admin subscriptions panel.',
      ];

      try {
        await this.mailer.sendMail({
          to: adminEmail,
          subject: 'Hello Café – New subscription payment request',
          text: lines.join('\n'),
        });
      } catch (err) {
        // Log but do not fail the request because of email problems.

        console.error(
          '[Billing] Failed to send subscription request email to admin',
          adminEmail,
          err,
        );
      }
    }

    return created;
  }

  /**
   * Returns the most recent subscription for a given tenant, including plan details.
   */
  async getLatestSubscriptionForTenant(tenantId: string) {
    return this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
      },
    });
  }

  async getPendingSubscriptions() {
    return this.prisma.subscription.findMany({
      where: { status: 'PENDING_VERIFICATION' as any },
      include: {
        tenant: true,
        plan: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveSubscription(id: string, adminUserId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (String(subscription.status) !== 'PENDING_VERIFICATION') {
      throw new BadRequestException(
        'Only pending subscriptions can be approved',
      );
    }

    const now = new Date();
    const durationDays = subscription.plan.durationDays ?? 0;
    if (!durationDays || durationDays <= 0) {
      throw new BadRequestException('Plan has invalid duration');
    }

    const nextBillingDate = new Date(
      now.getTime() + durationDays * 24 * 60 * 60 * 1000,
    );

    const approvedById =
      adminUserId && adminUserId !== 'admin' ? adminUserId : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedSub = await tx.subscription.update({
        where: { id },
        data: {
          status: 'ACTIVE' as any,
          startsAt: now,
          endsAt: nextBillingDate,
          // New fields – cast to any until Prisma client is regenerated.
          approvedById,
          rejectionNote: null,
        } as any,
      });

      await tx.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          currentSubscriptionEnd: nextBillingDate,
          planType: 'PAID',
        },
      });

      return updatedSub;
    });

    return updated;
  }

  async rejectSubscription(id: string, adminUserId: string, note: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (String(subscription.status) !== 'PENDING_VERIFICATION') {
      throw new BadRequestException(
        'Only pending subscriptions can be rejected',
      );
    }

    if (!note.trim()) {
      throw new BadRequestException('Rejection note is required');
    }

    const approvedById =
      adminUserId && adminUserId !== 'admin' ? adminUserId : null;

    return this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'REJECTED' as any,
        // New fields – cast to any until Prisma client is regenerated.
        approvedById,
        rejectionNote: note.trim(),
      } as any,
    });
  }

  /**
   * Throws if the tenant does not have an ACTIVE subscription whose next billing
   * date (endsAt) is in the future, or a valid trial window.
   */
  async ensureTenantHasActiveSubscription(tenantId: string) {
    const now = new Date();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        planType: true,
        currentSubscriptionEnd: true,
      },
    });

    if (!tenant) {
      throw new ForbiddenException(
        'Tenant not found for subscription validation.',
      );
    }

    // Allow access while on an active TRIAL window (e.g. first 15 days).
    if (
      tenant.planType === 'TRIAL' &&
      tenant.currentSubscriptionEnd &&
      tenant.currentSubscriptionEnd > now
    ) {
      return;
    }

    const active = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE' as any,
        endsAt: {
          gt: now,
        },
      },
      orderBy: { endsAt: 'desc' },
    });

    if (!active) {
      throw new ForbiddenException(
        'Your subscription is inactive or has expired. Please contact support or update your plan.',
      );
    }

    return active;
  }

  /**
   * Background job: mark subscriptions as EXPIRED when their next billing date
   * is in the past.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expirePastDueSubscriptions() {
    const now = new Date();
    try {
      const result: Prisma.BatchPayload =
        await this.prisma.subscription.updateMany({
          where: {
            status: 'ACTIVE' as any,
            endsAt: { lte: now },
          },
          data: {
            status: 'EXPIRED',
          },
        });

      if (result.count > 0) {
        // Best-effort: keep tenant.currentSubscriptionEnd roughly in sync by
        // clearing it when all subscriptions are expired. We keep this light –
        // access checks rely on Subscription, not the cached column.
        await this.prisma.tenant.updateMany({
          where: {
            subscriptions: {
              none: {
                status: 'ACTIVE',
                endsAt: { gt: now },
              },
            },
          },
          data: {
            currentSubscriptionEnd: null,
          },
        });
      }
    } catch (err) {
      // Do not crash the app because of a failed cron job; just log.

      console.error('[Billing] expirePastDueSubscriptions failed', err);
    }
  }
}
