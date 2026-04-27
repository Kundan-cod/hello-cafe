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
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  private branchId(req: any): string | null {
    return req.user?.branchId ?? null;
  }

  @Post()
  create(@Tenant() tenantId: string, @Req() req: any, @Body() body: any) {
    return this.customersService.createCustomer(
      tenantId,
      this.branchId(req),
      body,
    );
  }

  @Get()
  list(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Query('type') type?: 'CUSTOMER' | 'CREDITOR',
  ) {
    return this.customersService.getCustomers(
      tenantId,
      type,
      this.branchId(req),
    );
  }

  @Get(':id/credit-history')
  getCreditHistory(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.customersService.getCreditHistory(
      tenantId,
      id,
      this.branchId(req),
    );
  }

  @Get(':id')
  getOne(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.customersService.getCustomer(tenantId, id, this.branchId(req));
  }

  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.customersService.updateCustomer(
      tenantId,
      id,
      body,
      this.branchId(req),
    );
  }

  @Patch(':id/credit')
  updateCredit(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { amount: number; type: 'PAYMENT' | 'CREDIT'; note?: string },
  ) {
    return this.customersService.updateCreditBalance(
      tenantId,
      id,
      body,
      this.branchId(req),
    );
  }

  @Delete(':id')
  remove(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.customersService.deleteCustomer(
      tenantId,
      id,
      this.branchId(req),
    );
  }
}
