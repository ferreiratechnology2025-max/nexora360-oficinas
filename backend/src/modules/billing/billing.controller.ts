import { Controller, Post, Get, Body, Headers, Logger, HttpCode, UseGuards, Req } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('plan')
  getPlan(@Req() req: any) {
    return this.billingService.getPlan(req.user.tenantId);
  }

  /**
   * Webhook MercadoPago — rota pública (MP não envia JWT).
   * MP envia notificações com header x-signature para validação opcional.
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async mercadoPagoWebhook(
    @Body() body: any,
    @Headers('x-signature') signature?: string,
  ) {
    this.logger.log(`MP webhook recebido: ${JSON.stringify(body)}`);
    return this.billingService.handleMercadoPagoWebhook(body);
  }
}
