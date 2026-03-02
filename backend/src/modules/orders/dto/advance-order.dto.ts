import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class AdvanceOrderDto {
  /** Diagnóstico técnico — obrigatório ao avançar para 'diagnosis' */
  @IsOptional()
  @IsString()
  diagnosis?: string;

  /** Deve ser true ao avançar de waiting_approval → in_progress */
  @IsOptional()
  @IsBoolean()
  clientApproved?: boolean;
}
