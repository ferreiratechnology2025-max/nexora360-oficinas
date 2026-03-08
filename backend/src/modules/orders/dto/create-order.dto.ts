import { IsString, IsOptional, IsNumber, IsEnum, IsNotEmpty } from 'class-validator';

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsNotEmpty()
  @IsString()
  vehicleId: string;

  @IsOptional()
  @IsString()
  mechanicId?: string;

  @IsOptional()
  @IsString()
  problemDescription?: string;

  @IsOptional()
  @IsNumber()
  laborValue?: number;

  @IsOptional()
  @IsNumber()
  partsValue?: number;

  @IsOptional()
  @IsString()
  mechanicNotes?: string;

  @IsOptional()
  @IsNumber()
  estimatedDays?: number;

  @IsOptional()
  @IsNumber()
  currentKm?: number;

  @IsOptional()
  @IsString()
  trackingToken?: string;
}
