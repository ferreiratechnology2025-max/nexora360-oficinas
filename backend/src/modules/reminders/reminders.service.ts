import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { MessageThrottleService } from '../message-throttle/message-throttle.service';
import { MessageType } from '@prisma/client';

export interface UpdateReminderConfigDto {
  days180Enabled?: boolean;
  days365Enabled?: boolean;
  days180Message?: string;
  days365Message?: string;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
    private throttle: MessageThrottleService,
  ) {}

  // ─── CRON: diário às 8h ───────────────────────────────────
  @Cron('0 8 * * *', { name: 'reminders-cron' })
  async runReminders() {
    this.logger.log('Iniciando CRON de lembretes...');

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        await this.processForTenant(tenant.id);
      } catch (err) {
        this.logger.error(`Erro nos lembretes do tenant ${tenant.id}: ${err.message}`);
      }
    }

    this.logger.log('CRON de lembretes concluído.');
  }

  async processForTenant(tenantId: string): Promise<void> {
    const config = await this.getOrCreateConfig(tenantId);
    const now = new Date();

    const processWindow = async (targetDays: number, enabled: boolean, customMessage?: string | null) => {
      if (!enabled) return;

      const from = new Date(now.getTime() - (targetDays + 1) * 24 * 60 * 60 * 1000);
      const to = new Date(now.getTime() - targetDays * 24 * 60 * 60 * 1000);

      const orders = await this.prisma.order.findMany({
        where: {
          tenantId,
          status: 'delivered',
          deliveredAt: { gte: from, lt: to },
        },
        include: {
          customer: true,
          vehicle: true,
        },
      });

      for (const order of orders) {
        // Não enviar se cliente tem OS aberta
        const openOrder = await this.prisma.order.findFirst({
          where: {
            tenantId,
            customerId: order.customerId,
            status: { notIn: ['delivered', 'cancelled'] },
          },
        });
        if (openOrder) continue;

        const allowed = await this.throttle.canSend(order.customerId, tenantId, MessageType.reminder);
        if (!allowed.allowed) continue;

        const firstName = order.customer.name.split(' ')[0];
        const vehicle = `${order.vehicle.brand} ${order.vehicle.model}`.trim();

        let message: string;
        if (customMessage) {
          message = customMessage
            .replace('{nome}', firstName)
            .replace('{veiculo}', vehicle)
            .replace('{dias}', String(targetDays));
        } else if (targetDays === 180) {
          message = `Olá ${firstName}! Já faz 6 meses desde a última revisão do seu ${vehicle}. Agende agora e mantenha seu veículo em dia!`;
        } else {
          message = `Olá ${firstName}! Revisão anual do seu ${vehicle} está próxima. Garanta sua segurança — agende já!`;
        }

        try {
          await this.whatsapp.sendMessage(tenantId, order.customer.phone, message);
          await this.throttle.record(order.customerId, tenantId, order.customer.phone, MessageType.reminder, message);
          this.logger.log(`Lembrete ${targetDays}d enviado para customer ${order.customerId}`);
        } catch (err) {
          this.logger.error(`Falha ao enviar lembrete para customer ${order.customerId}: ${err.message}`);
        }
      }
    };

    await processWindow(180, config.days180Enabled, config.days180Message);
    await processWindow(365, config.days365Enabled, config.days365Message);
  }

  // ─── API ─────────────────────────────────────────────────

  async getConfig(tenantId: string) {
    return this.getOrCreateConfig(tenantId);
  }

  async updateConfig(tenantId: string, dto: UpdateReminderConfigDto) {
    const existing = await this.prisma.reminderConfig.findUnique({ where: { tenantId } });

    if (!existing) {
      return this.prisma.reminderConfig.create({
        data: { tenantId, ...dto },
      });
    }

    return this.prisma.reminderConfig.update({
      where: { tenantId },
      data: dto,
    });
  }

  private async getOrCreateConfig(tenantId: string) {
    const config = await this.prisma.reminderConfig.findUnique({ where: { tenantId } });
    if (config) return config;

    return this.prisma.reminderConfig.create({
      data: { tenantId },
    });
  }
}
