import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class RequestSubscriptionDto {
  @IsString()
  @IsUUID()
  planId!: string;

  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @IsNumber()
  @IsPositive()
  paidAmount!: number;

  @IsOptional()
  @IsString()
  screenshotUrl?: string;
}
