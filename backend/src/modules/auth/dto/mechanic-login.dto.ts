import { IsString, MinLength } from 'class-validator';

export class MechanicLoginDto {
  @IsString()
  @MinLength(3)
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  tenantSlug: string;
}
