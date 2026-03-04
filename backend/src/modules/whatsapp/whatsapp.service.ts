import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { WHATSAPP_QUEUE } from './whatsapp.processor';
import { AiService } from '../../ai/ai.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl: string;
  private readonly adminToken: string;

  constructor(
    private prisma: PrismaService,
    @InjectQueue(WHATSAPP_QUEUE) private whatsappQueue: Queue,
    private ai: AiService,
  ) {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://nexora360.uazapi.com';
    this.adminToken = process.env.WHATSAPP_API_TOKEN || '';
    this.logger.log('WhatsApp service initialized');
  }

  // ── Gerenciamento de Instâncias ────────────────────────────────

  async createInstance(tenantId: string): Promise<{ instanceId: string; instanceToken: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant não encontrado');

    const response = await fetch(`${this.apiUrl}/instance/init`, {
      method: 'POST',
      headers: {
        'admintoken': this.adminToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: tenant.slug }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      this.logger.error('Erro ao criar instância Uazapi', err);
      throw new Error(`Uazapi createInstance error: ${response.status}`);
    }

    const data = await response.json();
    const instanceId: string = data.instance?.id || data.instance?.name || tenant.slug;
    const instanceToken: string = data.token || data.instance?.token;

    if (!instanceToken) {
      throw new Error('Uazapi não retornou token da instância');
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappInstance: instanceId,
        whatsappInstanceToken: instanceToken,
      },
    });

    this.logger.log(`Instância criada para tenant ${tenantId}: ${instanceId}`);
    return { instanceId, instanceToken };
  }

  async connectInstance(tenantId: string): Promise<{ qrcode?: string; paircode?: string; status: string }> {
    const instanceToken = await this.getInstanceToken(tenantId);

    const response = await fetch(`${this.apiUrl}/instance/connect`, {
      method: 'POST',
      headers: {
        'token': instanceToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Uazapi connectInstance error: ${response.status} — ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    return {
      qrcode: data.instance?.qrcode,
      paircode: data.instance?.paircode,
      status: data.instance?.status || 'connecting',
    };
  }

  async getStatus(tenantId: string): Promise<{ status: string; connected: boolean; qrcode?: string }> {
    const instanceToken = await this.getInstanceToken(tenantId);

    const response = await fetch(`${this.apiUrl}/instance/status`, {
      method: 'GET',
      headers: { 'token': instanceToken },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Uazapi getStatus error: ${response.status} — ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    return {
      status: data.instance?.status || 'disconnected',
      connected: data.status?.connected || false,
      qrcode: data.instance?.qrcode,
    };
  }

  // ── Envio de Mensagens ─────────────────────────────────────────

  async sendMessage(tenantId: string, phone: string, message: string) {
    await this.whatsappQueue.add('send-message', { tenantId, phone, message });
    await this.saveWhatsAppMessage(tenantId, phone, message, 'queued');
    this.logger.log(`Message queued for ${phone}`);
    return { success: true, queued: true };
  }

  async sendMessageDirect(tenantId: string, phone: string, message: string) {
    const instanceToken = await this.getInstanceToken(tenantId);

    const response = await fetch(`${this.apiUrl}/send/text`, {
      method: 'POST',
      headers: {
        'token': instanceToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number: phone, text: message }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      this.logger.error(`Uazapi sendText error for ${phone}`, err);
      throw new Error(`Uazapi sendText error: ${response.status}`);
    }

    await this.saveWhatsAppMessage(tenantId, phone, message, 'sent');
    this.logger.log(`Message sent to ${phone}`);
    return { success: true };
  }

  // ── Webhook ────────────────────────────────────────────────────

  async handleWebhook(body: any, signature?: string) {
    const expectedSignature = this.generateWebhookSignature(body);
    if (signature && expectedSignature !== signature) {
      this.logger.warn('Invalid webhook signature');
      throw new Error('Invalid webhook signature');
    }

    this.logger.log('Webhook received');

    if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
      const instanceId = body.entry?.[0]?.id;
      if (!instanceId) throw new BadRequestException('instanceId não informado no webhook');

      const tenant = await this.prisma.tenant.findFirst({ where: { slug: instanceId } });
      if (!tenant) throw new BadRequestException(`instanceId '${instanceId}' não cadastrada`);

      for (const message of body.entry[0].changes[0].value.messages) {
        if (message.type === 'text') {
          await this.saveWhatsAppMessage(tenant.id, message.from, message.text.body, 'received', instanceId);
        }
      }
    }
    return { status: 'success' };
  }

  async handleIncomingMessage(phone: string, message: string, instanceId: string) {
    if (!instanceId) throw new BadRequestException('instanceId não informado');

    const tenant = await this.prisma.tenant.findFirst({ where: { slug: instanceId } });
    if (!tenant) throw new BadRequestException(`instanceId '${instanceId}' não cadastrada`);

    await this.saveWhatsAppMessage(tenant.id, phone, message, 'received', instanceId);
    this.logger.log(`Incoming message from ${phone} via instance ${instanceId}`);
    return { success: true };
  }

  // ── Notificações de OS ─────────────────────────────────────────

  async sendOrderStatusNotification(
    order: {
      tenantId: string;
      trackingToken: string;
      diagnosis?: string | null;
      laborValue: number;
      partsValue: number;
      totalValue: number;
      customer: { name: string; phone: string };
      vehicle: { brand: string; model: string };
    },
    newStatus: string,
  ) {
    const firstName = order.customer.name.split(' ')[0];
    const vehicle = `${order.vehicle.brand} ${order.vehicle.model}`.trim();
    const trackingUrl = `https://nexora360.com/tracking/${order.trackingToken}`;
    const totalValue = order.totalValue || order.laborValue + order.partsValue;

    let message: string;

    switch (newStatus) {
      case 'received':
        message =
          `Olá *${firstName}*! Seu *${vehicle}* chegou à oficina. ` +
          `Acompanhe o serviço em tempo real:\n👉 ${trackingUrl}`;
        break;

      case 'diagnosis': {
        let diagnosisText = 'em análise técnica';
        if (order.diagnosis) {
          try {
            diagnosisText = await this.ai.chat([
              {
                role: 'system',
                content:
                  'Você é um especialista em comunicação com clientes de oficina. ' +
                  'Traduza o diagnóstico técnico abaixo para uma linguagem simples e clara, ' +
                  'em no máximo 2 frases, sem jargões mecânicos.',
              },
              { role: 'user', content: order.diagnosis },
            ]);
          } catch (err) {
            this.logger.warn(`AI diagnosis translation failed: ${err.message}`);
            diagnosisText = order.diagnosis;
          }
        }
        message =
          `🔍 Diagnóstico do seu *${vehicle}*:\n\n${diagnosisText}\n\n` +
          `Em breve você receberá o orçamento detalhado.`;
        break;
      }

      case 'waiting_approval':
        message =
          `💰 *Orçamento pronto!*\n\n` +
          `Veículo: ${vehicle}\n` +
          `Valor total: *R$ ${totalValue.toFixed(2)}*\n\n` +
          `Responda *SIM* para aprovar ou *NÃO* para recusar.\n` +
          `Acompanhe: ${trackingUrl}`;
        break;

      case 'in_progress':
        message =
          `🔧 Ótima notícia! Seu *${vehicle}* está sendo reparado agora. ` +
          `Você será avisado assim que estiver pronto.`;
        break;

      case 'testing':
        message =
          `✅ O reparo do seu *${vehicle}* foi concluído e estamos realizando os testes finais. ` +
          `Em breve você poderá buscá-lo.`;
        break;

      case 'ready':
        message =
          `🎉 Seu *${vehicle}* está *pronto*! Pode buscar na oficina.\n\n` +
          `Acompanhe: ${trackingUrl}`;
        break;

      case 'delivered':
        message =
          `Obrigado pela confiança, *${firstName}*! 🙏\n\n` +
          `Como foi sua experiência conosco? Responda com uma nota de *1 a 5*.`;
        break;

      case 'cancelled':
        message =
          `Sua ordem de serviço para o *${vehicle}* foi cancelada. ` +
          `Em caso de dúvidas, entre em contato com nossa equipe.`;
        break;

      default:
        return;
    }

    try {
      await this.sendMessage(order.tenantId, order.customer.phone, message);
    } catch (err) {
      this.logger.error(`Failed to send status notification (${newStatus}): ${err.message}`);
    }
  }

  async sendOrderUpdate(orderId: string, status: string, customMessage?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, vehicle: true },
    });

    if (!order) throw new Error('Order not found');

    let message = `*Atualização da Ordem de Serviço #${order.trackingToken}*\n\n`;
    message += `Status atual: *${this.getStatusDisplay(status)}*`;
    if (customMessage) message += `\n\n${customMessage}`;

    await this.sendMessage(order.tenantId, order.customer.phone, message);
    return { success: true };
  }

  async checkConnectionStatus() {
    return { status: 'connected', lastCheck: new Date() };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async getInstanceToken(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { whatsappInstanceToken: true, slug: true },
    });

    if (!tenant?.whatsappInstanceToken) {
      throw new BadRequestException(
        `Instância WhatsApp não configurada para este tenant. Acesse Configurações → WhatsApp para conectar.`,
      );
    }

    return tenant.whatsappInstanceToken;
  }

  private generateWebhookSignature(body: any): string {
    const crypto = require('crypto');
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_TOKEN;
    if (!webhookSecret) {
      this.logger.warn('WHATSAPP_WEBHOOK_TOKEN not configured');
      return '';
    }
    return crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(body)).digest('hex');
  }

  private getStatusDisplay(status: string) {
    const statusMap: Record<string, string> = {
      received: 'Recebido',
      diagnosis: 'Em diagnóstico',
      waiting_approval: 'Aguardando aprovação',
      in_progress: 'Em andamento',
      testing: 'Em testes',
      ready: 'Pronto',
      delivered: 'Entregue',
      cancelled: 'Cancelado',
    };
    return statusMap[status] || status;
  }

  private async saveWhatsAppMessage(
    tenantId: string,
    phone: string,
    message: string,
    status: string,
    instanceId?: string,
  ) {
    await this.prisma.whatsAppMessage.create({
      data: {
        tenantId,
        phone,
        message,
        status,
        ...(instanceId ? { instanceId } : {}),
        sentAt: new Date(),
      },
    });
  }
}
