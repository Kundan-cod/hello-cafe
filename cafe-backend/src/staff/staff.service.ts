import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { MailerService } from '../mailer/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

const TEMP_PASSWORD = 'Temp@123';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
  ) {}

  async getStaff(
    tenantId: string,
    branchId: string | null,
    role: string | null,
  ) {
    const where: any = { tenantId };
    if (branchId) {
      where.branchId = branchId;
    }
    // Exclude OWNER - list STAFF and BRANCH_OWNER
    where.role = { in: ['STAFF', 'BRANCH_OWNER'] };
    if (role && (role === 'STAFF' || role === 'BRANCH_OWNER')) {
      where.role = role;
    }
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        contactNumber: true,
        panNumber: true,
        citizenshipNumber: true,
        salary: true,
        shiftStart: true,
        shiftEnd: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
    });
    return users;
  }

  async createStaff(
    tenantId: string,
    creatorRole: string,
    creatorBranchId: string | null,
    data: CreateStaffDto,
  ) {
    if (creatorRole !== 'OWNER' && creatorRole !== 'BRANCH_OWNER') {
      throw new ForbiddenException('Only owner or branch owner can add staff');
    }
    if (creatorRole === 'BRANCH_OWNER' && data.role === 'BRANCH_OWNER') {
      throw new ForbiddenException('Only cafe owner can create branch owners');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }
    let staffBranchId: string | null = null;
    if (creatorRole === 'BRANCH_OWNER') {
      staffBranchId = creatorBranchId;
    } else {
      if (data.role === 'BRANCH_OWNER') {
        if (!data.branchId) {
          throw new BadRequestException(
            'Branch is required for branch owner role',
          );
        }
        const branch = await this.prisma.branch.findFirst({
          where: { id: data.branchId, tenantId },
        });
        if (!branch) {
          throw new BadRequestException('Invalid branch');
        }
        staffBranchId = data.branchId;
      } else {
        staffBranchId = data.branchId || null;
        if (data.branchId) {
          const branch = await this.prisma.branch.findFirst({
            where: { id: data.branchId, tenantId },
          });
          if (!branch) {
            throw new BadRequestException('Invalid branch');
          }
        }
      }
    }
    // Enforce staff limits based on subscription plan.
    // By business rule: every non‑OWNER user (STAFF, BRANCH_OWNER, ADMIN, etc.)
    // is counted as "staff" for the tenant.
    const maxStaff = await this.getMaxStaffForTenant(tenantId);
    if (maxStaff !== null) {
      const activeStaffCount = await this.prisma.user.count({
        where: {
          tenantId,
          role: { not: 'OWNER' },
          isActive: true,
        },
      });
      if (activeStaffCount >= maxStaff) {
        throw new BadRequestException(
          `You have reached the maximum of ${maxStaff} staff accounts for your current plan.`,
        );
      }
    }

    const tempPassword =
      data.tempPassword && data.tempPassword.length >= 6
        ? data.tempPassword
        : TEMP_PASSWORD;
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        branchId: staffBranchId,
        contactNumber: data.contactNumber || undefined,
        panNumber: data.panNumber || undefined,
        citizenshipNumber: data.citizenshipNumber || undefined,
        salary: data.salary,
        shiftStart: data.shiftStart || undefined,
        shiftEnd: data.shiftEnd || undefined,
        mustChangePassword: true,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        contactNumber: true,
        panNumber: true,
        citizenshipNumber: true,
        salary: true,
        shiftStart: true,
        shiftEnd: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
    });

    //     const loginUrl =
    //       process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    //     const text = `Hello ${data.name},

    // Your staff account has been created for the cafe management system.

    // Your login credentials:
    // Email / ID: ${data.email}
    // Temporary Password: ${tempPassword}

    // Please log in at ${loginUrl}/login and set a new password when prompted.

    // Do not share this password with anyone.`;
    //     await this.mailer.sendMail({
    //       to: data.email,
    //       subject: "Your staff login credentials",
    //       text,
    //     });

    return user;
  }

  async getBranchesForSelect(
    tenantId: string,
    userRole: string,
    userBranchId: string | null,
  ) {
    if (userRole === 'OWNER') {
      const branches = await this.prisma.branch.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      return branches;
    }
    if (userRole === 'BRANCH_OWNER' && userBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: userBranchId, tenantId },
        select: { id: true, name: true },
      });
      return branch ? [branch] : [];
    }
    return [];
  }

  async getStaffById(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, role: { in: ['STAFF', 'BRANCH_OWNER'] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        contactNumber: true,
        panNumber: true,
        citizenshipNumber: true,
        salary: true,
        shiftStart: true,
        shiftEnd: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new BadRequestException('Staff not found');
    return user;
  }

  async updateStaff(
    tenantId: string,
    id: string,
    data: UpdateStaffDto,
    updaterRole: string,
    updaterBranchId: string | null,
  ) {
    if (updaterRole !== 'OWNER' && updaterRole !== 'BRANCH_OWNER') {
      throw new ForbiddenException(
        'Only owner or branch owner can update staff',
      );
    }
    if (updaterRole === 'BRANCH_OWNER' && data.role === 'BRANCH_OWNER') {
      throw new ForbiddenException(
        'Only cafe owner can assign branch owner role',
      );
    }
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId, role: { in: ['STAFF', 'BRANCH_OWNER'] } },
    });
    if (!existing) throw new BadRequestException('Staff not found');
    if (
      updaterRole === 'BRANCH_OWNER' &&
      existing.branchId !== updaterBranchId
    ) {
      throw new ForbiddenException('You can only update staff in your branch');
    }
    if (data.email && data.email !== existing.email) {
      const dup = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (dup) throw new BadRequestException('Email already in use');
    }
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.contactNumber !== undefined)
      updateData.contactNumber = data.contactNumber;
    if (data.panNumber !== undefined) updateData.panNumber = data.panNumber;
    if (data.citizenshipNumber !== undefined)
      updateData.citizenshipNumber = data.citizenshipNumber;
    if (data.salary !== undefined) updateData.salary = data.salary;
    if (data.shiftStart !== undefined) updateData.shiftStart = data.shiftStart;
    if (data.shiftEnd !== undefined) updateData.shiftEnd = data.shiftEnd;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.branchId !== undefined) updateData.branchId = data.branchId;
    if (data.role !== undefined) {
      if (updaterRole === 'BRANCH_OWNER' && data.role === 'BRANCH_OWNER') {
        throw new ForbiddenException(
          'Only cafe owner can assign branch owner role',
        );
      }
      updateData.role = data.role;
      if (data.role === 'STAFF') updateData.branchId = null;
    }
    if (updaterRole === 'BRANCH_OWNER' && data.branchId !== undefined) {
      throw new ForbiddenException(
        'Only cafe owner can change staff branch assignment',
      );
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        contactNumber: true,
        panNumber: true,
        citizenshipNumber: true,
        salary: true,
        shiftStart: true,
        shiftEnd: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
    });
    return user;
  }

  async deleteStaff(
    tenantId: string,
    id: string,
    deleterRole: string,
    deleterBranchId: string | null,
  ) {
    if (deleterRole !== 'OWNER' && deleterRole !== 'BRANCH_OWNER') {
      throw new ForbiddenException(
        'Only owner or branch owner can remove staff',
      );
    }
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId, role: { in: ['STAFF', 'BRANCH_OWNER'] } },
    });
    if (!existing) throw new BadRequestException('Staff not found');
    if (
      deleterRole === 'BRANCH_OWNER' &&
      existing.branchId !== deleterBranchId
    ) {
      throw new ForbiddenException(
        'You can only remove staff from your branch',
      );
    }
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Staff removed' };
  }

  /**
   * Returns the maximum allowed active staff (non‑OWNER users) for a tenant
   * based on their current subscription / trial.
   *
   * Rules:
   * - Plus plan  => 10 staff
   * - Pro plan   => 50 staff
   * - Active trial (no paid plan yet) => treated as Plus (10 staff)
   * - If plan cannot be determined => no hard limit (returns null)
   */
  private async getMaxStaffForTenant(tenantId: string): Promise<number | null> {
    const now = new Date();

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        planType: true,
        currentSubscriptionEnd: true,
      },
    });

    // Prefer an active paid subscription if present.
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE' as any,
        endsAt: {
          gt: now,
        },
      },
      include: {
        plan: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        endsAt: 'desc',
      },
    });

    if (activeSubscription?.plan?.name) {
      const planName = activeSubscription.plan.name.toLowerCase();
      if (planName.includes('plus')) {
        return 10;
      }
      if (planName.includes('pro')) {
        return 50;
      }
    }

    // If there is no active paid subscription but the tenant is on an active trial,
    // treat it as Plus‑level for staff limits.
    if (
      tenant?.planType === 'TRIAL' &&
      tenant.currentSubscriptionEnd &&
      tenant.currentSubscriptionEnd > now
    ) {
      return 10;
    }

    // Fallback – no enforced limit if we cannot determine a plan.
    return null;
  }
}
