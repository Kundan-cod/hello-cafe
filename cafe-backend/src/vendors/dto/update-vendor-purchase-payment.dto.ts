import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateVendorPurchasePaymentDto {
  @IsNumber()
  @Min(0)
  paidAmount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
