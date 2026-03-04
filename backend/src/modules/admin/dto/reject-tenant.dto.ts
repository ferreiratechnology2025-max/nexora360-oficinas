import { IsNotEmpty, IsString } from 'class-validator';

export class RejectTenantDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}
