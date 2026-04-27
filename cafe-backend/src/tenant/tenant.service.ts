import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async getTenantSettings(tenantId: string, branchId?: string | null) {
    // If branchId provided and branch has orderManagementType, use it; else use tenant's
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
        select: { orderManagementType: true },
      });
      if (branch?.orderManagementType != null) {
        return { orderManagementType: branch.orderManagementType };
      }
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        orderManagementType: true,
        planType: true,
        currentSubscriptionEnd: true,
      },
    });
    if (!tenant) return null;
    return {
      orderManagementType: tenant.orderManagementType ?? null,
      planType: tenant.planType ?? null,
      currentSubscriptionEnd: tenant.currentSubscriptionEnd ?? null,
    };
  }

  async updateTenantSettings(
    tenantId: string,
    data: { orderManagementType: 'TABLE_BASED' | 'COUNTER_BASED' | 'BOTH' },
  ) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { orderManagementType: data.orderManagementType },
    });
    // Keep all branches in sync with tenant (same orderManagementType)
    await this.prisma.branch.updateMany({
      where: { tenantId },
      data: { orderManagementType: data.orderManagementType },
    });
    return this.getTenantSettings(tenantId, undefined);
  }
}
