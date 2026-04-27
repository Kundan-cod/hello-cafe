import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStaffDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  contactNumber!: string;

  @IsIn(['STAFF', 'BRANCH_OWNER'])
  role!: 'STAFF' | 'BRANCH_OWNER';

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  citizenshipNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @IsOptional()
  @IsString()
  shiftStart?: string;

  @IsOptional()
  @IsString()
  shiftEnd?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  /**
   * Optional custom temporary password that the owner/branch owner can set
   * for this staff member. If omitted, a default temp password is used.
   */
  @IsOptional()
  @IsString()
  @MinLength(6, {
    message: 'Temporary password must be at least 6 characters long',
  })
  tempPassword?: string;
}
