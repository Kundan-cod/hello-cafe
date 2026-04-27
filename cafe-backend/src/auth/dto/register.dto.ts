import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum PlanType {
  TRIAL = 'TRIAL',
  PAID = 'PAID',
}

export class RegisterDto {
  @IsString()
  cafeName!: string;

  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  brandPrimaryColor?: string;

  @IsOptional()
  @IsString()
  brandSecondaryColor?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TABLE_BASED', 'COUNTER_BASED', 'BOTH'])
  orderManagementType?: 'TABLE_BASED' | 'COUNTER_BASED' | 'BOTH';

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsEnum(PlanType)
  planType?: PlanType;
}
