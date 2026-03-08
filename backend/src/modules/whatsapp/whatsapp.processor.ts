import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

export const WHATSAPP_QUEUE = 'whatsapp';

export interface SendMessageJob {
  tenantId: string;
  phone: string;
  message: string;
}

@Processor(WHATSAPP_QUEUE)
export class WhatsAppProcessor {
  private readonly logger = new Logger(WhatsAppProcessor.name);
  private readonly apiUrl: string;

  constructor(private prisma: PrismaService) {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://nexora360.uazapi.com';
  }

  @Process('send-message')
  async handleSendMessage(job: Job<SendMessageJob>) {
    const { tenantId, phone, message } = job.data;
    const digits = phone.replace(/\D/g, '');
    const withoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;
    const formattedPhone = '55' + withoutCountry;
    this.logger.log(`Processing send-message job for ${formattedPhone} (tenant: ${tenantId})`);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { whatsappInstanceToken: true },
    });

    if (!tenant?.whatsappInstanceToken) {
      this.logger.warn(`Tenant ${tenantId} sem instanceToken — mensagem descartada para ${phone}`);
      return { skipped: true, reason: 'no_instance_token' };
    }

    const response = await fetch(`${this.apiUrl}/send/text`, {
      method: 'POST',
      headers: {
        'token': tenant.whatsappInstanceToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number: formattedPhone, text: message }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      this.logger.error(`Uazapi /send/text error for ${formattedPhone}`, err);
      throw new Error(`Uazapi sendText error: ${response.status} — ${JSON.stringify(err)}`);
    }

    this.logger.log(`Message sent to ${formattedPhone} via Uazapi`);
    return { success: true };
  }
}
