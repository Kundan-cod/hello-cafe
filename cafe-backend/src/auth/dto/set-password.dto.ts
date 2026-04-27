import { IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword!: string;
}
