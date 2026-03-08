import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

export class AdvanceOrderDto {
  /** Diagnóstico técnico — obrigatório ao avançar para 'diagnosis' */
  @IsOptional()
  @IsString()
  diagnosis?: string;

  /** Deve ser true ao avançar de waiting_approval → in_progress */
  @IsOptional()
  @IsBoolean()
  clientApproved?: boolean;

  /** Mão de obra (R$) — usado ao avançar diagnosis → waiting_approval */
  @IsOptional()
  @IsNumber()
  laborValue?: number;

  /** Peças (R$) — usado ao avançar diagnosis → waiting_approval */
  @IsOptional()
  @IsNumber()
  partsValue?: number;
}
