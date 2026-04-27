import { IsString, MinLength } from 'class-validator';

export class CreateInventoryProductDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  unit!: string;
}
