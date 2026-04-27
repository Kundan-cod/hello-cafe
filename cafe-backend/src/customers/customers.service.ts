import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  private isValidCreditBalance(value: number): boolean {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  private async ensureUniqueContact(
    tenantId: string,
    {
      phone,
      email,
    }: {
      phone?: string | null;
      email?: string | null;
    },
    excludeCustomerId?: string,
  ) {
    const filters: any[] = [];
    if (phone) filters.push({ phone });
    if (email) filters.push({ email });

    if (filters.length === 0) return;

    const existing = await this.prisma.customer.findFirst({
      where: {
        tenantId,
        isActive: true,
        ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
        OR: filters,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'A customer with this phone or email already exists',
      );
    }
  }

  async createCustomer(
    tenantId: string,
    branchId: string | null,
    data: {
      name: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
      type?: 'CUSTOMER' | 'CREDITOR';
      creditBalance?: number;
    },
  ) {
    if (!data?.name?.trim()) {
      throw new BadRequestException('Customer name is required');
    }

    const type = data.type || 'CUSTOMER';

    const createData: any = {
      tenantId,
      name: data.name.trim(),
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      address: data.address?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      type,
    };

    if (branchId) createData.branchId = branchId;

    if (type === 'CREDITOR' && data.creditBalance !== undefined) {
      if (!this.isValidCreditBalance(data.creditBalance)) {
        throw new BadRequestException(
          'Credit balance must be a non-negative number',
        );
      }
      createData.creditBalance = data.creditBalance;
    }

    await this.ensureUniqueContact(tenantId, {
      phone: createData.phone,
      email: createData.email,
    });

    const customer = await this.prisma.customer.create({ data: createData });

    // Log opening balance as initial credit so history is complete from creation
    if (
      customer.type === 'CREDITOR' &&
      customer.creditBalance != null &&
      customer.creditBalance > 0
    ) {
      await this.prisma.creditTransaction.create({
        data: {
          customerId: customer.id,
          tenantId,
          amount: customer.creditBalance,
          type: 'CREDIT',
          balanceAfter: customer.creditBalance,
          note: 'Opening balance',
        },
      });
    }

    return customer;
  }

  getCustomers(
    tenantId: string,
    type?: 'CUSTOMER' | 'CREDITOR',
    branchId?: string | null,
  ) {
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        isActive: true,
        branchId: branchId ?? null,
        ...(type ? { type } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCustomer(tenantId: string, id: string, branchId?: string | null) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, branchId: branchId ?? null },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }
    return customer;
  }

  async updateCustomer(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
      type?: 'CUSTOMER' | 'CREDITOR';
      creditBalance?: number;
    },
    branchId?: string | null,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, branchId: branchId ?? null },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const updateData: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      notes?: string | null;
      type?: 'CUSTOMER' | 'CREDITOR';
      creditBalance?: number;
    } = {};

    if (data.name !== undefined) {
      if (!data.name.trim()) {
        throw new BadRequestException('Customer name is required');
      }
      updateData.name = data.name.trim();
    }

    if (data.phone !== undefined) {
      updateData.phone = data.phone?.trim() || null;
    }

    if (data.email !== undefined) {
      updateData.email = data.email?.trim() || null;
    }

    if (data.address !== undefined) {
      updateData.address = data.address?.trim() || null;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes?.trim() || null;
    }

    const finalType: string = data.type ?? customer.type;

    if (data.creditBalance !== undefined) {
      if (!this.isValidCreditBalance(data.creditBalance)) {
        throw new BadRequestException(
          'Credit balance must be a non-negative number',
        );
      }
      if (finalType !== 'CREDITOR') {
        throw new BadRequestException(
          'Only creditors can have a credit balance',
        );
      }
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    // Handle credit balance transitions
    if (customer.type === 'CREDITOR' && finalType === 'CUSTOMER') {
      // CREDITOR -> CUSTOMER: always reset credit balance to 0
      updateData.creditBalance = 0;
    } else if (customer.type === 'CUSTOMER' && finalType === 'CREDITOR') {
      // CUSTOMER -> CREDITOR: preserve existing balance unless a new one is provided
      updateData.creditBalance =
        data.creditBalance !== undefined
          ? data.creditBalance
          : customer.creditBalance;
    } else if (finalType === 'CREDITOR' && data.creditBalance !== undefined) {
      // CREDITOR -> CREDITOR with explicit balance update
      updateData.creditBalance = data.creditBalance;
    }

    await this.ensureUniqueContact(
      tenantId,
      {
        phone: updateData.phone ?? customer.phone,
        email: updateData.email ?? customer.email,
      },
      customer.id,
    );

    return this.prisma.customer.update({
      where: { id },
      data: updateData,
    });
  }

  async updateCreditBalance(
    tenantId: string,
    id: string,
    data: { amount: number; type: 'PAYMENT' | 'CREDIT'; note?: string },
    branchId?: string | null,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, branchId: branchId ?? null },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }
    if (customer.type !== 'CREDITOR') {
      throw new BadRequestException('Only creditors have a credit balance');
    }

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive, finite number');
    }

    const current = customer.creditBalance;

    if (data.type === 'PAYMENT' && amount > current) {
      throw new BadRequestException(
        'Payment amount cannot exceed current balance',
      );
    }

    const newBalance =
      data.type === 'PAYMENT' ? current - amount : current + amount;

    await this.prisma.$transaction([
      this.prisma.creditTransaction.create({
        data: {
          customerId: id,
          tenantId,
          amount,
          type: data.type,
          balanceAfter: newBalance,
          note: data.note?.trim() || null,
        },
      }),
      this.prisma.customer.update({
        where: { id },
        data: { creditBalance: newBalance },
      }),
    ]);

    return this.prisma.customer.findUniqueOrThrow({
      where: { id },
    });
  }

  async getCreditHistory(
    tenantId: string,
    customerId: string,
    branchId?: string | null,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId,
        branchId: branchId ?? null,
        type: 'CREDITOR',
      },
    });
    if (!customer) return [];

    const transactions = await this.prisma.creditTransaction.findMany({
      where: { tenantId, customerId },
      orderBy: { createdAt: 'desc' },
    });

    // Backfill: if creditor has balance but no history (created before we logged opening balance), add one entry
    if (
      transactions.length === 0 &&
      customer.creditBalance != null &&
      customer.creditBalance > 0
    ) {
      await this.prisma.creditTransaction.create({
        data: {
          customerId,
          tenantId,
          amount: customer.creditBalance,
          type: 'CREDIT',
          balanceAfter: customer.creditBalance,
          note: 'Opening balance',
        },
      });
      return this.prisma.creditTransaction.findMany({
        where: { tenantId, customerId },
        orderBy: { createdAt: 'desc' },
      });
    }

    return transactions;
  }

  async deleteCustomer(tenantId: string, id: string, branchId?: string | null) {
    const res = await this.prisma.customer.updateMany({
      where: { id, tenantId, isActive: true, branchId: branchId ?? null },
      data: { isActive: false },
    });

    if (res.count === 0) {
      throw new BadRequestException('Customer not found');
    }

    return { success: true };
  }
}
