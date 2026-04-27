import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryProductDto } from './dto/create-inventory-product.dto';
import { UpdateInventoryProductDto } from './dto/update-inventory-product.dto';
import { MenuItemUsageDto } from './dto/menu-item-usage.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async createProduct(
    tenantId: string,
    branchId: string | null,
    data: CreateInventoryProductDto,
  ) {
    const createData: any = {
      tenantId,
      name: data.name.trim(),
      unit: data.unit.trim(),
    };
    if (branchId) createData.branchId = branchId;
    return this.prisma.inventoryProduct.create({ data: createData });
  }

  getProducts(tenantId: string, branchId?: string | null) {
    return this.prisma.inventoryProduct.findMany({
      where: {
        tenantId,
        branchId: branchId ?? null,
      },
      orderBy: { name: 'asc' },
      include: {
        usages: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async getProduct(tenantId: string, id: string, branchId?: string | null) {
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { id, tenantId, branchId: branchId ?? null },
      include: {
        usages: {
          include: {
            menuItem: { select: { id: true, name: true, categoryId: true } },
          },
        },
      },
    });
    if (!product) throw new BadRequestException('Inventory product not found');
    return product;
  }

  async updateProduct(
    tenantId: string,
    id: string,
    data: UpdateInventoryProductDto,
    branchId?: string | null,
  ) {
    await this.getProduct(tenantId, id, branchId);
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.unit !== undefined) updateData.unit = data.unit.trim();
    return this.prisma.inventoryProduct.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteProduct(tenantId: string, id: string, branchId?: string | null) {
    await this.getProduct(tenantId, id, branchId);
    await this.prisma.inventoryProduct.delete({ where: { id } });
    return { success: true };
  }

  /** Add stock (adjustment). Uses atomic update to avoid race. */
  async addStock(
    tenantId: string,
    productId: string,
    quantity: number,
    note?: string,
    branchId?: string | null,
  ) {
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { id: productId, tenantId, branchId: branchId ?? null },
    });
    if (!product) throw new BadRequestException('Inventory product not found');
    if (quantity <= 0)
      throw new BadRequestException('Quantity must be positive');

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryProduct.update({
        where: { id: productId },
        data: { currentQuantity: { increment: quantity } },
      });
      await tx.inventoryStockHistory.create({
        data: {
          inventoryProductId: productId,
          quantityChange: quantity,
          type: 'ADJUSTMENT',
          note: note?.trim() || 'Stock added',
        },
      });
      return this.prisma.inventoryProduct.findUniqueOrThrow({
        where: { id: productId },
      });
    });
  }

  getStockHistory(productId: string, limit = 100) {
    return this.prisma.inventoryStockHistory.findMany({
      where: { inventoryProductId: productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Set which menu items use this inventory product and how much per unit. Replaces existing usages for the menu item. */
  async setMenuItemUsages(
    tenantId: string,
    menuItemId: string,
    usages: MenuItemUsageDto[],
    branchId?: string | null,
  ) {
    const menuItem = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, tenantId, branchId: branchId ?? null },
    });
    if (!menuItem) throw new BadRequestException('Menu item not found');

    const productIds = [...new Set(usages.map((u) => u.inventoryProductId))];
    const products = await this.prisma.inventoryProduct.findMany({
      where: {
        id: { in: productIds },
        tenantId,
        branchId: branchId ?? null,
      },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more inventory products not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.menuItemInventoryUsage.deleteMany({
        where: { menuItemId },
      });
      if (usages.length > 0) {
        await tx.menuItemInventoryUsage.createMany({
          data: usages.map((u) => ({
            menuItemId,
            inventoryProductId: u.inventoryProductId,
            quantityPerUnit: u.quantityPerUnit,
          })),
        });
      }
      return tx.menuItemInventoryUsage.findMany({
        where: { menuItemId },
        include: {
          inventory: { select: { id: true, name: true, unit: true } },
        },
      });
    });
  }

  /**
   * Set which menu items use this inventory product and how much per unit.
   * Replaces only this product's links (does not touch other products linked to the same menu items).
   */
  async setProductMenuLinks(
    tenantId: string,
    productId: string,
    links: { menuItemId: string; quantityPerUnit: number }[],
    branchId?: string | null,
  ) {
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { id: productId, tenantId, branchId: branchId ?? null },
    });
    if (!product) throw new BadRequestException('Inventory product not found');

    const menuItemIds = [...new Set(links.map((l) => l.menuItemId))];
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        tenantId,
        branchId: branchId ?? null,
      },
    });
    if (menuItems.length !== menuItemIds.length) {
      throw new BadRequestException('One or more menu items not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.menuItemInventoryUsage.deleteMany({
        where: { inventoryProductId: productId },
      });
      if (links.length > 0) {
        await tx.menuItemInventoryUsage.createMany({
          data: links.map((l) => ({
            inventoryProductId: productId,
            menuItemId: l.menuItemId,
            quantityPerUnit: l.quantityPerUnit,
          })),
        });
      }
      return tx.menuItemInventoryUsage.findMany({
        where: { inventoryProductId: productId },
        include: {
          menuItem: { select: { id: true, name: true } },
        },
      });
    });
  }

  /** Get inventory usages for a menu item (which products and how much per unit). */
  getMenuItemUsages(
    tenantId: string,
    menuItemId: string,
    branchId?: string | null,
  ) {
    return this.prisma.menuItemInventoryUsage.findMany({
      where: {
        menuItemId,
        menuItem: {
          tenantId,
          branchId: branchId ?? null,
        },
      },
      include: {
        inventory: {
          select: { id: true, name: true, unit: true, currentQuantity: true },
        },
      },
    });
  }

  /**
   * Deduct inventory for an order (used when order is completed).
   * Caller must run this inside the same transaction as order completion to avoid race.
   * Uses atomic UPDATE ... WHERE currentQuantity >= deduction to prevent negative stock.
   */
  async deductStockForOrder(
    tx: Pick<
      PrismaService,
      | 'menuItemInventoryUsage'
      | 'inventoryProduct'
      | 'inventoryStockHistory'
      | '$executeRaw'
    >,
    tenantId: string,
    branchId: string | null,
    orderId: string,
    items: { menuItemId: string; quantity: number }[],
  ) {
    if (items.length === 0) return;

    const menuItemIds = [...new Set(items.map((i) => i.menuItemId))];
    const usages = await tx.menuItemInventoryUsage.findMany({
      where: { menuItemId: { in: menuItemIds } },
      include: { inventory: true },
    });

    const branchFilter = (inv: { tenantId: string; branchId: string | null }) =>
      inv.tenantId === tenantId && inv.branchId === branchId;
    const filteredUsages = usages.filter((u) => branchFilter(u.inventory));

    const deductions: Record<string, number> = {};
    for (const orderItem of items) {
      const itemUsages = filteredUsages.filter(
        (u) => u.menuItemId === orderItem.menuItemId,
      );
      for (const u of itemUsages) {
        const key = u.inventoryProductId;
        deductions[key] =
          (deductions[key] || 0) + u.quantityPerUnit * orderItem.quantity;
      }
    }

    for (const [inventoryProductId, amount] of Object.entries(deductions)) {
      if (amount <= 0) continue;
      const updated = await tx.$executeRaw`
        UPDATE "InventoryProduct"
        SET "currentQuantity" = "currentQuantity" - ${amount},
            "updatedAt" = NOW()
        WHERE id = ${inventoryProductId}
          AND "currentQuantity" >= ${amount}
      `;
      if (updated === 0) {
        const prod = await tx.inventoryProduct.findUnique({
          where: { id: inventoryProductId },
          select: { name: true, currentQuantity: true },
        });
        throw new BadRequestException(
          prod
            ? `Insufficient inventory for "${prod.name}" (available: ${prod.currentQuantity}, needed: ${amount})`
            : 'Insufficient inventory for one or more products',
        );
      }
      await tx.inventoryStockHistory.create({
        data: {
          inventoryProductId,
          quantityChange: -amount,
          type: 'SALE',
          referenceId: orderId,
          note: 'Order completed',
        },
      });
    }
  }
}
