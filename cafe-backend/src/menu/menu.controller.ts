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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveSubscriptionGuard } from '../billing/active-subscription.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Controller('menu')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class MenuController {
  constructor(private menuService: MenuService) {}

  private branchId(req: any): string | null {
    return req.user?.branchId ?? null;
  }

  // CATEGORY

  @Post('category')
  createCategory(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Body() body: { name: string; imageUrl?: string },
  ) {
    return this.menuService.createCategory(
      tenantId,
      this.branchId(req),
      body.name,
      body.imageUrl,
    );
  }

  @Get('category')
  getCategories(@Tenant() tenantId: string, @Req() req: any) {
    return this.menuService.getCategories(tenantId, this.branchId(req));
  }

  @Get('category/:id')
  getCategory(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.menuService.getCategory(tenantId, id, this.branchId(req));
  }

  @Patch('category/:id')
  updateCategory(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.menuService.updateCategory(
      tenantId,
      id,
      body,
      this.branchId(req),
    );
  }

  @Patch('category/:id/toggle-visibility')
  toggleCategoryVisibility(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.menuService.toggleCategoryVisibility(
      tenantId,
      id,
      this.branchId(req),
    );
  }

  @Delete('category/:id')
  deleteCategory(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.menuService.deleteCategory(tenantId, id, this.branchId(req));
  }

  @Post('bulk-csv')
  @UseInterceptors(FileInterceptor('file'))
  bulkUploadFromCsv(
    @Tenant() tenantId: string,
    @Req() req: any,
    @UploadedFile() file: any,
  ) {
    return this.menuService.bulkUploadFromCsv(
      tenantId,
      this.branchId(req),
      file,
    );
  }

  // ITEMS

  @Post('item')
  createItem(@Tenant() tenantId: string, @Req() req: any, @Body() body: any) {
    return this.menuService.createItem(tenantId, this.branchId(req), body);
  }

  @Get('item')
  getItems(@Tenant() tenantId: string, @Req() req: any) {
    return this.menuService.getItems(tenantId, this.branchId(req));
  }

  @Get('item/:id')
  getItem(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.menuService.getItem(tenantId, id, this.branchId(req));
  }

  @Patch('item/:id')
  updateItem(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateMenuItemDto,
  ) {
    return this.menuService.updateItem(tenantId, id, body, this.branchId(req));
  }

  @Patch('item/:id/toggle-visibility')
  toggleItemVisibility(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.menuService.toggleItemVisibility(
      tenantId,
      id,
      this.branchId(req),
    );
  }

  @Delete('item/:id')
  deleteItem(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.menuService.deleteItem(tenantId, id, this.branchId(req));
  }
}
