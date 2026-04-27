import { IsString, MinLength } from 'class-validator';

export class AdminSetTempPasswordDto {
  @IsString()
  @MinLength(6, { message: 'Temporary password must be at least 6 characters' })
  tempPassword!: string;
}
