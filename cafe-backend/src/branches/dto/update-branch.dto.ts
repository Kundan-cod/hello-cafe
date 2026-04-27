import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  branchLocation?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  branchAdmin?: string;

  @IsOptional()
  @IsEmail()
  emailId?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;
}
