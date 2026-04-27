import { IsNotEmpty, IsString } from 'class-validator';

export class RejectSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  note!: string;
}
