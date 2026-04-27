import { IsOptional, IsString } from 'class-validator';

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
