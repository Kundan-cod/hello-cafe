import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddOrderItemDto {
  @IsUUID()
  menuItemId!: string;

  @IsInt()
  @Min(0)
  quantity!: number;
}

export class AddOrderItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AddOrderItemDto)
  items!: AddOrderItemDto[];
}
