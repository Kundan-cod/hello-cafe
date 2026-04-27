import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { AdminBillingController } from './billing.admin.controller';
import { ActiveSubscriptionGuard } from './active-subscription.guard';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [BillingService, ActiveSubscriptionGuard],
  controllers: [BillingController, AdminBillingController],
  exports: [BillingService, ActiveSubscriptionGuard],
})
export class BillingModule {}
