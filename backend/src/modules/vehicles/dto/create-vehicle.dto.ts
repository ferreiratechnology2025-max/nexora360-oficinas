import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  brand: string;

  @IsString()
  model: string;

  @IsNumber()
  year: number;

  @IsString()
  plate: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  fuel?: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsString()
  customerId: string;
}
