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
import { CombosService } from './combos.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';

@Controller('combos')
@UseGuards(JwtAuthGuard, ActiveSubscriptionGuard)
export class CombosController {
  constructor(private combosService: CombosService) {}

  private branchId(req: any): string | null {
    return req.user?.branchId ?? null;
  }

  @Get()
  list(@Tenant() tenantId: string, @Req() req: any) {
    return this.combosService.getCombos(tenantId, this.branchId(req));
  }

  @Get(':id')
  getOne(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.combosService.getCombo(tenantId, id, this.branchId(req));
  }

  @Post()
  create(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Body() body: CreateComboDto,
  ) {
    return this.combosService.createCombo(tenantId, this.branchId(req), body);
  }

  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateComboDto,
  ) {
    return this.combosService.updateCombo(
      tenantId,
      id,
      body,
      this.branchId(req),
    );
  }

  @Delete(':id')
  remove(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    return this.combosService.deleteCombo(tenantId, id, this.branchId(req));
  }
}
