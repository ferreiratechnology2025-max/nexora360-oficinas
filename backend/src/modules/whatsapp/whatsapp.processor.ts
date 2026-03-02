import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

export const WHATSAPP_QUEUE = 'whatsapp';

export interface SendMessageJob {
  tenantId: string;
  phone: string;
  message: string;
}

@Processor(WHATSAPP_QUEUE)
export class WhatsAppProcessor {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  @Process('send-message')
  async handleSendMessage(job: Job<SendMessageJob>) {
    const { tenantId, phone, message } = job.data;
    this.logger.log(`Processing send-message job for ${phone} (tenant: ${tenantId})`);

    const response = await fetch(
      `https://wa-meserver.p.rapidapi.com/sendText?number=${phone}&text=${encodeURIComponent(message)}`,
      {
        method: 'POST',
        headers: {
          'x-rapidapi-key': process.env.WHATSAPP_API_KEY || '',
          'x-rapidapi-host': 'wa-meserver.p.rapidapi.com',
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      this.logger.error('WhatsApp API error', err);
      throw new Error(`WhatsApp API error: ${response.statusText}`);
    }

    this.logger.log(`Message sent to ${phone}`);
    return { success: true };
  }
}
