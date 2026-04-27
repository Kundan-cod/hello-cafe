import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper to scope discount operations to the current tenant/branch.
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

  async createDiscount(
    tenantId: string,
    branchId: string | null,
    data: {
      name: string;
      code?: string;
      type: 'PERCENTAGE' | 'FIXED_AMOUNT';
      value: number;
      scope?: 'ALL' | 'CATEGORY' | 'ITEM';
      categoryIds?: string[];
      menuItemIds?: string[];
      minOrderAmount?: number;
      validFrom?: string;
      validTo?: string;
    },
  ) {
    if (!data?.name?.trim()) {
      throw new BadRequestException('Offer name is required');
    }
    if (data.type === 'PERCENTAGE' && (data.value < 0 || data.value > 100)) {
      throw new BadRequestException('Percentage must be between 0 and 100');
    }
    if (data.type === 'FIXED_AMOUNT' && data.value < 0) {
      throw new BadRequestException('Fixed amount cannot be negative');
    }

    const scope = data.scope || 'ALL';
    if (
      scope === 'CATEGORY' &&
      (!data.categoryIds || data.categoryIds.length === 0)
    ) {
      throw new BadRequestException(
        'Select at least one category for category scope',
      );
    }
    if (
      scope === 'ITEM' &&
      (!data.menuItemIds || data.menuItemIds.length === 0)
    ) {
      throw new BadRequestException('Select at least one item for item scope');
    }

    const code = data.code?.trim().toUpperCase() || undefined;
    if (code) {
      // Prevent duplicate ACTIVE codes per (tenantId, branchId).
      const existingWhere: any = { tenantId, code, isActive: true };
      if (branchId != null) existingWhere.branchId = branchId;
      else existingWhere.branchId = null;
      const existing = await this.prisma.discount.findFirst({
        where: existingWhere,
      });
      if (existing) {
        throw new BadRequestException('Offer code already exists');
      }
    }

    const createData: any = {
      tenantId,
      name: data.name.trim(),
      code: code || null,
      type: data.type,
      value: data.value,
      scope,
      categoryIds:
        scope === 'CATEGORY' && data.categoryIds?.length
          ? data.categoryIds
          : Prisma.JsonNull,
      menuItemIds:
        scope === 'ITEM' && data.menuItemIds?.length
          ? data.menuItemIds
          : Prisma.JsonNull,
      minOrderAmount: data.minOrderAmount ?? null,
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validTo: data.validTo ? new Date(data.validTo) : null,
    };
    if (branchId) createData.branchId = branchId;
    return this.prisma.discount.create({ data: createData });
  }

  getDiscounts(tenantId: string, activeOnly = false, branchId?: string | null) {
    return this.prisma.discount.findMany({
      where: {
        tenantId,
        branchId: branchId ?? null,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getActiveDiscountsForOrder(tenantId: string, branchId?: string | null) {
    const now = new Date();
    return this.prisma.discount.findMany({
      where: {
        tenantId,
        branchId: branchId ?? null,
        isActive: true,
        OR: [
          { validFrom: null, validTo: null },
          {
            validFrom: { lte: now },
            validTo: { gte: now },
          },
          { validFrom: null, validTo: { gte: now } },
          { validFrom: { lte: now }, validTo: null },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Compute eligible subtotal from order items based on offer scope */
  private getEligibleSubTotal(
    offer: { scope: string; categoryIds: unknown; menuItemIds: unknown },
    items: {
      menuItemId: string;
      categoryId: string | null;
      price: number;
      quantity: number;
    }[],
  ): number {
    let eligible = 0;
    const categoryIds = (offer.categoryIds as string[] | null) || [];
    const menuItemIds = (offer.menuItemIds as string[] | null) || [];

    for (const item of items) {
      let match = false;
      if (offer.scope === 'ALL') {
        match = true;
      } else if (
        offer.scope === 'CATEGORY' &&
        item.categoryId &&
        categoryIds.includes(item.categoryId)
      ) {
        match = true;
      } else if (
        offer.scope === 'ITEM' &&
        menuItemIds.includes(item.menuItemId)
      ) {
        match = true;
      }
      if (match) {
        eligible += item.price * item.quantity;
      }
    }
    return eligible;
  }

  async applyWithOrder(
    tenantId: string,
    branchId: string | null,
    code: string,
    items: {
      menuItemId: string;
      categoryId: string | null;
      price: number;
      quantity: number;
    }[],
  ): Promise<{
    offer: any;
    discountAmount: number;
    eligibleSubTotal: number;
  } | null> {
    const offerWhere: any = {
      tenantId,
      isActive: true,
      code: code.trim().toUpperCase(),
    };
    if (branchId != null) offerWhere.branchId = branchId;
    else offerWhere.branchId = null;
    const offer = await this.prisma.discount.findFirst({
      where: offerWhere,
    });
    if (!offer) return null;

    const now = new Date();
    if (offer.validFrom && new Date(offer.validFrom) > now) return null;
    if (offer.validTo && new Date(offer.validTo) < now) return null;

    const eligibleSubTotal = this.getEligibleSubTotal(offer, items);
    if (
      offer.minOrderAmount != null &&
      eligibleSubTotal < offer.minOrderAmount
    ) {
      return null;
    }

    const discountAmount =
      offer.type === 'PERCENTAGE'
        ? (eligibleSubTotal * offer.value) / 100
        : Math.min(offer.value, eligibleSubTotal);

    return { offer, discountAmount, eligibleSubTotal };
  }

  async getDiscountByCode(
    tenantId: string,
    branchId: string | null,
    code: string,
    orderSubTotal: number,
  ) {
    const offerWhere: any = {
      tenantId,
      isActive: true,
      code: code.trim().toUpperCase(),
    };
    if (branchId != null) offerWhere.branchId = branchId;
    else offerWhere.branchId = null;
    const offer = await this.prisma.discount.findFirst({
      where: offerWhere,
    });
    if (!offer) return null;

    const now = new Date();
    if (offer.validFrom && new Date(offer.validFrom) > now) return null;
    if (offer.validTo && new Date(offer.validTo) < now) return null;

    // Treat the incoming subtotal as the **eligible subtotal** for this offer's scope.
    const eligibleSubTotal = orderSubTotal;

    if (
      offer.minOrderAmount != null &&
      eligibleSubTotal < offer.minOrderAmount
    ) {
      return null;
    }

    const discountAmount =
      offer.type === 'PERCENTAGE'
        ? (eligibleSubTotal * offer.value) / 100
        : Math.min(offer.value, eligibleSubTotal);

    return { ...offer, computedAmount: discountAmount, eligibleSubTotal };
  }

  async getDiscount(tenantId: string, id: string, branchId?: string | null) {
    const discount = await this.prisma.discount.findFirst({
      where: this.buildScopedWhere(id, tenantId, branchId),
    });
    if (!discount) {
      throw new BadRequestException('Offer not found');
    }
    return discount;
  }

  async updateDiscount(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      code?: string;
      type?: 'PERCENTAGE' | 'FIXED_AMOUNT';
      value?: number;
      scope?: 'ALL' | 'CATEGORY' | 'ITEM';
      categoryIds?: string[] | null;
      menuItemIds?: string[] | null;
      minOrderAmount?: number;
      validFrom?: string | null;
      validTo?: string | null;
      isActive?: boolean;
    },
    branchId?: string | null,
  ) {
    const where = this.buildScopedWhere(id, tenantId, branchId);

    const discount = await this.prisma.discount.findFirst({
      where,
    });
    if (!discount) {
      throw new BadRequestException('Offer not found');
    }

    if (
      data.type === 'PERCENTAGE' &&
      data.value != null &&
      (data.value < 0 || data.value > 100)
    ) {
      throw new BadRequestException('Percentage must be between 0 and 100');
    }
    if (data.type === 'FIXED_AMOUNT' && data.value != null && data.value < 0) {
      throw new BadRequestException('Fixed amount cannot be negative');
    }

    const code =
      data.code !== undefined
        ? data.code?.trim().toUpperCase() || null
        : undefined;
    if (code !== undefined && code) {
      const existingWhere: any = {
        tenantId,
        code,
        isActive: true,
        id: { not: id },
      };
      if (branchId != null) existingWhere.branchId = branchId;
      else existingWhere.branchId = null;
      const existing = await this.prisma.discount.findFirst({
        where: existingWhere,
      });
      if (existing) {
        throw new BadRequestException('Offer code already exists');
      }
    }

    if (data.scope === 'CATEGORY' && data.categoryIds?.length === 0) {
      throw new BadRequestException(
        'Select at least one category for category scope',
      );
    }
    if (data.scope === 'ITEM' && data.menuItemIds?.length === 0) {
      throw new BadRequestException('Select at least one item for item scope');
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.code !== undefined) updateData.code = code;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.value !== undefined) updateData.value = data.value;

    if (data.scope !== undefined) {
      updateData.scope = data.scope;

      // When scope changes, always clear JSON fields that are no longer applicable
      // so we never leave stale categoryIds/menuItemIds behind.
      if (data.scope === 'ALL') {
        updateData.categoryIds = Prisma.JsonNull;
        updateData.menuItemIds = Prisma.JsonNull;
      } else if (data.scope === 'CATEGORY') {
        // Category-scoped offers should not retain item-specific JSON.
        updateData.menuItemIds = Prisma.JsonNull;
      } else if (data.scope === 'ITEM') {
        // Item-scoped offers should not retain category-specific JSON.
        updateData.categoryIds = Prisma.JsonNull;
      }
    }

    // Explicit `undefined` means "do not change".
    // Explicit `null` means "clear" (store Prisma.JsonNull).
    if (data.categoryIds !== undefined) {
      updateData.categoryIds =
        data.categoryIds === null ? Prisma.JsonNull : data.categoryIds;
    }
    if (data.menuItemIds !== undefined) {
      updateData.menuItemIds =
        data.menuItemIds === null ? Prisma.JsonNull : data.menuItemIds;
    }

    // Allow 0 as a valid minOrderAmount – do not coerce to undefined.
    if (data.minOrderAmount !== undefined) {
      updateData.minOrderAmount = data.minOrderAmount;
    }
    if (data.validFrom !== undefined)
      updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    if (data.validTo !== undefined)
      updateData.validTo = data.validTo ? new Date(data.validTo) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Use tenant/branch-scoped updateMany for safety; then re-fetch updated record.
    const res = await this.prisma.discount.updateMany({
      where,
      data: updateData as any,
    });
    if (res.count === 0) {
      throw new BadRequestException('Offer not found');
    }

    return this.prisma.discount.findFirst({
      where,
    });
  }

  async deleteDiscount(tenantId: string, id: string, branchId?: string | null) {
    const where = this.buildScopedWhere(id, tenantId, branchId);

    const res = await this.prisma.discount.updateMany({
      // Soft delete: deactivate the discount instead of removing it.
      where,
      data: { isActive: false },
    });
    if (res.count === 0) {
      throw new BadRequestException('Offer not found');
    }
    return { success: true };
  }
}
