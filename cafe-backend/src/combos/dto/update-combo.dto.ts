import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ComboItemUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  // Optional link to an existing menu item for richer analytics & validation.
  @IsOptional()
  @IsString()
  menuItemId?: string;
}

export class UpdateComboDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboItemUpdateDto)
  items?: ComboItemUpdateDto[];
}
