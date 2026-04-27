import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveSubscriptionGuard } from '../billing/active-subscription.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { InventoryService } from './inventory.service';
import { CreateInventoryProductDto } from './dto/create-inventory-product.dto';
import { UpdateInventoryProductDto } from './dto/update-inventory-product.dto';
import { AddStockDto } from './dto/add-stock.dto';
import { MenuItemUsageDto } from './dto/menu-item-usage.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  private branchId(req: any): string | null {
    return req.user?.branchId ?? null;
  }

  @Post()
  create(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Body() body: CreateInventoryProductDto,
  ) {
    return this.inventoryService.createProduct(
      tenantId,
      this.branchId(req),
      body,
    );
  }

  @Get()
  list(@Tenant() tenantId: string, @Req() req: any) {
    return this.inventoryService.getProducts(tenantId, this.branchId(req));
  }

  @Get('usage/menu-item/:menuItemId')
  getMenuItemUsages(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('menuItemId') menuItemId: string,
  ) {
    return this.inventoryService.getMenuItemUsages(
      tenantId,
      menuItemId,
      this.branchId(req),
    );
  }

  @Put('usage/menu-item/:menuItemId')
  setMenuItemUsages(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('menuItemId') menuItemId: string,
    @Body() body: { usages: MenuItemUsageDto[] },
  ) {
    return this.inventoryService.setMenuItemUsages(
      tenantId,
      menuItemId,
      body.usages || [],
      this.branchId(req),
    );
  }

  @Put(':id/usage')
  setProductUsage(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { links: { menuItemId: string; quantityPerUnit: number }[] },
  ) {
    return this.inventoryService.setProductMenuLinks(
      tenantId,
      id,
      body.links || [],
      this.branchId(req),
    );
  }

  @Get(':id/history')
  getHistory(
    @Tenant() _tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getStockHistory(
      id,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Post(':id/stock')
  addStock(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: AddStockDto,
  ) {
    return this.inventoryService.addStock(
      tenantId,
      id,
      body.quantity,
      body.note,
      this.branchId(req),
    );
  }

  @Get(':id')
  getOne(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.inventoryService.getProduct(tenantId, id, this.branchId(req));
  }

  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateInventoryProductDto,
  ) {
    return this.inventoryService.updateProduct(
      tenantId,
      id,
      body,
      this.branchId(req),
    );
  }

  @Delete(':id')
  remove(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.inventoryService.deleteProduct(
      tenantId,
      id,
      this.branchId(req),
    );
  }
}
