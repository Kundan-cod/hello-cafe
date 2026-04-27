import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminUsersController } from './admin-users.controller';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    PassportModule,
    MailerModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'SUPER_SECRET_KEY_CHANGE_LATER',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController, AdminUsersController],
})
export class AuthModule {}
