import { IsNotEmpty, IsString } from 'class-validator';

export class RejectTrialDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}
