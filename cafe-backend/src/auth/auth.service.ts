import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { MailerService } from '../mailer/mailer.service';

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isStrongPassword(password: string): boolean {
  // Minimum 6 characters, any characters allowed.
  return typeof password === 'string' && password.length >= 6;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailer: MailerService,
  ) {}

  async registerCafe(data: RegisterDto) {
    const normalizedEmail = normalizeEmail(data.email);

    if (!isStrongPassword(data.password)) {
      throw new BadRequestException(
        'Password must be at least 6 characters long.',
      );
    }

    const hashed = await bcrypt.hash(data.password, 10);
    const now = new Date();
    const trialDurationDays = 15;
    const trialEndsAt = new Date(
      now.getTime() + trialDurationDays * 24 * 60 * 60 * 1000,
    );
    const planType = data.planType ?? 'TRIAL';

    try {
      const tenant = await this.prisma.$transaction(async (tx) => {
        const createdTenant = await tx.tenant.create({
          data: {
            cafeName: data.cafeName,
            contactNumber: data.contactNumber,
            province: data.province,
            district: data.district,
            location: data.location,
            brandPrimaryColor: data.brandPrimaryColor,
            brandSecondaryColor: data.brandSecondaryColor,
            orderManagementType: data.orderManagementType,
            panNumber: data.panNumber,
            planType,
            // New cafes on TRIAL get a 15‑day trial window.
            currentSubscriptionEnd: planType === 'TRIAL' ? trialEndsAt : null,
            users: {
              create: {
                name: data.name,
                email: normalizedEmail,
                password: hashed,
                role: 'OWNER',
                contactNumber: data.contactNumber,
                // Owner sets password during registration; no forced change on first login.
                mustChangePassword: false,
              },
            },
          },
          include: { users: true },
        } as any);

        return createdTenant as any;
      });

      const user = tenant.users[0];
      const payload = {
        sub: user.id,
        tenantId: tenant.id,
        role: user.role,
      };
      const access_token = this.jwtService.sign(payload);

      return {
        access_token,
        tenantId: tenant.id,
        role: user.role,
        branchId: user.branchId ?? null,
        mustChangePassword: user.mustChangePassword,
        user: { name: user.name, email: user.email },
      };
    } catch (e: any) {
      // Prisma unique constraint on email
      if (typeof e?.code === 'string' && e.code === 'P2002') {
        throw new BadRequestException('Email already in use');
      }

      console.error('[Auth] registerCafe failed', e);
      throw new InternalServerErrorException(
        'Registration failed. Please try again later.',
      );
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      branchId: user.branchId ?? null,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      tenantId: user.tenantId,
      role: user.role,
      branchId: user.branchId ?? null,
      mustChangePassword: user.mustChangePassword,
      user: { name: user.name, email: user.email },
    };
  }

  /**
   * Sends a password reset request to the admin email, including the user's email.
   * The admin will handle the actual reset flow manually (e.g. by contacting the user).
   * Response is generic to avoid email enumeration.
   */
  async requestPasswordReset(rawEmail: string) {
    const email = normalizeEmail(rawEmail);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Resolve admin email: prefer MAIL_FROM, otherwise ADMIN_USERNAME.
    const adminEmail =
      process.env.MAIL_FROM || process.env.ADMIN_USERNAME || null;

    if (!adminEmail) {
      console.warn(
        '[Auth] No admin email configured. Set MAIL_FROM or ADMIN_USERNAME.',
      );
      throw new InternalServerErrorException(
        'Password reset is not configured on the server.',
      );
    }

    // Always respond generically, but include details in the admin email if we find a user.
    const now = new Date().toISOString();

    const lines: string[] = [
      'A user requested a password reset in Hello Café.',
      '',
      `Requested at: ${now}`,
      `User email (entered): ${email}`,
    ];

    if (user) {
      lines.push(
        `Matched user: ${user.name} (id: ${user.id})`,
        `Tenant ID: ${user.tenantId}`,
        `Role: ${user.role}`,
        `Contact number: ${user.contactNumber ?? 'N/A'}`,
      );
    } else {
      lines.push('No matching user was found for this email in the database.');
    }

    lines.push(
      '',
      'Please reach out to the user and handle the password reset manually (e.g. by setting a temporary password).',
    );

    try {
      await this.mailer.sendMail({
        to: adminEmail,
        subject: 'Hello Café – Password reset request',
        text: lines.join('\n'),
      });
    } catch (err) {
      console.error(
        '[Auth] Failed to send password reset request email to admin',
        adminEmail,
        err,
      );
      throw new InternalServerErrorException(
        'Failed to submit password reset request. Please try again later.',
      );
    }

    return {
      message:
        'If an account exists with this email, the admin has been notified.',
    };
  }

  /**
   * Returns the current user's profile. Owners get name, email, contactNumber, panNumber;
   * others get name and email only.
   */
  async getProfile(userId: string, role: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

    const base = { name: user.name, email: user.email };
    if (role === 'OWNER') {
      return {
        ...base,
        contactNumber: user.contactNumber ?? null,
        panNumber: user.panNumber ?? null,
      };
    }
    return base;
  }

  /**
   * Updates the current user's profile. OWNER can change password, panNumber, contactNumber, name.
   * Others (STAFF, BRANCH_OWNER) can change only password. Password change requires currentPassword.
   */
  async updateProfile(
    userId: string,
    role: string,
    data: {
      currentPassword?: string;
      newPassword?: string;
      panNumber?: string;
      contactNumber?: string;
      name?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

    const isOwner = role === 'OWNER';

    if (data.newPassword) {
      if (!data.currentPassword) {
        throw new BadRequestException(
          'Current password is required to change password',
        );
      }
      const match = await bcrypt.compare(data.currentPassword, user.password);
      if (!match)
        throw new BadRequestException('Current password is incorrect');
      if (!isStrongPassword(data.newPassword)) {
        throw new BadRequestException(
          'Password must be at least 6 characters long.',
        );
      }
    }

    if (
      !isOwner &&
      (data.panNumber !== undefined ||
        data.contactNumber !== undefined ||
        data.name !== undefined)
    ) {
      throw new ForbiddenException(
        'Only cafe owner can update PAN, contact number, or name',
      );
    }

    const updateData: Record<string, any> = {};
    if (data.newPassword) {
      updateData.password = await bcrypt.hash(data.newPassword, 10);
    }
    if (isOwner) {
      if (data.panNumber !== undefined)
        updateData.panNumber = data.panNumber || null;
      if (data.contactNumber !== undefined)
        updateData.contactNumber = data.contactNumber || null;
      if (data.name !== undefined) updateData.name = data.name;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getProfile(userId, role);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    return this.getProfile(userId, role);
  }

  async setPassword(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.mustChangePassword) {
      throw new BadRequestException('Password was already set');
    }

    if (!isStrongPassword(newPassword)) {
      throw new BadRequestException(
        'Password must be at least 6 characters long.',
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: false },
    });
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      branchId: user.branchId ?? null,
    };
    const access_token = this.jwtService.sign(payload);
    return {
      access_token,
      tenantId: user.tenantId,
      role: user.role,
      branchId: user.branchId ?? null,
      mustChangePassword: false,
      user: { name: user.name, email: user.email },
    };
  }

  /**
   * Simple admin login that checks credentials from environment variables
   * and returns a JWT with role = "ADMIN". This does not create a User row.
   *
   * Env vars:
   * - ADMIN_USERNAME
   * - ADMIN_PASSWORD
   */
  async adminLogin(username: string, password: string) {
    const envUser = process.env.ADMIN_USERNAME;
    const envPass = process.env.ADMIN_PASSWORD;

    if (!envUser || !envPass) {
      throw new InternalServerErrorException(
        'Admin login is not configured on the server',
      );
    }

    if (username !== envUser || password !== envPass) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const payload = {
      sub: 'admin',
      tenantId: null,
      role: 'ADMIN',
      branchId: null,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      tenantId: null,
      role: 'ADMIN',
      branchId: null,
      mustChangePassword: false,
      user: { name: 'Admin', email: username },
    };
  }
}
