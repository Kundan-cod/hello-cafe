import { IsString, IsUUID } from 'class-validator';

export class SubscribeDto {
  @IsString()
  @IsUUID()
  planId!: string;
}
