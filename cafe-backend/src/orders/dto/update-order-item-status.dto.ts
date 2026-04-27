import { IsIn } from 'class-validator';

export class UpdateOrderItemStatusDto {
  @IsIn(['PENDING', 'SERVED'])
  status!: 'PENDING' | 'SERVED';
}
