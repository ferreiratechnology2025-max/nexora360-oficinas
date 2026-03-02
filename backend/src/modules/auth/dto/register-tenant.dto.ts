import { IsString, IsEmail, IsPhoneNumber, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

export class RegisterTenantDto {
  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsPhoneNumber('BR')
  phone?: string;
}
