import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { OrderStatus } from '../enums/order-status.enum';

export class UpdateOrderDto {
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
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsNumber()
  estimatedDays?: number;
}
