import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MinLength(1, { message: 'Branch location is required' })
  branchLocation!: string;

  @IsString()
  @MinLength(1, { message: 'Branch admin name is required' })
  branchAdmin!: string;

  @IsEmail()
  emailId!: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  /**
   * Optional custom temporary password that the owner can set
   * for the new branch owner. If omitted, a default temp password is used.
   */
  @IsOptional()
  @IsString()
  @MinLength(6, {
    message: 'Temporary password must be at least 6 characters long',
  })
  tempPassword?: string;
}
