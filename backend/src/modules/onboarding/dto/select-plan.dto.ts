import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class SelectPlanDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['starter', 'profissional', 'elite'])
  planName: string;
}
