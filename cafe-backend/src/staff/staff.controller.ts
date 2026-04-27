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
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@Controller('staff')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Get()
  list(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('role') role?: 'STAFF' | 'BRANCH_OWNER',
  ) {
    const effectiveBranchId = req.user?.branchId ?? branchId ?? null;
    return this.staffService.getStaff(
      tenantId,
      effectiveBranchId,
      role ?? null,
    );
  }

  @Get('branches-options')
  getBranchesOptions(@Tenant() tenantId: string, @Req() req: any) {
    return this.staffService.getBranchesForSelect(
      tenantId,
      req.user?.role,
      req.user?.branchId ?? null,
    );
  }

  @Post()
  create(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Body() body: CreateStaffDto,
  ) {
    return this.staffService.createStaff(
      tenantId,
      req.user.role,
      req.user.branchId ?? null,
      body,
    );
  }

  @Get(':id')
  getOne(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.staffService.getStaffById(tenantId, id);
  }

  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateStaffDto,
  ) {
    return this.staffService.updateStaff(
      tenantId,
      id,
      body,
      req.user.role,
      req.user?.branchId ?? null,
    );
  }

  @Delete(':id')
  remove(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.staffService.deleteStaff(
      tenantId,
      id,
      req.user.role,
      req.user?.branchId ?? null,
    );
  }
}
