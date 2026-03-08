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

  // Deduplication: track recently processed message IDs to prevent double-send
  // when both Global and per-instance Uazapi webhooks are active
  private readonly processedMessages = new Map<string, number>(); // messageId → timestamp
  private readonly DEDUP_TTL_MS = 60_000; // 1 minute

  private isDuplicateMessage(messageId: string): boolean {
    const now = Date.now();
    // Cleanup expired entries
    for (const [id, ts] of this.processedMessages.entries()) {
      if (now - ts > this.DEDUP_TTL_MS) this.processedMessages.delete(id);
    }
    if (this.processedMessages.has(messageId)) return true;
    this.processedMessages.set(messageId, now);
    return false;
  }

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

    // Save real instanceToken to both fields so webhook lookup works correctly
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappInstance: instanceToken,
        whatsappInstanceToken: instanceToken,
      },
    });

    this.logger.log(`Instância criada para tenant ${tenantId}: id=${instanceId} token=${instanceToken}`);
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

  async getStatus(tenantId: string): Promise<{ status: string; connected: boolean; hasInstance: boolean; qrcode?: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { whatsappInstanceToken: true },
    });

    if (!tenant?.whatsappInstanceToken) {
      return { status: 'disconnected', connected: false, hasInstance: false };
    }

    const response = await fetch(`${this.apiUrl}/instance/status`, {
      method: 'GET',
      headers: { 'token': tenant.whatsappInstanceToken },
    });

    if (!response.ok) {
      return { status: 'disconnected', connected: false, hasInstance: true };
    }

    const data = await response.json();
    const connected: boolean = data.instance?.connected || data.status?.connected || false;
    const status: string = data.instance?.status || 'disconnected';

    // When connected, fetch real instanceToken from /instance/info and persist it
    if (connected) {
      try {
        const infoRes = await fetch(`${this.apiUrl}/instance/info`, {
          method: 'GET',
          headers: { 'instancetoken': tenant.whatsappInstanceToken },
        });
        if (infoRes.ok) {
          const info = await infoRes.json();
          const realToken: string | undefined =
            info.instance?.token || info.token || info.instanceToken;
          if (realToken && realToken !== tenant.whatsappInstanceToken) {
            await this.prisma.tenant.update({
              where: { id: tenantId },
              data: { whatsappInstance: realToken, whatsappInstanceToken: realToken },
            });
            this.logger.log(`instanceToken sincronizado para tenant ${tenantId}: ${realToken}`);
          }
        }
      } catch (err) {
        this.logger.warn(`Falha ao buscar /instance/info: ${err.message}`);
      }
    }

    return { status, connected, hasInstance: true, qrcode: data.instance?.qrcode };
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

  // ── Webhook Uazapi ────────────────────────────────────────────

  /**
   * Processa payload real do Uazapi:
   * { token, instanceName, message: { sender_pn, text, fromMe }, chat: { phone } }
   * Também suporta formatos anteriores por retrocompatibilidade.
   */
  async handleUazapiWebhook(body: any): Promise<{ status: string }> {
    // Accept real Uazapi format (no "event" field) or legacy event-based format
    if (body.event && body.event !== 'message') return { status: 'ignored' };

    // Instance identifier — real format uses "token", fallbacks for older formats
    const instanceToken: string =
      body.token || body.instance || body.instanceToken || '';
    if (!instanceToken) return { status: 'ignored' };

    // Sender phone number
    const from: string =
      body.message?.sender_pn ||
      body.data?.from || body.data?.key?.remoteJid || '';

    // Message text
    const msgBody: string =
      body.message?.text ||
      body.data?.body || body.data?.text ||
      body.data?.message?.conversation ||
      body.data?.message?.extendedTextMessage?.text || '';

    // fromMe flag
    const fromMe: boolean =
      body.message?.fromMe ?? body.data?.fromMe ?? body.data?.key?.fromMe ?? false;

    if (fromMe || !from || !msgBody) return { status: 'ignored' };

    // Deduplication: if Global + per-instance webhooks are both active, the same
    // message arrives twice. Use the message ID to drop the duplicate.
    const messageId: string =
      body.message?.id || body.data?.key?.id || body.messageId || '';
    if (messageId && this.isDuplicateMessage(messageId)) {
      this.logger.warn(`Duplicate webhook for messageId ${messageId} — ignored`);
      return { status: 'ignored' };
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { whatsappInstanceToken: instanceToken },
          { whatsappInstance: instanceToken },
        ],
      },
      select: { id: true, nome: true, whatsappInstanceToken: true },
    });
    if (!tenant) {
      this.logger.warn(`Webhook: instance not found for token/id: ${instanceToken.slice(0, 20)}`);
      return { status: 'ignored' };
    }

    // Normalize phone: remove @s.whatsapp.net suffix and non-digits
    const rawPhone = from.replace(/@s\.whatsapp\.net$/, '');
    const digitsOnly = rawPhone.replace(/\D/g, '');

    // Build variants to match stored formats (with or without country code 55)
    const withoutCountry = digitsOnly.replace(/^55/, ''); // e.g. "6299063107" (10 digits)
    // If 10 digits (DDD + 8-digit number), insert 9 after DDD+first digit to get 11-digit format
    // "6299063107" → "629" + "9" + "9063107" = "62999063107"
    const withNine = withoutCountry.length === 10
      ? withoutCountry.slice(0, 3) + '9' + withoutCountry.slice(3)
      : '';
    const phoneVariants = Array.from(new Set([
      digitsOnly,           // 5562999063107
      withoutCountry,       // 6299063107
      withNine,             // 62999063107 ✅
      digitsOnly.slice(-11),
      digitsOnly.slice(-10),
    ].filter(Boolean)));

    // Find customer — try all phone variants
    const customer = await this.prisma.customer.findFirst({
      where: {
        tenantId: tenant.id,
        phone: { in: phoneVariants },
      },
      include: {
        vehicles: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!customer) {
      this.logger.log(`Webhook: customer not found for phone ${rawPhone}`);
      return { status: 'ignored' };
    }

    const firstName = customer.name.split(' ')[0];

    // ── Rating check ───────────────────────────────────────────
    const ratingMatch = msgBody.trim().match(/^[1-5]$/);
    if (ratingMatch) {
      const pendingOrder = await this.prisma.order.findFirst({
        where: {
          tenantId: tenant.id,
          customerId: customer.id,
          status: 'delivered',
          ratingAsked: true,
          rating: null,
        },
        orderBy: { deliveredAt: 'desc' },
      });

      if (pendingOrder) {
        const rating = parseInt(ratingMatch[0], 10);

        // Save rating on Order
        await this.prisma.order.update({
          where: { id: pendingOrder.id },
          data: { rating },
        });

        // Upsert Review record
        await this.prisma.review.upsert({
          where: { orderId: pendingOrder.id },
          create: {
            tenantId: tenant.id,
            orderId: pendingOrder.id,
            customerId: customer.id,
            rating,
          },
          update: { rating },
        });

        const response =
          rating >= 4
            ? `Que ótimo, ${firstName}! 😊 Fico feliz que tenha gostado. Até a próxima — nossa equipe estará sempre à disposição! 🔧`
            : `Obrigado pelo feedback, ${firstName}. Sentimos muito pela experiência. Pode nos contar o que aconteceu? Queremos melhorar! 🙏`;

        await this.sendMessage(tenant.id, rawPhone, response);
        this.logger.log(`Rating ${rating}/5 saved for order ${pendingOrder.id}`);
        return { status: 'rating_saved' };
      }
    }

    // ── AI assistant response ───────────────────────────────────
    const vehicle = customer.vehicles?.[0]
      ? `${(customer.vehicles[0] as any).brand} ${(customer.vehicles[0] as any).model}`
      : 'veículo';

    const prompt =
      `Você é a assistente virtual da oficina ${tenant.nome}.\n` +
      `Ao responder, mencione o nome da oficina naturalmente quando relevante.\n` +
      `Ex: 'Aqui na ${tenant.nome} podemos ajudar...' ou 'Pode trazer seu carro à ${tenant.nome}...'\n` +
      `Cliente ${firstName} com ${vehicle} enviou: '${msgBody}'\n` +
      `Responda APENAS se for relacionado a carros, mecânica ou serviços da oficina.\n` +
      `Se for saudação simples, responda brevemente e pergunte como pode ajudar com o veículo.\n` +
      `Se for assunto completamente fora do tema, responda: ` +
      `'Olá! Sou a assistente da ${tenant.nome} e só posso ajudar com assuntos sobre seu veículo. 😊'\n` +
      `Sempre incentive visita à oficina quando relevante.\n` +
      `Máximo 4 linhas. Tom: amigável e prestativo.`;

    try {
      const aiReply = await this.ai.chat([{ role: 'user', content: prompt }]);
      await this.sendMessage(tenant.id, rawPhone, aiReply.trim());
    } catch (err) {
      this.logger.error(`AI reply error: ${err.message}`);
    }

    return { status: 'replied' };
  }

  // ── Webhook (legacy) ────────────────────────────────────────────────────────

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
      vehicle: { brand: string; model: string; year?: number | null };
    },
    newStatus: string,
  ) {
    const firstName = order.customer.name.split(' ')[0];
    const vehicle = `${order.vehicle.brand} ${order.vehicle.model}`.trim();
    const trackingLink = `https://track.nexora360.cloud/tracking/${order.trackingToken}`;
    const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
    const totalValue = order.totalValue || order.laborValue + order.partsValue;

    let message: string;

    switch (newStatus) {
      case 'received':
        message =
          `Olá *${firstName}*! Sua OS foi aberta para o *${vehicle}*. 🚗\n` +
          `Acompanhe em tempo real:\n👉 ${trackingLink}`;
        break;

      case 'diagnosis': {
        const aiMessage = await this.generateDiagnosisMessage(
          order.tenantId,
          firstName,
          order.vehicle.brand,
          order.vehicle.model,
          order.vehicle.year ?? null,
          order.diagnosis ?? null,
          trackingLink,
        );
        message = aiMessage;
        break;
      }

      case 'waiting_approval':
        message =
          `💰 *Orçamento pronto* para seu *${vehicle}*!\n\n` +
          `🔧 Mão de obra: *${brl(order.laborValue)}*\n` +
          `🔩 Peças: *${brl(order.partsValue)}*\n` +
          `💵 Total: *${brl(totalValue)}*\n\n` +
          `Acesse o link abaixo para aprovar o serviço:\n👉 ${trackingLink}`;
        break;

      case 'in_progress':
        message =
          `🔧 Ótima notícia! Seu *${vehicle}* está sendo reparado agora.\n` +
          `Você será avisado assim que estiver pronto!`;
        break;

      case 'testing':
        message =
          `⚙️ Seu *${vehicle}* está em fase de testes. Quase pronto!\n` +
          `Em breve você poderá buscá-lo.`;
        break;

      case 'ready':
        message =
          `✅ Seu *${vehicle}* está *PRONTO* para retirada!\n\n` +
          `Aguardamos você na oficina. 😊\n` +
          `Acompanhe: ${trackingLink}`;
        break;

      case 'delivered':
        message =
          `Obrigado pela confiança, *${firstName}*! 🙏\n\n` +
          `Seu *${vehicle}* foi entregue. Volte sempre! 🔧\n\n` +
          `Como foi sua experiência? Responda com uma nota de *1 a 5*.`;
        break;

      case 'cancelled':
        message =
          `Sua ordem de serviço para o *${vehicle}* foi cancelada.\n` +
          `Em caso de dúvidas, entre em contato com nossa equipe.`;
        break;

      case 'rejected':
        message =
          `Entendemos, *${firstName}*. O orçamento para o *${vehicle}* foi recusado.\n` +
          `Entre em contato conosco caso queira discutir outras opções.`;
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

  private async generateDiagnosisMessage(
    tenantId: string,
    clienteNome: string,
    marca: string,
    modelo: string,
    ano: number | null,
    diagnosis: string | null,
    trackingLink: string,
  ): Promise<string> {
    const fallback =
      `🔍 Olá *${clienteNome}*! Diagnosticamos seu *${marca} ${modelo}*.\n` +
      `Em breve você receberá o orçamento detalhado.\n` +
      `Acompanhe: ${trackingLink}`;

    if (!diagnosis) return fallback;

    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { nome: true },
      });
      const oficinaNome = tenant?.nome ?? 'nossa oficina';
      const anoStr = ano ? ` ${ano}` : '';

      const prompt =
        `Você é a assistente virtual de uma oficina mecânica chamada ${oficinaNome}.\n` +
        `Escreva uma mensagem de WhatsApp para o cliente ${clienteNome} sobre o diagnóstico ` +
        `do veículo ${marca} ${modelo}${anoStr}.\n` +
        `O mecânico descreveu o diagnóstico como: ${diagnosis}\n` +
        `A mensagem deve:\n` +
        `- Cumprimentar pelo nome\n` +
        `- Explicar o problema de forma simples (sem jargão técnico excessivo)\n` +
        `- Criar urgência real (segurança, evitar dano maior, custo maior depois)\n` +
        `- Terminar convidando a aprovar o orçamento com o link: ${trackingLink}\n` +
        `- Máximo 5 linhas\n` +
        `- Usar 1-2 emojis relevantes\n` +
        `- Tom: prestativo, honesto, sem ser agressivo\n` +
        `Responda APENAS com a mensagem, sem explicações.`;

      const content = await this.ai.chat(
        [{ role: 'user', content: prompt }],
      );
      return content.trim() || fallback;
    } catch (err) {
      this.logger.error(`Erro ao gerar mensagem de diagnóstico via IA: ${err.message}`);
      return fallback;
    }
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
