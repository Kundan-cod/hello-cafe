import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

function randomPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    role: string,
    dto: CreateBranchDto,
  ) {
    if (role !== 'OWNER') {
      throw new ForbiddenException('Only the main owner can create branches');
    }

    // Only Pro subscribers can create branches, and they are limited to 4 branches.
    const { canCreateBranch, remainingBranches, isProPlan } =
      await this.getBranchCreationEligibility(tenantId);
    if (!canCreateBranch) {
      if (isProPlan && remainingBranches <= 0) {
        throw new ForbiddenException(
          'Your current plan allows up to 4 branches. You have reached the maximum number of branches.',
        );
      }
      throw new ForbiddenException(
        'Only tenants on the Pro plan can create branches.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.emailId.toLowerCase() },
    });
    if (existingUser) {
      throw new BadRequestException(
        'A user with this email already exists. Use a different email for the branch admin.',
      );
    }

    // Use owner-provided temporary password if given, otherwise a default.
    const tempPassword =
      dto.tempPassword && dto.tempPassword.length >= 6
        ? dto.tempPassword
        : 'Temp@123';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const branchOwner = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.branchAdmin,
        email: dto.emailId.toLowerCase(),
        password: hashedPassword,
        role: 'BRANCH_OWNER',
        mustChangePassword: true,
        isActive: true,
      },
    });

    // Branch always uses tenant's orderManagementType (never null; default TABLE_BASED)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { orderManagementType: true },
    });
    const orderManagementType =
      tenant?.orderManagementType ?? 'TABLE_BASED';

    const branch = await this.prisma.branch.create({
      data: {
        tenantId,
        name: dto.branchLocation,
        location: dto.branchLocation,
        province: dto.province ?? null,
        district: dto.district ?? null,
        contactNumber: dto.contactNumber ?? null,
        branchOwnerId: branchOwner.id,
        orderManagementType,
      },
    });

    await this.prisma.user.update({
      where: { id: branchOwner.id },
      data: { branchId: branch.id },
    });

    const loginUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    const text = `Hello ${dto.branchAdmin},

You have been added as the branch owner for "${dto.branchLocation}".

Your temporary login credentials:
Email: ${dto.emailId}
Password: ${tempPassword}

Please log in at ${loginUrl}/login and set a new password when prompted.

Do not share this password.`;
    // await this.mailer.sendMail({
    //   to: dto.emailId,
    //   subject: `Your branch login – ${dto.branchLocation}`,
    //   text,
    // });

    return this.findOne(tenantId, userId, role, branch.id);
  }

  async findAll(tenantId: string, userId: string, role: string) {
    if (role !== 'OWNER') {
      throw new ForbiddenException('Only the main owner can list branches');
    }
    const branches = await this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      include: {
        branchOwner: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return branches.map((b) => ({
      id: b.id,
      name: b.name,
      location: b.location,
      province: b.province,
      district: b.district,
      contactNumber: b.contactNumber,
      orderManagementType: b.orderManagementType ?? null,
      branchOwner: b.branchOwner,
      createdAt: b.createdAt,
    }));
  }

  async findOne(
    tenantId: string,
    userId: string,
    role: string,
    branchId: string,
  ) {
    if (role !== 'OWNER') {
      throw new ForbiddenException(
        'Only the main owner can view branch details',
      );
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, isActive: true },
      include: {
        branchOwner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return {
      id: branch.id,
      name: branch.name,
      location: branch.location,
      province: branch.province,
      district: branch.district,
      contactNumber: branch.contactNumber,
      branchOwner: branch.branchOwner,
      createdAt: branch.createdAt,
    };
  }

  async update(
    tenantId: string,
    userId: string,
    role: string,
    branchId: string,
    dto: UpdateBranchDto,
  ) {
    if (role !== 'OWNER') {
      throw new ForbiddenException('Only the main owner can update branches');
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      include: { branchOwner: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (!branch.isActive) {
      throw new BadRequestException('Branch is not active');
    }

    // Build update payload for Branch table only (orderManagementType is synced from tenant only)
    const branchUpdateData: {
      name?: string;
      location?: string;
      province?: string | null;
      district?: string | null;
      contactNumber?: string | null;
    } = {};
    if (dto.branchLocation != null) {
      branchUpdateData.name = dto.branchLocation;
      branchUpdateData.location = dto.branchLocation;
    }
    if (dto.province != null) branchUpdateData.province = dto.province;
    if (dto.district != null) branchUpdateData.district = dto.district;
    if (dto.contactNumber != null)
      branchUpdateData.contactNumber = dto.contactNumber;

    await this.prisma.branch.update({
      where: { id: branchId },
      data: branchUpdateData,
    });

    if (dto.branchAdmin != null || dto.emailId != null) {
      const userUpdate: Record<string, unknown> = {};
      if (dto.branchAdmin != null) userUpdate.name = dto.branchAdmin;
      if (dto.emailId != null) {
        const existing = await this.prisma.user.findUnique({
          where: { email: dto.emailId.toLowerCase() },
        });
        if (existing && existing.id !== branch.branchOwnerId) {
          throw new BadRequestException('Email already in use by another user');
        }
        userUpdate.email = dto.emailId.toLowerCase();
      }
      if (Object.keys(userUpdate).length > 0) {
        await this.prisma.user.update({
          where: { id: branch.branchOwnerId },
          data: userUpdate as any,
        });
      }
    }

    return this.findOne(tenantId, userId, role, branchId);
  }

  async remove(
    tenantId: string,
    userId: string,
    role: string,
    branchId: string,
  ) {
    if (role !== 'OWNER') {
      throw new ForbiddenException('Only the main owner can delete branches');
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    await this.prisma.$transaction([
      this.prisma.branch.update({
        where: { id: branchId },
        data: { isActive: false },
      }),
      this.prisma.user.update({
        where: { id: branch.branchOwnerId },
        data: { isActive: false },
      }),
    ]);

    return { message: 'Branch deleted' };
  }

  async restore(
    tenantId: string,
    userId: string,
    role: string,
    branchId: string,
  ) {
    if (role !== 'OWNER') {
      throw new ForbiddenException('Only the main owner can restore branches');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    await this.prisma.$transaction([
      this.prisma.branch.update({
        where: { id: branchId },
        data: { isActive: true },
      }),
      this.prisma.user.update({
        where: { id: branch.branchOwnerId },
        data: { isActive: true },
      }),
    ]);

    return this.findOne(tenantId, userId, role, branchId);
  }

  /**
   * Determines whether a tenant is allowed to create a new branch based on
   * their active subscription plan and current branch count.
   *
   * Rules:
   * - Only tenants with an ACTIVE Pro subscription can create branches.
   * - Pro tenants may have at most 4 branches (excluding the main tenant).
   * - Trial and Plus (or unknown plans) cannot create branches.
   */
  private async getBranchCreationEligibility(tenantId: string): Promise<{
    canCreateBranch: boolean;
    remainingBranches: number;
    isProPlan: boolean;
  }> {
    const now = new Date();

    // Check for an active subscription and read the plan name.
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
          select: { name: true },
        },
      },
      orderBy: { endsAt: 'desc' },
    });

    const planName = activeSubscription?.plan?.name?.toLowerCase() ?? '';
    const isPro = planName.includes('pro');

    if (!isPro) {
      return {
        canCreateBranch: false,
        remainingBranches: 0,
        isProPlan: false,
      };
    }

    const currentBranchCount = await this.prisma.branch.count({
      where: {
        tenantId,
        // Count both active and inactive branches toward the limit so users
        // cannot bypass limits by "deleting" branches.
      },
    });

    const maxBranches = 4;
    const remainingBranches = Math.max(0, maxBranches - currentBranchCount);

    return {
      canCreateBranch: remainingBranches > 0,
      remainingBranches,
      isProPlan: true,
    };
  }
}
