import { IsIn } from 'class-validator';

export class UpdateTenantDto {
  @IsIn(['TABLE_BASED', 'COUNTER_BASED', 'BOTH'])
  orderManagementType!: 'TABLE_BASED' | 'COUNTER_BASED' | 'BOTH';
}
