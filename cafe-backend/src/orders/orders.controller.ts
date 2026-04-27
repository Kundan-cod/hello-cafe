import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveSubscriptionGuard } from '../billing/active-subscription.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { UpdateOrderItemStatusDto } from './dto/update-order-item-status.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @HttpCode(200)
  createOrder(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Body() body: CreateOrderDto,
    @Query('lite') lite?: string,
  ) {
    const branchId = req.user.branchId ?? null;
    const includeDetails = !(lite === '1' || lite === 'true');
    return this.ordersService.createOrder(
      tenantId,
      req.user.userId,
      branchId,
      body,
      { includeDetails },
    );
  }

  @Get()
  getOrders(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('orderType') orderType?: string,
    @Query('search') search?: string,
  ) {
    const effectiveBranchId = req.user.branchId ?? (branchId || undefined);
    const opts: Parameters<OrdersService['getOrders']>[2] = {};
    if (cursor?.trim()) opts.cursor = cursor.trim();
    if (limit != null && limit !== '') opts.limit = parseInt(limit, 10);
    if (
      status &&
      ['IN_PROCESS', 'COMPLETED', 'CREDIT', 'CANCELLED'].includes(status)
    ) {
      opts.status = status as
        | 'IN_PROCESS'
        | 'COMPLETED'
        | 'CREDIT'
        | 'CANCELLED';
    }
    if (orderType === 'DELIVERY') opts.orderType = 'DELIVERY';
    if (search?.trim()) opts.search = search.trim();
    return this.ordersService.getOrders(tenantId, effectiveBranchId, opts);
  }

  @Get('status')
  getOrdersStatus(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('since') since?: string,
  ) {
    const effectiveBranchId = req.user.branchId ?? (branchId || undefined);
    const sinceDate = since ? new Date(since) : undefined;
    return this.ordersService.getOrdersStatus(
      tenantId,
      effectiveBranchId,
      sinceDate,
    );
  }

  @Get(':id')
  getOrder(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.ordersService.getOrder(tenantId, id);
  }

  @Patch(':id/status')
  updateStatus(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
    @Query('lite') lite?: string,
  ) {
    const includeDetails = !(lite === '1' || lite === 'true');
    return this.ordersService.updateOrderStatus(tenantId, id, body.status, {
      includeDetails,
    });
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: CompleteOrderDto,
    @Query('lite') lite?: string,
  ) {
    const includeDetails = !(lite === '1' || lite === 'true');
    return this.ordersService.completeOrder(tenantId, id, body, {
      includeDetails,
    });
  }

  @Post(':id/items')
  addItems(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: AddOrderItemsDto,
  ) {
    return this.ordersService.addItems(tenantId, id, body.items);
  }

  @Patch(':orderId/items/:itemId/status')
  updateItemStatus(
    @Tenant() tenantId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateOrderItemStatusDto,
    @Query('lite') lite?: string,
  ) {
    const includeDetails = !(lite === '1' || lite === 'true');
    return this.ordersService.updateOrderItemStatus(
      tenantId,
      orderId,
      itemId,
      body.status,
      { includeDetails },
    );
  }

  @Patch(':orderId/items/:itemId')
  updateItemQuantity(
    @Tenant() tenantId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateOrderItemDto,
    @Query('lite') lite?: string,
  ) {
    const includeDetails = !(lite === '1' || lite === 'true');
    return this.ordersService.updateOrderItemQuantity(
      tenantId,
      orderId,
      itemId,
      body.quantity,
      { includeDetails },
    );
  }

  @Delete(':orderId/items/:itemId')
  removeItem(
    @Tenant() tenantId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Query('lite') lite?: string,
  ) {
    const includeDetails = !(lite === '1' || lite === 'true');
    return this.ordersService.removeOrderItem(tenantId, orderId, itemId, {
      includeDetails,
    });
  }
}
