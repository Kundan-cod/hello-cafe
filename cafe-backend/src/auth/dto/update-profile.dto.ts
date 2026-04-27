import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  /** Required when newPassword is provided; used to verify identity */
  @ValidateIf((o) => !!o.newPassword)
  @IsString()
  @MinLength(1, { message: 'Current password is required to change password' })
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  newPassword?: string;

  /** Owner only */
  @IsOptional()
  @IsString()
  panNumber?: string;

  /** Owner only */
  @IsOptional()
  @IsString()
  contactNumber?: string;

  /** Owner only */
  @IsOptional()
  @IsString()
  name?: string;
}
