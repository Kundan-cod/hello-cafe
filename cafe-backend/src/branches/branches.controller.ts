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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Post()
  create(@Req() req: any, @Body() body: CreateBranchDto) {
    return this.branchesService.create(
      req.user.tenantId,
      req.user.userId,
      req.user.role,
      body,
    );
  }

  @Get()
  findAll(@Req() req: any) {
    return this.branchesService.findAll(
      req.user.tenantId,
      req.user.userId,
      req.user.role,
    );
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.branchesService.findOne(
      req.user.tenantId,
      req.user.userId,
      req.user.role,
      id,
    );
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateBranchDto,
  ) {
    return this.branchesService.update(
      req.user.tenantId,
      req.user.userId,
      req.user.role,
      id,
      body,
    );
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.branchesService.remove(
      req.user.tenantId,
      req.user.userId,
      req.user.role,
      id,
    );
  }
}
