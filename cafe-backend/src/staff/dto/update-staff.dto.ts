import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsIn(['STAFF', 'BRANCH_OWNER'])
  role?: 'STAFF' | 'BRANCH_OWNER';

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
  branchId?: string | null;

  @IsOptional()
  isActive?: boolean;
}
