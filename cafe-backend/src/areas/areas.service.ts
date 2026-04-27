import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  private async getAreaOrThrow(
    tenantId: string,
    id: string,
    branchId?: string | null,
  ) {
    const area = await this.prisma.area.findFirst({
      where: { id, tenantId, branchId: branchId ?? null },
    });
    if (!area) {
      throw new BadRequestException('Area not found');
    }
    return area;
  }

  createArea(
    tenantId: string,
    branchId: string | null,
    data: { name: string; description?: string },
  ) {
    if (!data?.name?.trim()) {
      throw new BadRequestException('Area name is required');
    }

    const trimmedName = data.name.trim();

    if (!trimmedName) {
      throw new BadRequestException('Area name is required');
    }

    // Enforce unique active area name per (tenant + branch)
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.area.findFirst({
        where: {
          tenantId,
          name: trimmedName,
          branchId: branchId ?? null,
          isActive: true,
        },
      });

      if (existing) {
        throw new BadRequestException('Area name already exists');
      }

      const createData: any = {
        tenantId,
        branchId: branchId ?? null,
        name: trimmedName,
        description: data.description?.trim() || undefined,
      };

      return tx.area.create({ data: createData });
    });
  }

  getAreas(tenantId: string, branchId?: string | null) {
    return this.prisma.area.findMany({
      where: { tenantId, isActive: true, branchId: branchId ?? null },
      orderBy: { name: 'asc' },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: {
            id: true,
            code: true,
          },
        },
      },
    });
  }

  async getArea(tenantId: string, id: string, branchId?: string | null) {
    const area = await this.prisma.area.findFirst({
      where: { id, tenantId, branchId: branchId ?? null },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: {
            id: true,
            code: true,
          },
        },
      },
    });
    if (!area) {
      throw new BadRequestException('Area not found');
    }
    return area;
  }

  async updateArea(
    tenantId: string,
    id: string,
    data: { name?: string; description?: string },
    branchId?: string | null,
  ) {
    const area = await this.getAreaOrThrow(tenantId, id, branchId);

    const updateData: any = {};

    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Area name is required');
      }

      // Enforce unique active area name per (tenant + branch) on update
      const existing = await this.prisma.area.findFirst({
        where: {
          tenantId,
          name: trimmedName,
          branchId: branchId ?? null,
          isActive: true,
          NOT: { id },
        },
      });

      if (existing) {
        throw new BadRequestException('Area name already exists');
      }

      updateData.name = trimmedName;
    }

    if (data.description !== undefined) {
      const trimmedDescription = data.description.trim();
      updateData.description = trimmedDescription || null;
    }

    return this.prisma.area.update({
      where: { id },
      data: updateData,
    });
  }

  async toggleVisibility(
    tenantId: string,
    id: string,
    branchId?: string | null,
  ) {
    const area = await this.getAreaOrThrow(tenantId, id, branchId);
    const newIsActive = !area.isActive;

    return this.prisma.$transaction(async (tx) => {
      if (!newIsActive) {
        // When deactivating an area, also soft-delete all its active tables
        await tx.table.updateMany({
          where: {
            tenantId,
            areaId: id,
            branchId: branchId ?? null,
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      return tx.area.update({
        where: { id },
        data: { isActive: newIsActive },
      });
    });
  }

  async deleteArea(tenantId: string, id: string, branchId?: string | null) {
    // Block deleting an area if it has active tables
    const area = await this.prisma.area.findFirst({
      where: { id, tenantId, isActive: true, branchId: branchId ?? null },
      include: {
        tables: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    if (!area) {
      throw new BadRequestException('Area not found');
    }

    if (area.tables.length > 0) {
      throw new BadRequestException(
        'Cannot delete area with active tables. Hide or remove tables first.',
      );
    }

    await this.prisma.area.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }
}
