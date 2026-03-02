import { Controller, Post, Body, Headers, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhatsAppService } from './whatsapp.service';
import { Public } from '../auth/decorators/public.decorator';
import { OrderStatus } from '../orders/enums/order-status.enum';

@Public()
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) { }

  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    const { phone, message, instanceId } = body;
    return this.whatsappService.handleIncomingMessage(phone, message, instanceId);
  }

  @Post('send-message')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Request() req: any, @Body() dto: { phone: string; message: string }) {
    return this.whatsappService.sendMessage(req.user.tenantId, dto.phone, dto.message);
  }

  @Post('send-order-update')
  async sendOrderUpdate(@Body() dto: { orderId: string; status: OrderStatus; message?: string }) {
    return this.whatsappService.sendOrderUpdate(dto.orderId, dto.status, dto.message);
  }

  @Get('check-status')
  async checkStatus() {
    return this.whatsappService.checkConnectionStatus();
  }
}
