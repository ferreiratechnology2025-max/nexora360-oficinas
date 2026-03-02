import { IsString, IsOptional, IsPhoneNumber, IsEmail, IsNumber, Min } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber('BR')
  phone?: string;

  @IsOptional()
  @IsString()
  openingTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteMensagens?: number;
}

export class UpdateUazapiDto {
  @IsOptional()
  @IsString()
  uazapiInstanceId?: string;

  @IsOptional()
  @IsString()
  uazapiToken?: string;
}
