import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveSubscriptionGuard } from '../billing/active-subscription.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { DiscountsService } from './discounts.service';

@Controller('discounts')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class DiscountsController {
  constructor(private discountsService: DiscountsService) {}

  private branchId(req: any): string | null {
    return req.user?.branchId ?? null;
  }

  @Post()
  create(@Tenant() tenantId: string, @Req() req: any, @Body() body: any) {
    return this.discountsService.createDiscount(
      tenantId,
      this.branchId(req),
      body,
    );
  }

  @Get()
  list(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Query('activeOnly') activeOnly?: string,
  ) {
    // By default, return only active offers unless explicitly requested otherwise.
    const activeOnlyFlag =
      activeOnly === undefined ? true : activeOnly === 'true';
    return this.discountsService.getDiscounts(
      tenantId,
      activeOnlyFlag,
      this.branchId(req),
    );
  }

  @Get('for-order')
  forOrder(@Tenant() tenantId: string, @Req() req: any) {
    return this.discountsService.getActiveDiscountsForOrder(
      tenantId,
      this.branchId(req),
    );
  }

  @Get('apply')
  applyByCode(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Query('code') code: string,
    @Query('subTotal') subTotal: string,
  ) {
    const subTotalNum = parseFloat(subTotal) || 0;
    return this.discountsService.getDiscountByCode(
      tenantId,
      this.branchId(req),
      code,
      subTotalNum,
    );
  }

  @Post('apply')
  applyWithOrder(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Body()
    body: {
      code: string;
      items: Array<{
        menuItemId: string;
        categoryId: string | null;
        price: number;
        quantity: number;
      }>;
    },
  ) {
    return this.discountsService.applyWithOrder(
      tenantId,
      this.branchId(req),
      body.code,
      body.items || [],
    );
  }

  @Get(':id')
  getOne(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.discountsService.getDiscount(tenantId, id, this.branchId(req));
  }

  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.discountsService.updateDiscount(
      tenantId,
      id,
      body,
      this.branchId(req),
    );
  }

  @Delete(':id')
  remove(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.discountsService.deleteDiscount(
      tenantId,
      id,
      this.branchId(req),
    );
  }
}
