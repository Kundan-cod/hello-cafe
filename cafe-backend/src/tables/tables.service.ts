import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) {}

  async createTable(
    tenantId: string,
    branchId: string | null,
    data: { code: string; areaId: string; capacity: number },
  ) {
    if (!data?.code?.trim()) {
      throw new BadRequestException('Table code is required');
    }
    if (!data?.areaId) {
      throw new BadRequestException('Area is required');
    }
    if (!data?.capacity || data.capacity < 1) {
      throw new BadRequestException('Capacity must be at least 1');
    }

    const areaWhere: any = { id: data.areaId, tenantId, isActive: true };
    if (branchId) areaWhere.branchId = branchId;
    const area = await this.prisma.area.findFirst({
      where: areaWhere,
    });
    if (!area) {
      throw new BadRequestException('Invalid area');
    }

    const createData: any = {
      tenantId,
      areaId: data.areaId,
      code: data.code.trim(),
      capacity: data.capacity,
    };
    if (branchId) createData.branchId = branchId;
    return this.prisma.table.create({
      data: createData,
      include: { area: true },
    });
  }

  getTables(tenantId: string, branchId?: string | null) {
    return this.prisma.table.findMany({
      where: { tenantId, isActive: true, branchId: branchId ?? null },
      orderBy: { createdAt: 'asc' },
      include: { area: true },
    });
  }

  async getTable(tenantId: string, id: string, branchId?: string | null) {
    const table = await this.prisma.table.findFirst({
      where: { id, tenantId, branchId: branchId ?? null },
      include: { area: true },
    });
    if (!table) {
      throw new BadRequestException('Table not found');
    }
    return table;
  }

  async updateTable(
    tenantId: string,
    id: string,
    data: {
      code?: string;
      areaId?: string;
      capacity?: number;
      status?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
    },
    branchId?: string | null,
  ) {
    const table = await this.prisma.table.findFirst({
      where: { id, tenantId, branchId: branchId ?? null },
    });
    if (!table) {
      throw new BadRequestException('Table not found');
    }

    if (data.areaId) {
      const areaWhere: any = { id: data.areaId, tenantId, isActive: true };
      if (branchId) areaWhere.branchId = branchId;
      const area = await this.prisma.area.findFirst({
        where: areaWhere,
      });
      if (!area) {
        throw new BadRequestException('Invalid area');
      }
    }

    return this.prisma.table.update({
      where: { id },
      data: {
        code: data.code?.trim() || undefined,
        areaId: data.areaId || undefined,
        capacity: data.capacity || undefined,
        status: data.status || undefined,
      },
      include: { area: true },
    });
  }

  async toggleVisibility(
    tenantId: string,
    id: string,
    branchId?: string | null,
  ) {
    const table = await this.prisma.table.findFirst({
      where: { id, tenantId, branchId: branchId ?? null },
    });
    if (!table) {
      throw new BadRequestException('Table not found');
    }

    return this.prisma.table.update({
      where: { id },
      data: { isActive: !table.isActive },
      include: { area: true },
    });
  }

  async deleteTable(tenantId: string, id: string, branchId?: string | null) {
    const res = await this.prisma.table.updateMany({
      where: { id, tenantId, isActive: true, branchId: branchId ?? null },
      data: { isActive: false },
    });

    if (res.count === 0) {
      throw new BadRequestException('Table not found');
    }

    return { success: true };
  }
}
