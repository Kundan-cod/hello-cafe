import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { AdminSetTempPasswordDto } from './dto/admin-set-temp-password.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(req: any) {
    if (req?.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admin users can access this resource');
    }
  }

  /**
   * List all users across all cafes for the admin panel.
   *
   * GET /admin/users
   */
  @Get()
  async getAllUsers(@Req() req: any) {
    this.assertAdmin(req);
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        createdAt: true,
        tenant: {
          select: {
            cafeName: true,
            planType: true,
            currentSubscriptionEnd: true,
          },
        },
      },
    });

    return users;
  }

  /**
   * Set a temporary password for a user.
   * Only ADMIN role (env-based admin) can call this.
   *
   * POST /admin/users/:id/set-temp-password
   * Body: { tempPassword: string }
   */
  @Post(':id/set-temp-password')
  async setTempPassword(
    @Param('id') id: string,
    @Body() body: AdminSetTempPasswordDto,
    @Req() req: any,
  ) {
    this.assertAdmin(req);

    const { tempPassword } = body;
    if (!tempPassword || tempPassword.length < 6) {
      throw new BadRequestException(
        'Temporary password must be at least 6 characters.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const hashed = await bcrypt.hash(tempPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashed,
        mustChangePassword: true,
        isActive: true,
      },
    });

    return {
      message:
        'Temporary password has been set. Share it with the user and ask them to log in and change it.',
    };
  }
}
