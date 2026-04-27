import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ComboItemDto {
  @IsString()
  name!: string;

  // Optional link to an existing menu item for richer analytics & validation.
  @IsOptional()
  @IsString()
  menuItemId?: string;
}

export class CreateComboDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboItemDto)
  items?: ComboItemDto[];
}
