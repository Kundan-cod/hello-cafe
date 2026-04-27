import { IsNumber, IsString, Min } from 'class-validator';

export class MenuItemUsageDto {
  @IsString()
  inventoryProductId!: string;

  @IsNumber()
  @Min(0.001)
  quantityPerUnit!: number;
}
