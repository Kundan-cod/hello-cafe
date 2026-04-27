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
import { TablesService } from './tables.service';
import { UpdateTableDto } from './dto/update-table.dto';

@Controller('tables')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class TablesController {
  constructor(private tablesService: TablesService) {}

  private branchId(req: any): string | null {
    return req.user?.branchId ?? null;
  }

  @Post()
  create(@Tenant() tenantId: string, @Req() req: any, @Body() body: any) {
    return this.tablesService.createTable(tenantId, this.branchId(req), body);
  }

  @Get()
  list(@Tenant() tenantId: string, @Req() req: any) {
    return this.tablesService.getTables(tenantId, this.branchId(req));
  }

  @Get(':id')
  getOne(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.tablesService.getTable(tenantId, id, this.branchId(req));
  }

  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateTableDto,
  ) {
    return this.tablesService.updateTable(
      tenantId,
      id,
      body,
      this.branchId(req),
    );
  }

  @Patch(':id/toggle-visibility')
  toggleVisibility(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.tablesService.toggleVisibility(
      tenantId,
      id,
      this.branchId(req),
    );
  }

  @Delete(':id')
  remove(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.tablesService.deleteTable(tenantId, id, this.branchId(req));
  }
}
