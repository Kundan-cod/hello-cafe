import { Allow, IsIn } from 'class-validator';

export class UpdateBranchOrderManagementTypeDto {
  @Allow()
  @IsIn(['TABLE_BASED', 'COUNTER_BASED', 'BOTH', null])
  orderManagementType!: 'TABLE_BASED' | 'COUNTER_BASED' | 'BOTH' | null;
}
