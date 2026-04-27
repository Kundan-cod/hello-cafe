import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { CreateVendorPurchaseDto } from './dto/create-vendor-purchase.dto';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async createVendor(
    tenantId: string,
    branchId: string | null,
    data: CreateVendorDto,
  ) {
    if (!data.name?.trim()) {
      throw new BadRequestException('Vendor name is required');
    }
    const createData: any = {
      tenantId,
      name: data.name.trim(),
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      address: data.address?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
    };
    if (branchId) createData.branchId = branchId;
    return this.prisma.vendor.create({ data: createData });
  }

  getVendors(tenantId: string, branchId?: string | null) {
    return this.prisma.vendor.findMany({
      where: {
        tenantId,
        isActive: true,
        branchId: branchId ?? null,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getVendor(tenantId: string, id: string, branchId?: string | null) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId, isActive: true, branchId: branchId ?? null },
    });
    if (!vendor) throw new BadRequestException('Vendor not found');
    return vendor;
  }

  async updateVendor(
    tenantId: string,
    id: string,
    data: UpdateVendorDto,
    branchId?: string | null,
  ) {
    await this.getVendor(tenantId, id, branchId);
    const updateData: any = {};
    if (data.name !== undefined) {
      if (!data.name?.trim())
        throw new BadRequestException('Vendor name is required');
      updateData.name = data.name.trim();
    }
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
    if (data.email !== undefined) updateData.email = data.email?.trim() || null;
    if (data.address !== undefined)
      updateData.address = data.address?.trim() || null;
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
    return this.prisma.vendor.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteVendor(tenantId: string, id: string, branchId?: string | null) {
    const res = await this.prisma.vendor.updateMany({
      where: { id, tenantId, isActive: true, branchId: branchId ?? null },
      data: { isActive: false },
    });
    if (res.count === 0) throw new BadRequestException('Vendor not found');
    return { success: true };
  }

  async createPurchase(
    tenantId: string,
    vendorId: string,
    branchId: string | null,
    data: CreateVendorPurchaseDto,
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        id: vendorId,
        tenantId,
        isActive: true,
        branchId: branchId ?? null,
      },
    });
    if (!vendor) throw new BadRequestException('Vendor not found');

    const items = (data.items ?? []).filter(
      (i) => i.productName != null && String(i.productName).trim() !== '',
    );

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.vendorPurchase.create({
        data: {
          vendorId,
          tenantId,
          totalAmount: data.totalAmount,
          paidAmount: data.paidAmount ?? 0,
          note: data.note?.trim() || null,
          items: {
            create: items.map((i) => ({
              productName: i.productName.trim(),
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              inventoryProductId: i.inventoryProductId || null,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of items) {
        if (!item.inventoryProductId || item.quantity <= 0) continue;
        const inv = await tx.inventoryProduct.findFirst({
          where: {
            id: item.inventoryProductId,
            tenantId,
            branchId: branchId ?? null,
          },
        });
        if (!inv) continue;

        await tx.inventoryProduct.update({
          where: { id: inv.id },
          data: { currentQuantity: { increment: item.quantity } },
        });
        await tx.inventoryStockHistory.create({
          data: {
            inventoryProductId: inv.id,
            quantityChange: item.quantity,
            type: 'PURCHASE',
            referenceId: purchase.id,
            note: `Vendor purchase: ${item.productName}`,
          },
        });
      }

      return tx.vendorPurchase.findUniqueOrThrow({
        where: { id: purchase.id },
        include: { items: true, vendor: true },
      });
    });
  }

  getPurchaseHistory(
    tenantId: string,
    vendorId: string,
    branchId?: string | null,
  ) {
    const branchFilter =
      branchId != null && branchId !== '' ? { branchId } : { branchId: null };
    return this.prisma.vendorPurchase.findMany({
      where: {
        vendorId,
        vendor: {
          tenantId,
          ...branchFilter,
          isActive: true,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async getPurchase(
    tenantId: string,
    purchaseId: string,
    branchId?: string | null,
  ) {
    const purchase = await this.prisma.vendorPurchase.findFirst({
      where: {
        id: purchaseId,
        vendor: {
          tenantId,
          branchId: branchId ?? null,
          isActive: true,
        },
      },
      include: { items: true, vendor: true },
    });
    if (!purchase) throw new BadRequestException('Purchase not found');
    return purchase;
  }

  async updatePurchasePayment(
    tenantId: string,
    purchaseId: string,
    paidAmount: number,
    note?: string,
    branchId?: string | null,
  ) {
    const purchase = await this.prisma.vendorPurchase.findFirst({
      where: {
        id: purchaseId,
        vendor: {
          tenantId,
          branchId: branchId ?? null,
          isActive: true,
        },
      },
    });
    if (!purchase) throw new BadRequestException('Purchase not found');
    if (paidAmount < 0 || paidAmount > purchase.totalAmount) {
      throw new BadRequestException(
        'Paid amount must be between 0 and total amount',
      );
    }
    return this.prisma.vendorPurchase.update({
      where: { id: purchaseId },
      data: {
        paidAmount,
        ...(note !== undefined ? { note: note?.trim() || null } : {}),
      },
      include: { items: true, vendor: true },
    });
  }
}
