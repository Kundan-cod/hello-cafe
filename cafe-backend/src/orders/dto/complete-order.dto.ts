import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PaymentDto {
  @IsString()
  method!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

class VatBillDto {
  @IsString()
  name!: string;

  @IsString()
  pan!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CompleteOrderDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsIn(['FULL', 'BILL_SPLITTING', 'PARTIAL'])
  paymentType!: 'FULL' | 'BILL_SPLITTING' | 'PARTIAL';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments?: PaymentDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => VatBillDto)
  vatBill?: VatBillDto;
}
