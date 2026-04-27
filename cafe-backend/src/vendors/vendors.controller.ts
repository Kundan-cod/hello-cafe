import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveSubscriptionGuard } from '../billing/active-subscription.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { CreateVendorPurchaseDto } from './dto/create-vendor-purchase.dto';
import { UpdateVendorPurchasePaymentDto } from './dto/update-vendor-purchase-payment.dto';

@Controller('vendors')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  private branchId(req: any): string | null {
    return req.user?.branchId ?? null;
  }

  @Post()
  create(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Body() body: CreateVendorDto,
  ) {
    return this.vendorsService.createVendor(tenantId, this.branchId(req), body);
  }

  @Get()
  list(@Tenant() tenantId: string, @Req() req: any) {
    return this.vendorsService.getVendors(tenantId, this.branchId(req));
  }

  @Get(':id/purchases')
  getPurchaseHistory(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.vendorsService.getPurchaseHistory(
      tenantId,
      id,
      this.branchId(req),
    );
  }

  @Get(':vendorId/purchases/:purchaseId')
  getPurchase(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.vendorsService.getPurchase(
      tenantId,
      purchaseId,
      this.branchId(req),
    );
  }

  @Get(':id')
  getOne(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.vendorsService.getVendor(tenantId, id, this.branchId(req));
  }

  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateVendorDto,
  ) {
    return this.vendorsService.updateVendor(
      tenantId,
      id,
      body,
      this.branchId(req),
    );
  }

  @Delete(':id')
  remove(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.vendorsService.deleteVendor(tenantId, id, this.branchId(req));
  }

  @Post(':id/purchases')
  createPurchase(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CreateVendorPurchaseDto,
  ) {
    return this.vendorsService.createPurchase(
      tenantId,
      id,
      this.branchId(req),
      body,
    );
  }

  @Patch(':vendorId/purchases/:purchaseId/payment')
  updatePurchasePayment(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('vendorId') _vendorId: string,
    @Param('purchaseId') purchaseId: string,
    @Body() body: UpdateVendorPurchasePaymentDto,
  ) {
    return this.vendorsService.updatePurchasePayment(
      tenantId,
      purchaseId,
      body.paidAmount,
      body.note,
      this.branchId(req),
    );
  }
}
