import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddStockDto {
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
