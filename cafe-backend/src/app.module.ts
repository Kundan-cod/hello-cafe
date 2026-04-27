import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MailerModule } from './mailer/mailer.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { AreasModule } from './areas/areas.module';
import { TablesModule } from './tables/tables.module';
import { CombosModule } from './combos/combos.module';
import { CustomersModule } from './customers/customers.module';
import { DiscountsModule } from './discounts/discounts.module';
import { StaffModule } from './staff/staff.module';
import { TenantModule } from './tenant/tenant.module';
import { HealthModule } from './health/health.module';
import { VendorsModule } from './vendors/vendors.module';
import { InventoryModule } from './inventory/inventory.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    MailerModule,
    AuthModule,
    BranchesModule,
    TenantModule,
    MenuModule,
    OrdersModule,
    AreasModule,
    TablesModule,
    CombosModule,
    CustomersModule,
    DiscountsModule,
    StaffModule,
    HealthModule,
    VendorsModule,
    InventoryModule,
    BillingModule,
  ],
})
export class AppModule {}
