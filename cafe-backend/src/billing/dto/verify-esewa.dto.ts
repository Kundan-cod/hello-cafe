import { IsString } from 'class-validator';

export class VerifyEsewaDto {
  @IsString()
  pid!: string;

  @IsString()
  refId!: string;
}
