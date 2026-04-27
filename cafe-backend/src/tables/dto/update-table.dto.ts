import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  status?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
}
