import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CompleteOrderDto } from './dto/complete-order.dto';

/** Standard menuItem include shape used by createOrder, getOrder, getOrders */
const MENU_ITEM_INCLUDE = {
  select: {
    id: true,
    name: true,
    imageUrl: true,
    categoryId: true,
    category: { select: { id: true, imageUrl: true } },
  },
} as const;

/* Recommended DB indexes for performance:
 *   order(tenantId, branchId, updatedAt desc) — for getOrdersStatus
 *   order(tenantId, branchId, createdAt desc)
 *   order(orderNumber)
 *   orderItem(orderId)
 *   table(id, tenantId, branchId)
 */

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  async createOrder(
    tenantId: string,
    userId: string,
    branchId: string | null,
    data: {
      items: { menuItemId: string; quantity: number }[];
      paymentMode: 'CASH' | 'QR' | 'CARD';
      orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
      tableId?: string;
      counterNumber?: string;
      note?: string;
      customerName?: string;
      customerPhone?: string;
      deliveryAddress?: string;
    },
    // Currently kept for compatibility with controller, but not used –
    // we always return full order details from createOrder.
    opts?: { includeDetails?: boolean },
  ) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('No items in order');
    }

    for (const i of data.items) {
      if (i.quantity < 1) {
        throw new BadRequestException('Item quantity must be at least 1');
      }
    }

    const orderType = data.orderType ?? 'TAKEAWAY';

    // Use branch's orderManagementType if set, else tenant's; default to TABLE_BASED when both null
    let orderManagementType: string | null = null;
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
        select: { orderManagementType: true },
      });
      if (!branch) {
        throw new BadRequestException('Branch not found');
      }
      if (branch.orderManagementType)
        orderManagementType = branch.orderManagementType;
    }
    if (orderManagementType == null) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { orderManagementType: true },
      });
      if (!tenant) {
        throw new BadRequestException('Tenant not found');
      }
      orderManagementType = tenant.orderManagementType ?? null;
    }
    if (orderManagementType == null) {
      orderManagementType = 'TABLE_BASED';
    }

    if (orderType === 'DELIVERY') {
      if (!data.customerName?.trim()) {
        throw new BadRequestException(
          'Customer name is required for delivery orders',
        );
      }
      if (!data.customerPhone?.trim()) {
        throw new BadRequestException(
          'Customer phone is required for delivery orders',
        );
      }
      if (!data.deliveryAddress?.trim()) {
        throw new BadRequestException(
          'Delivery address is required for delivery orders',
        );
      }
    }

    const tableWhere: any = { id: data.tableId, tenantId, isActive: true };
    if (branchId) tableWhere.branchId = branchId;

    let tableId: string | undefined = undefined;
    let counterNumber: string | undefined = undefined;
    const counterTrimmed =
      data.counterNumber != null ? String(data.counterNumber).trim() : '';

    if (orderType === 'DINE_IN') {
      if (orderManagementType === 'TABLE_BASED') {
        if (!data.tableId) {
          throw new BadRequestException('Table is required for dine-in orders');
        }
        const table = await this.prisma.table.findFirst({
          where: tableWhere,
        });
        if (!table) {
          throw new BadRequestException('Invalid table');
        }
        tableId = table.id;
      } else if (orderManagementType === 'COUNTER_BASED') {
        if (!counterTrimmed) {
          throw new BadRequestException(
            'Counter number is required for dine-in orders',
          );
        }
        counterNumber = counterTrimmed;
      } else if (orderManagementType === 'BOTH') {
        if (data.tableId) {
          const table = await this.prisma.table.findFirst({
            where: tableWhere,
          });
          if (!table) {
            throw new BadRequestException('Invalid table');
          }
          tableId = table.id;
        } else if (counterTrimmed) {
          counterNumber = counterTrimmed;
        } else {
          throw new BadRequestException(
            'Table or counter number is required for dine-in orders',
          );
        }
      } else {
        if (!data.tableId) {
          throw new BadRequestException('Table is required for dine-in orders');
        }
        const table = await this.prisma.table.findFirst({
          where: tableWhere,
        });
        if (!table) {
          throw new BadRequestException('Invalid table');
        }
        tableId = table.id;
      }
    } else if (data.tableId) {
      const table = await this.prisma.table.findFirst({
        where: tableWhere,
      });
      if (!table) {
        throw new BadRequestException('Invalid table');
      }
      tableId = table.id;
    } else if (counterTrimmed) {
      counterNumber = counterTrimmed;
    }

    const itemWhere: any = {
      id: { in: data.items.map((i) => i.menuItemId) },
      tenantId,
    };
    if (branchId) itemWhere.branchId = branchId;

    const menuItems = await this.prisma.menuItem.findMany({
      where: itemWhere,
    });

    let total = 0;

    if (menuItems.length === 0) {
      throw new BadRequestException('No valid menu items found');
    }

    const orderItems = data.items.map((i) => {
      const item = menuItems.find((m) => m.id === i.menuItemId);
      if (!item) {
        throw new BadRequestException('Invalid menu item');
      }

      const price = item.price * i.quantity;
      total += price;

      return {
        menuItemId: item.id,
        quantity: i.quantity,
        price: item.price,
      };
    });

    const createdOrder = await this.prisma.$transaction(async (tx) => {
      const branchKey = branchId ?? '';
      const seq = await tx.orderSequence.upsert({
        where: { tenantId_branchKey: { tenantId, branchKey } },
        create: { tenantId, branchKey, lastOrderNumber: 0 },
        update: {},
      });
      const updatedSeq = await tx.orderSequence.update({
        where: { id: seq.id },
        data: { lastOrderNumber: { increment: 1 } },
      });
      const orderNumber = updatedSeq.lastOrderNumber;

      const orderData: any = {
        tenantId,
        orderNumber,
        totalAmount: total,
        paymentMode: data.paymentMode,
        orderType,
        tableId,
        counterNumber: counterNumber ?? undefined,
        note: data.note?.trim() || undefined,
        customerName:
          orderType === 'DELIVERY' ? data.customerName?.trim() : undefined,
        customerPhone:
          orderType === 'DELIVERY' ? data.customerPhone?.trim() : undefined,
        deliveryAddress:
          orderType === 'DELIVERY' ? data.deliveryAddress?.trim() : undefined,
        status: 'PENDING',
        createdById: userId,
        items: { create: orderItems },
      };
      if (branchId) orderData.branchId = branchId;

      const order = await tx.order.create({
        data: orderData,
        include: {
          items: {
            include: {
              menuItem: MENU_ITEM_INCLUDE,
            },
          },
          table: { include: { area: true } },
        },
      });

      if (orderType === 'DINE_IN' && tableId) {
        const tableUpdateWhere: any = {
          id: tableId,
          tenantId,
        };
        if (branchId) tableUpdateWhere.branchId = branchId;
        await tx.table.update({
          where: tableUpdateWhere,
          data: { status: 'OCCUPIED' },
        });
      }

      return order;
    });

    return createdOrder;
  }

  getOrdersStatus(tenantId: string, branchId?: string | null, since?: Date) {
    const where: any = { tenantId };
    if (branchId != null && branchId !== '') {
      where.branchId = branchId;
    }
    if (since) {
      where.updatedAt = { gte: since };
    }
    return this.prisma.order.findMany({
      where,
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOrders(
    tenantId: string,
    branchId?: string | null,
    opts?: {
      cursor?: string;
      limit?: number;
      status?: 'IN_PROCESS' | 'COMPLETED' | 'CREDIT' | 'CANCELLED';
      orderType?: 'DELIVERY';
      search?: string;
    },
  ) {
    const useCursorPagination = opts?.limit != null;
    const limitVal = useCursorPagination
      ? Math.min(100, Math.max(1, opts?.limit ?? 30))
      : undefined;

    const where: any = { tenantId };
    if (branchId != null && branchId !== '') {
      where.branchId = branchId;
    }

    // Status filter (UI bucket -> backend statuses)
    if (opts?.status) {
      switch (opts.status) {
        case 'IN_PROCESS':
          where.status = { in: ['PENDING', 'PREPARING', 'READY'] };
          break;
        case 'COMPLETED':
        case 'CREDIT':
        case 'CANCELLED':
          where.status = opts.status;
          break;
      }
    }

    // Delivery filter
    if (opts?.orderType === 'DELIVERY') {
      where.orderType = 'DELIVERY';
    }

    // Text search
    if (opts?.search && opts.search.trim()) {
      const q = opts.search.trim();
      const numeric = /^\d+$/.test(q) ? parseInt(q, 10) : null;
      where.OR = [
        ...(numeric != null ? [{ orderNumber: numeric }] : []),
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
        { deliveryAddress: { contains: q, mode: 'insensitive' } },
        { counterNumber: { contains: q, mode: 'insensitive' } },
        {
          table: {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { area: { name: { contains: q, mode: 'insensitive' } } },
            ],
          },
        },
        {
          items: {
            some: {
              menuItem: { name: { contains: q, mode: 'insensitive' } },
            },
          },
        },
      ].filter(Boolean);
    }

    if (!useCursorPagination) {
      return this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            orderBy: { id: 'asc' },
            include: {
              menuItem: MENU_ITEM_INCLUDE,
            },
          },
          table: {
            include: { area: true },
          },
        },
      });
    }

    // Cursor-based: fetch limit+1 to know if there is a next page
    const take = limitVal! + 1;
    const cursor = opts?.cursor?.trim()
      ? { id: opts.cursor.trim() }
      : undefined;

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: cursor ?? undefined,
      skip: cursor ? 1 : 0,
      take,
      include: {
        items: {
          orderBy: { id: 'asc' },
          include: {
            menuItem: MENU_ITEM_INCLUDE,
          },
        },
        table: {
          include: { area: true },
        },
      },
    });

    const hasMore = rows.length > limitVal!;
    const data = hasMore ? rows.slice(0, limitVal) : rows;
    const nextCursor = hasMore ? rows[limitVal! - 1].id : null;

    return { data, nextCursor };
  }

  async getOrder(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          orderBy: { id: 'asc' },
          include: {
            menuItem: MENU_ITEM_INCLUDE,
          },
        },
        table: {
          include: { area: true },
        },
      },
    });

    if (!order) throw new BadRequestException('Order not found');
    return order;
  }

  async updateOrderStatus(
    tenantId: string,
    id: string,
    status: 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED',
    opts?: { includeDetails?: boolean },
  ) {
    const includeDetails = opts?.includeDetails !== false;
    const existing = await this.prisma.order.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) throw new BadRequestException('Order not found');

    await this.prisma.order.update({
      where: { id: existing.id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
      } as any,
    });
    if (!includeDetails) {
      return { id, status };
    }
    return this.getOrder(tenantId, id);
  }

  async completeOrder(
    tenantId: string,
    id: string,
    data: CompleteOrderDto,
    opts?: { includeDetails?: boolean },
  ) {
    const includeDetails = opts?.includeDetails !== false;
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        totalAmount: true,
        tableId: true,
        orderType: true,
        branchId: true,
      },
    });
    if (!order) throw new BadRequestException('Order not found');

    const discount = data.discount ?? 0;
    const finalTotal = Math.max(order.totalAmount - discount, 0);

    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          discount: discount || undefined,
          paymentType: data.paymentType,
          payments: data.payments
            ? data.payments.map((p) => ({ method: p.method, amount: p.amount }))
            : undefined,
          totalAmount: finalTotal,
          status: 'COMPLETED',
          completedAt: new Date(),
        } as any,
      });

      const orderItems = await tx.orderItem.findMany({
        where: { orderId: id },
        select: { menuItemId: true, quantity: true },
      });
      await this.inventoryService.deductStockForOrder(
        tx,
        tenantId,
        order.branchId ?? null,
        id,
        orderItems.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
        })),
      );

      if (order.orderType === 'DINE_IN' && order.tableId) {
        const tableUpdateWhere: any = {
          id: order.tableId,
          tenantId,
        };
        if (order.branchId) tableUpdateWhere.branchId = order.branchId;
        await tx.table.update({
          where: tableUpdateWhere,
          data: { status: 'AVAILABLE' },
        });
      }

      if (!includeDetails) {
        return { id, status: 'COMPLETED', totalAmount: finalTotal };
      }

      const updatedOrder = await tx.order.findFirst({
        where: { id, tenantId },
        include: {
          items: {
            orderBy: { id: 'asc' },
            include: {
              menuItem: MENU_ITEM_INCLUDE,
            },
          },
          table: {
            include: { area: true },
          },
        },
      });
      if (!updatedOrder) throw new BadRequestException('Order not found');
      return updatedOrder;
    });
  }

  // async addItems(
  //   tenantId: string,
  //   id: string,
  //   items: { menuItemId: string; quantity: number }[]
  // ) {
  //   if (!items || items.length === 0) {
  //     throw new BadRequestException("No items provided");
  //   }

  //   for (const i of items) {
  //     if (i.quantity < 1) {
  //       throw new BadRequestException("Item quantity must be at least 1");
  //     }
  //   }

  //   const order = await this.prisma.order.findFirst({
  //     where: { id, tenantId },
  //     select: { id: true, tenantId: true, totalAmount: true, status: true },
  //   });

  //   if (!order) {
  //     throw new BadRequestException("Order not found");
  //   }

  //   if (order.status === "COMPLETED" || order.status === "CANCELLED") {
  //     throw new BadRequestException("Order is not editable in this status");
  //   }

  //   const menuItems = await this.prisma.menuItem.findMany({
  //     where: {
  //       id: { in: items.map((i) => i.menuItemId) },
  //       tenantId,
  //     },
  //     select: {
  //       id: true,
  //       price: true,
  //     },
  //   });

  //   if (menuItems.length === 0) {
  //     throw new BadRequestException("Invalid menu items");
  //   }

  //   return this.prisma.$transaction(async (tx) => {
  //     // Step 1: Fetch existing items in this order
  //     const existingItems = await tx.orderItem.findMany({
  //       where: {
  //         orderId: id,
  //         menuItemId: { in: items.map((i) => i.menuItemId) },
  //       },
  //     });

  //     let additionalTotal = 0;
  //     const itemsToCreate: any[] = [];
  //     const updates: any[] = [];

  //     for (const req of items) {
  //       const menuItem = menuItems.find((m) => m.id === req.menuItemId);
  //       if (!menuItem) {
  //         throw new BadRequestException("Invalid menu item");
  //       }

  //       const existing = existingItems.find(
  //         (e) => e.menuItemId === req.menuItemId
  //       );

  //       const lineTotal = menuItem.price * req.quantity;
  //       additionalTotal += lineTotal;

  //       if (existing) {
  //         // ✅ Update existing item quantity
  //         updates.push(
  //           tx.orderItem.update({
  //             where: { id: existing.id },
  //             data: {
  //               quantity: existing.quantity + req.quantity,
  //             },
  //           })
  //         );
  //       } else {
  //         // ✅ Create new order item
  //         itemsToCreate.push({
  //           orderId: id,
  //           menuItemId: menuItem.id,
  //           quantity: req.quantity,
  //           price: menuItem.price,
  //         });
  //       }
  //     }

  //     // Step 2: Perform DB operations
  //     if (itemsToCreate.length > 0) {
  //       await tx.orderItem.createMany({
  //         data: itemsToCreate,
  //       });
  //     }

  //     if (updates.length > 0) {
  //       await Promise.all(updates);
  //     }

  //     // Step 3: Update order total
  //     await tx.order.update({
  //       where: { id },
  //       data: {
  //         totalAmount: { increment: additionalTotal },
  //       } as any,
  //     });

  //     return this.getOrder(tenantId, id);
  //   });
  // }

  async addItems(
    tenantId: string,
    orderId: string,
    items: { menuItemId: string; quantity: number }[],
  ) {
    if (!items || items.length === 0) {
      throw new BadRequestException('No items provided');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        tenantId: true,
        totalAmount: true,
        status: true,
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Order is not editable in this status');
    }

    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: items.map((i) => i.menuItemId) },
        tenantId,
      },
      select: {
        id: true,
        price: true,
      },
    });

    if (menuItems.length === 0) {
      throw new BadRequestException('Invalid menu items');
    }

    return this.prisma.$transaction(async (tx) => {
      // Get existing order items
      const existingItems = await tx.orderItem.findMany({
        where: {
          orderId,
          menuItemId: { in: items.map((i) => i.menuItemId) },
        },
      });

      let totalDiff = 0;
      const toCreate: any[] = [];
      const updates: any[] = [];
      const toDeleteIds: string[] = [];

      for (const req of items) {
        const menuItem = menuItems.find((m) => m.id === req.menuItemId);
        if (!menuItem) {
          throw new BadRequestException('Invalid menu item');
        }

        const existing = existingItems.find(
          (e) => e.menuItemId === req.menuItemId,
        );

        const newLineTotal = menuItem.price * Math.max(0, req.quantity);

        if (!existing) {
          // New item case
          if (req.quantity > 0) {
            totalDiff += newLineTotal;

            toCreate.push({
              orderId,
              menuItemId: menuItem.id,
              quantity: req.quantity,
              price: menuItem.price,
            });
          }
          continue;
        }

        const oldLineTotal = existing.price * existing.quantity;

        if (req.quantity <= 0) {
          // Remove item
          totalDiff -= oldLineTotal;
          toDeleteIds.push(existing.id);
        } else {
          // Update quantity (increase or decrease)
          totalDiff += newLineTotal - oldLineTotal;

          updates.push(
            tx.orderItem.update({
              where: { id: existing.id },
              data: { quantity: req.quantity },
            }),
          );
        }
      }

      // Execute DB operations
      if (toCreate.length > 0) {
        await tx.orderItem.createMany({ data: toCreate });
      }

      if (updates.length > 0) {
        await Promise.all(updates);
      }

      if (toDeleteIds.length > 0) {
        await tx.orderItem.deleteMany({
          where: { id: { in: toDeleteIds } },
        });
      }

      // Update order total once
      if (totalDiff !== 0) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            totalAmount: { increment: totalDiff },
          } as any,
        });
      }

      return this.getOrder(tenantId, orderId);
    });
  }

  async updateOrderItemStatus(
    tenantId: string,
    orderId: string,
    itemId: string,
    status: 'PENDING' | 'SERVED',
    opts?: { includeDetails?: boolean },
  ) {
    const includeDetails = opts?.includeDetails !== false;
    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: itemId,
        order: {
          id: orderId,
          tenantId,
        },
      },
      include: {
        order: true,
      },
    });

    if (!item) {
      throw new BadRequestException('Order item not found');
    }

    if (
      item.order.status === 'COMPLETED' ||
      item.order.status === 'CANCELLED'
    ) {
      throw new BadRequestException('Order is not editable in this status');
    }

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { status },
    });

    if (!includeDetails) {
      return { orderId, itemId, status };
    }
    return this.getOrder(tenantId, orderId);
  }

  async updateOrderItemQuantity(
    tenantId: string,
    orderId: string,
    itemId: string,
    quantity: number,
    opts?: { includeDetails?: boolean },
  ) {
    const includeDetails = opts?.includeDetails !== false;
    if (quantity < 1) {
      return this.removeOrderItem(tenantId, orderId, itemId, {
        includeDetails,
      });
    }

    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: itemId,
        order: { id: orderId, tenantId },
      },
      include: { order: true },
    });

    if (!item) throw new BadRequestException('Order item not found');
    if (
      item.order.status === 'COMPLETED' ||
      item.order.status === 'CANCELLED'
    ) {
      throw new BadRequestException('Order is not editable in this status');
    }

    const oldTotal = item.price * item.quantity;
    const newTotal = item.price * quantity;
    const diff = newTotal - oldTotal;
    const newOrderTotal = item.order.totalAmount + diff;

    await this.prisma.$transaction([
      this.prisma.orderItem.update({
        where: { id: itemId },
        data: { quantity },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { totalAmount: { increment: diff } as any },
      }),
    ]);

    if (!includeDetails) {
      return {
        orderId,
        itemId,
        quantity,
        totalAmount: newOrderTotal,
      };
    }
    return this.getOrder(tenantId, orderId);
  }

  async removeOrderItem(
    tenantId: string,
    orderId: string,
    itemId: string,
    opts?: { includeDetails?: boolean },
  ) {
    const includeDetails = opts?.includeDetails !== false;
    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: itemId,
        order: { id: orderId, tenantId },
      },
      include: { order: true },
    });

    if (!item) throw new BadRequestException('Order item not found');
    if (
      item.order.status === 'COMPLETED' ||
      item.order.status === 'CANCELLED'
    ) {
      throw new BadRequestException('Order is not editable in this status');
    }

    const lineTotal = item.price * item.quantity;

    await this.prisma.$transaction([
      this.prisma.orderItem.delete({ where: { id: itemId } }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { totalAmount: { decrement: lineTotal } as any },
      }),
    ]);

    if (!includeDetails) {
      return {
        orderId,
        itemId,
        totalAmount: item.order.totalAmount - lineTotal,
      };
    }
    return this.getOrder(tenantId, orderId);
  }
}
