import { Controller, Post, Body, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhatsAppService } from './whatsapp.service';
import { Public } from '../auth/decorators/public.decorator';
import { OrderStatus } from '../orders/enums/order-status.enum';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  // ── Webhook público (Uazapi → Nexora) ─────────────────────────
  @Public()
  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    // Real Uazapi format: { token, instanceName, message: { sender_pn, text, fromMe } }
    // Also handles event-based format: { event: "message", instance/instanceToken, data }
    if (body?.token || body?.instance || body?.instanceToken) {
      return this.whatsappService.handleUazapiWebhook(body);
    }
    // Legacy internal format
    const { phone, message, instanceId } = body ?? {};
    if (phone && message) {
      return this.whatsappService.handleIncomingMessage(phone, message, instanceId);
    }
    return { status: 'ignored' };
  }

  // ── Configuração da instância (owner) ─────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('instance/create')
  async createInstance(@Request() req: any) {
    return this.whatsappService.createInstance(req.user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('qrcode')
  async getQRCode(@Request() req: any) {
    return this.whatsappService.connectInstance(req.user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Request() req: any) {
    return this.whatsappService.getStatus(req.user.tenantId);
  }

  // ── Envio de mensagens ─────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('send-message')
  async sendMessage(@Request() req: any, @Body() dto: { phone: string; message: string }) {
    return this.whatsappService.sendMessage(req.user.tenantId, dto.phone, dto.message);
  }

  @Public()
  @Post('send-order-update')
  async sendOrderUpdate(@Body() dto: { orderId: string; status: OrderStatus; message?: string }) {
    return this.whatsappService.sendOrderUpdate(dto.orderId, dto.status, dto.message);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check-status')
  async checkStatus() {
    return this.whatsappService.checkConnectionStatus();
  }
}
