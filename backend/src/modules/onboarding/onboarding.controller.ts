import { Body, Controller, Get, Post, Req, Ip } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { RegisterOnboardingDto } from './dto/register-onboarding.dto';
import { SelectPlanDto } from './dto/select-plan.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /** Cria tenant + owner. Rota pública — ainda sem JWT */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterOnboardingDto, @Ip() ip: string) {
    return this.onboardingService.register(dto, ip);
  }

  /** Associa plano ao tenant — requer JWT (obtido no register) */
  @Post('select-plan')
  selectPlan(@Req() req: any, @Body() dto: SelectPlanDto) {
    return this.onboardingService.selectPlan(req.user.tenantId, dto);
  }

  /** Solicita trial — requer JWT */
  @Post('request-trial')
  requestTrial(@Req() req: any) {
    return this.onboardingService.requestTrial(req.user.tenantId);
  }

  /** Retorna status atual do tenant — requer JWT */
  @Get('status')
  getStatus(@Req() req: any) {
    return this.onboardingService.getStatus(req.user.tenantId);
  }
}
