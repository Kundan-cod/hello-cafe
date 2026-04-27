import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';

@Injectable()
export class CombosService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper to scope combo operations to the current tenant/branch.
   * Always use the SAME where clause for read + write to avoid cross-tenant updates.
   */
  private buildScopedWhere(
    id: string,
    tenantId: string,
    branchId?: string | null,
  ) {
    return {
      id,
      tenantId,
      branchId: branchId ?? null,
    };
  }

  getCombos(tenantId: string, branchId?: string | null) {
    return this.prisma.combo.findMany({
      where: { tenantId, isActive: true, branchId: branchId ?? null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCombo(tenantId: string, id: string, branchId?: string | null) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const combo = await this.prisma.combo.findFirst({
      where: { ...where, isActive: true },
    });
    if (!combo) {
      throw new BadRequestException('Combo not found');
    }
    return combo;
  }

  async createCombo(
    tenantId: string,
    branchId: string | null,
    data: CreateComboDto,
  ) {
    if (!data.name?.trim()) {
      throw new BadRequestException('Combo name is required');
    }

    if (data.price == null || !Number.isFinite(data.price) || data.price <= 0) {
      throw new BadRequestException('Combo price must be a positive number');
    }

    const validItems =
      data.items?.map((i) => ({
        name: i.name?.trim() || '',
        menuItemId: (i as any).menuItemId ?? undefined,
      })) ?? [];
    const nonEmptyItems = validItems.filter((i) => i.name);
    if (nonEmptyItems.length === 0) {
      throw new BadRequestException('At least one combo item is required');
    }

    const createData: any = {
      tenantId,
      name: data.name.trim(),
      price: data.price,
      description: data.description?.trim() || undefined,
      imageUrl: data.imageUrl?.trim() || undefined,
      // Store both menuItemId and name when available; name is required.
      items: nonEmptyItems as any,
    };
    if (branchId) createData.branchId = branchId;
    return this.prisma.combo.create({ data: createData });
  }

  async updateCombo(
    tenantId: string,
    id: string,
    data: UpdateComboDto,
    branchId?: string | null,
  ) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const combo = await this.prisma.combo.findFirst({
      where: { ...where, isActive: true },
    });
    if (!combo) {
      throw new BadRequestException('Combo not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Combo name is required');
      }
      updateData.name = trimmedName;
    }
    if (data.price !== undefined) {
      if (
        data.price == null ||
        !Number.isFinite(data.price) ||
        data.price <= 0
      ) {
        throw new BadRequestException('Combo price must be a positive number');
      }
      updateData.price = data.price;
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || undefined;
    }
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl?.trim() || undefined;
    }

    if (data.items !== undefined) {
      const validItems =
        data.items?.map((i) => ({
          name: i.name?.trim() || '',
          menuItemId: (i as any).menuItemId ?? undefined,
        })) ?? [];
      const nonEmptyItems = validItems.filter((i) => i.name);
      if (nonEmptyItems.length === 0) {
        throw new BadRequestException('At least one combo item is required');
      }
      updateData.items = nonEmptyItems as any;
    }

    const res = await this.prisma.combo.updateMany({
      where,
      data: updateData,
    });
    if (res.count === 0) {
      throw new BadRequestException('Combo not found');
    }

    return this.prisma.combo.findFirst({
      where,
    });
  }

  async deleteCombo(tenantId: string, id: string, branchId?: string | null) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const combo = await this.prisma.combo.findFirst({
      where: { ...where, isActive: true },
    });
    if (!combo) {
      throw new BadRequestException('Combo not found');
    }

    // Soft delete: deactivate combo instead of removing it.
    await this.prisma.combo.updateMany({
      where,
      data: { isActive: false },
    });

    return { success: true };
  }
}
