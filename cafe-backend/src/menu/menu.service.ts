import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper to scope category/item operations to the current tenant/branch.
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

  // CATEGORY

  async createCategory(
    tenantId: string,
    branchId: string | null,
    name: string,
    imageUrl?: string,
  ) {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      throw new BadRequestException('Category name is required');
    }

    // Prevent duplicate ACTIVE category names per (tenantId, branchId).
    const existing = await this.prisma.menuCategory.findFirst({
      where: {
        tenantId,
        name: trimmedName,
        isActive: true,
        branchId: branchId ?? null,
      },
    });
    if (existing) {
      throw new BadRequestException('Category name already exists');
    }

    const data: any = {
      name: trimmedName,
      tenantId,
      imageUrl: imageUrl?.trim() || undefined,
    };
    if (branchId) data.branchId = branchId;
    return this.prisma.menuCategory.create({ data });
  }

  getCategories(tenantId: string, branchId?: string | null) {
    const where: any = {
      tenantId,
      isActive: true,
      branchId: branchId ?? null,
    };
    return this.prisma.menuCategory.findMany({
      where,
      include: {
        items: {
          where: { isAvailable: true },
        },
      },
    });
  }

  async getCategory(tenantId: string, id: string, branchId?: string | null) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const category = await this.prisma.menuCategory.findFirst({
      where,
      include: {
        items: {
          where: { isAvailable: true },
        },
      },
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }
    return category;
  }

  async updateCategory(
    tenantId: string,
    id: string,
    data: { name?: string; imageUrl?: string },
    branchId?: string | null,
  ) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const category = await this.prisma.menuCategory.findFirst({
      where,
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }

    if (!category.isActive) {
      throw new BadRequestException('Cannot update inactive category');
    }

    const updateData: any = {};
    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Category name is required');
      }

      // Enforce uniqueness for ACTIVE categories when renaming.
      const existing = await this.prisma.menuCategory.findFirst({
        where: {
          tenantId,
          name: trimmedName,
          isActive: true,
          branchId: branchId ?? null,
          id: { not: id },
        },
      });
      if (existing) {
        throw new BadRequestException('Category name already exists');
      }

      updateData.name = trimmedName;
    }
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl?.trim() || undefined;
    }

    const res = await this.prisma.menuCategory.updateMany({
      where: { ...where, isActive: true },
      data: updateData,
    });
    if (res.count === 0) {
      throw new BadRequestException('Category not found');
    }

    return this.prisma.menuCategory.findFirst({
      where: { ...where, isActive: true },
      include: {
        items: {
          where: { isAvailable: true },
        },
      },
    });
  }

  async toggleCategoryVisibility(
    tenantId: string,
    id: string,
    branchId?: string | null,
  ) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const category = await this.prisma.menuCategory.findFirst({
      where,
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }

    const nextIsActive = !category.isActive;

    // When a category is deactivated, also soft-delete its items so they are removed from billing.
    if (!nextIsActive) {
      await this.prisma.menuItem.updateMany({
        where: {
          tenantId,
          categoryId: id,
          isAvailable: true,
          branchId: branchId ?? null,
        },
        data: { isAvailable: false },
      });
    }

    const res = await this.prisma.menuCategory.updateMany({
      where,
      data: { isActive: nextIsActive },
    });
    if (res.count === 0) {
      throw new BadRequestException('Category not found');
    }

    return this.prisma.menuCategory.findFirst({
      where: { ...where, isActive: nextIsActive },
      include: {
        items: {
          where: { isAvailable: true },
        },
      },
    });
  }

  async deleteCategory(tenantId: string, id: string, branchId?: string | null) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const category = await this.prisma.menuCategory.findFirst({
      where,
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }

    // Soft delete: deactivate category and cascade-hide its items from billing.
    await this.prisma.menuItem.updateMany({
      where: {
        tenantId,
        categoryId: id,
        isAvailable: true,
        branchId: branchId ?? null,
      },
      data: { isAvailable: false },
    });

    const res = await this.prisma.menuCategory.updateMany({
      where,
      data: { isActive: false },
    });

    if (res.count === 0) {
      throw new BadRequestException('Category not found');
    }

    return { success: true };
  }

  // ITEMS

  async createItem(
    tenantId: string,
    branchId: string | null,
    data: {
      name: string;
      price: number;
      categoryId: string;
      imageUrl?: string;
    },
  ) {
    if (!data.name?.trim()) {
      throw new BadRequestException('Menu item name is required');
    }

    if (data.price == null || !Number.isFinite(data.price) || data.price <= 0) {
      throw new BadRequestException('Price must be a positive number');
    }

    // Category must exist AND be active for this tenant/branch.
    const category = await this.prisma.menuCategory.findFirst({
      where: {
        id: data.categoryId,
        tenantId,
        isActive: true,
        branchId: branchId ?? null,
      },
    });
    if (!category) {
      throw new BadRequestException('Invalid or inactive category');
    }

    const createData: any = {
      tenantId,
      name: data.name.trim(),
      price: data.price,
      categoryId: data.categoryId,
      imageUrl: data.imageUrl?.trim() || undefined,
    };
    if (branchId) createData.branchId = branchId;
    return this.prisma.menuItem.create({ data: createData });
  }

  getItems(tenantId: string, branchId?: string | null) {
    const where: any = {
      tenantId,
      isAvailable: true,
      branchId: branchId ?? null,
    };
    return this.prisma.menuItem.findMany({
      where,
      include: {
        category: {
          select: { name: true },
        },
      },
    });
  }

  async getItem(tenantId: string, id: string, branchId?: string | null) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const item = await this.prisma.menuItem.findFirst({
      where,
      include: {
        category: {
          select: { name: true },
        },
      },
    });
    if (!item) {
      throw new BadRequestException('Menu item not found');
    }
    return item;
  }

  async updateItem(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      price?: number;
      categoryId?: string;
      imageUrl?: string;
    },
    branchId?: string | null,
  ) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const item = await this.prisma.menuItem.findFirst({
      where,
    });
    if (!item) {
      throw new BadRequestException('Menu item not found');
    }

    if (!item.isAvailable) {
      throw new BadRequestException('Cannot update unavailable menu item');
    }

    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException('Menu item name is required');
    }

    if (data.price !== undefined) {
      if (
        data.price == null ||
        !Number.isFinite(data.price) ||
        data.price <= 0
      ) {
        throw new BadRequestException('Price must be a positive number');
      }
    }

    if (data.categoryId) {
      const category = await this.prisma.menuCategory.findFirst({
        where: {
          id: data.categoryId,
          tenantId,
          isActive: true,
          branchId: branchId ?? null,
        },
      });
      if (!category) {
        throw new BadRequestException('Invalid category');
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.price !== undefined) {
      updateData.price = data.price;
    }
    if (data.categoryId !== undefined) {
      updateData.categoryId = data.categoryId || undefined;
    }
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl?.trim() || undefined;
    }

    const res = await this.prisma.menuItem.updateMany({
      where,
      data: updateData,
    });
    if (res.count === 0) {
      throw new BadRequestException('Menu item not found');
    }

    return this.prisma.menuItem.findFirst({
      where,
      include: {
        category: {
          select: { name: true },
        },
      },
    });
  }

  async toggleItemVisibility(
    tenantId: string,
    id: string,
    branchId?: string | null,
  ) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const item = await this.prisma.menuItem.findFirst({
      where,
    });
    if (!item) {
      throw new BadRequestException('Menu item not found');
    }

    const nextIsAvailable = !item.isAvailable;

    const res = await this.prisma.menuItem.updateMany({
      where,
      data: { isAvailable: nextIsAvailable },
    });
    if (res.count === 0) {
      throw new BadRequestException('Menu item not found');
    }

    return this.prisma.menuItem.findFirst({
      where,
      include: {
        category: {
          select: { name: true },
        },
      },
    });
  }

  async deleteItem(tenantId: string, id: string, branchId?: string | null) {
    const where = this.buildScopedWhere(id, tenantId, branchId);
    const item = await this.prisma.menuItem.findFirst({
      where,
    });
    if (!item) {
      throw new BadRequestException('Menu item not found');
    }

    const res = await this.prisma.menuItem.updateMany({
      where: { id, tenantId, isAvailable: true, branchId: branchId ?? null },
      data: { isAvailable: false },
    });

    if (res.count === 0) {
      throw new BadRequestException('Menu item not found');
    }

    return { success: true };
  }

  async bulkUploadFromCsv(
    tenantId: string,
    branchId: string | null,
    file: any,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    let records: any[];
    try {
      records = parse(file.buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      throw new BadRequestException('Invalid CSV format');
    }

    if (!records.length) {
      throw new BadRequestException('CSV file is empty');
    }

    /**
     * Expected CSV columns:
     * category_name,item_name,price,image_url,is_available
     */
    const categoryMap = new Map<
      string,
      {
        imageUrl?: string;
        items: {
          name: string;
          price: number;
          imageUrl?: string;
          isAvailable: boolean;
        }[];
      }
    >();

    for (const row of records) {
      const categoryName = row.category_name?.trim();
      const itemName = row.item_name?.trim();
      const price = Number(row.price);

      if (!categoryName) {
        throw new BadRequestException('category_name is required in all rows');
      }
      if (!itemName) {
        throw new BadRequestException('item_name is required in all rows');
      }
      if (!Number.isFinite(price) || price <= 0) {
        throw new BadRequestException(`Invalid price for item "${itemName}"`);
      }

      const imageUrl = row.image_url?.trim() || undefined;
      const isAvailable =
        row.is_available?.toString().toLowerCase() !== 'false';

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          imageUrl: undefined,
          items: [],
        });
      }

      categoryMap.get(categoryName)!.items.push({
        name: itemName,
        price,
        imageUrl,
        isAvailable,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const results: { categoryName: string; itemCount: number }[] = [];

      for (const [categoryName, value] of categoryMap.entries()) {
        // Find existing active category for this tenant/branch by name
        const existing = await tx.menuCategory.findFirst({
          where: {
            tenantId,
            name: categoryName,
            branchId: branchId ?? null,
            isActive: true,
          },
        });

        let categoryId: string;

        if (existing) {
          categoryId = existing.id;

          // Remove existing items for this category in this branch/tenant
          await tx.menuItem.deleteMany({
            where: {
              tenantId,
              branchId: branchId ?? null,
              categoryId,
            },
          });
        } else {
          const created = await tx.menuCategory.create({
            data: {
              tenantId,
              name: categoryName,
              imageUrl: value.imageUrl,
              ...(branchId ? { branchId } : {}),
            },
          });
          categoryId = created.id;
        }

        await tx.menuItem.createMany({
          data: value.items.map((item) => ({
            tenantId,
            branchId: branchId ?? null,
            categoryId,
            name: item.name,
            price: item.price,
            imageUrl: item.imageUrl,
            isAvailable: item.isAvailable,
          })),
        });

        results.push({ categoryName, itemCount: value.items.length });
      }

      return { success: true, categories: results };
    });
  }
}
