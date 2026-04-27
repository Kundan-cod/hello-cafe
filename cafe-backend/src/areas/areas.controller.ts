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
import { AreasService } from './areas.service';
import { UpdateAreaDto } from './dto/update-area.dto';

@Controller('areas')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class AreasController {
  constructor(private areasService: AreasService) {}

  private branchId(req: any): string | null {
    return req.user?.branchId ?? null;
  }

  @Post()
  create(@Tenant() tenantId: string, @Req() req: any, @Body() body: any) {
    return this.areasService.createArea(tenantId, this.branchId(req), body);
  }

  @Get()
  list(@Tenant() tenantId: string, @Req() req: any) {
    return this.areasService.getAreas(tenantId, this.branchId(req));
  }

  @Get(':id')
  getOne(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.areasService.getArea(tenantId, id, this.branchId(req));
  }

  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateAreaDto,
  ) {
    return this.areasService.updateArea(tenantId, id, body, this.branchId(req));
  }

  @Patch(':id/toggle-visibility')
  toggleVisibility(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.areasService.toggleVisibility(tenantId, id, this.branchId(req));
  }

  @Delete(':id')
  remove(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.areasService.deleteArea(tenantId, id, this.branchId(req));
  }
}
