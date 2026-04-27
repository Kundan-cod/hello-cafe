import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [InventoryModule, BillingModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
