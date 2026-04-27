import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveSubscriptionGuard } from '../billing/active-subscription.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Controller('tenant')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class TenantController {
  constructor(private tenantService: TenantService) {}

  @Get('me')
  getMe(
    @Tenant() tenantId: string,
    @Query('branchId') branchIdQuery?: string | string[],
    @Req() req?: any,
  ) {
    // Use query param first; fall back to JWT branchId (branch owners have it)
    const fromQuery = Array.isArray(branchIdQuery)
      ? branchIdQuery[0]
      : branchIdQuery;
    const branchId =
      (typeof fromQuery === 'string' && fromQuery.trim()) ||
      req?.user?.branchId ||
      undefined;
    return this.tenantService.getTenantSettings(tenantId, branchId);
  }

  @Patch('me')
  updateMe(
    @Tenant() tenantId: string,
    @Body() body: UpdateTenantDto,
    @Req() req: any,
  ) {
    if (req?.user?.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only the cafe owner can update cafe settings',
      );
    }
    return this.tenantService.updateTenantSettings(tenantId, body);
  }
}
