import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateInventoryProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  unit?: string;
}
