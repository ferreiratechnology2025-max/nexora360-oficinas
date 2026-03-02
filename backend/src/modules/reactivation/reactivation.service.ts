import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AiService } from '../../ai/ai.service';
import { MessageThrottleService } from '../message-throttle/message-throttle.service';
import { MessageType, SegmentType } from '@prisma/client';

@Injectable()
export class ReactivationService {
  private readonly logger = new Logger(ReactivationService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
    private ai: AiService,
    private throttle: MessageThrottleService,
  ) {}

  // ─── CRON: diário às 9h ───────────────────────────────────
  @Cron('0 9 * * *', { name: 'reactivation-cron' })
  async runReactivation() {
    this.logger.log('Iniciando CRON de reativação...');

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        await this.processForTenant(tenant.id);
      } catch (err) {
        this.logger.error(`Erro na reativação do tenant ${tenant.id}: ${err.message}`);
      }
    }

    this.logger.log('CRON de reativação concluído.');
  }

  async processForTenant(tenantId: string): Promise<void> {
    // Busca clientes nos segmentos INACTIVE_60 e INACTIVE_90
    const segments = await this.prisma.customerSegment.findMany({
      where: {
        tenantId,
        segment: { in: [SegmentType.INACTIVE_60, SegmentType.INACTIVE_90] },
      },
      include: {
        customer: {
          include: {
            orders: {
              where: { tenantId, status: 'delivered' },
              orderBy: { deliveredAt: 'desc' },
              take: 1,
              include: { vehicle: true },
            },
          },
        },
      },
    });

    for (const seg of segments) {
      const customer = seg.customer;
      const lastOrder = customer.orders[0];
      if (!lastOrder?.vehicle) continue;

      const allowed = await this.throttle.canSend(customer.id, tenantId, MessageType.reactivation);
      if (!allowed.allowed) continue;

      const firstName = customer.name.split(' ')[0];
      const vehicle = `${lastOrder.vehicle.brand} ${lastOrder.vehicle.model}`.trim();
      const daysSince = lastOrder.deliveredAt
        ? Math.floor((Date.now() - lastOrder.deliveredAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const lastServiceDesc = lastOrder.vehicle
        ? `Veículo: ${vehicle}. Tipo de serviço: revisão geral (${daysSince} dias atrás).`
        : '';

      let message: string;
      try {
        message = await this.ai.chat([
          {
            role: 'system',
            content:
              'Você é um assistente de uma oficina mecânica. Gere uma mensagem personalizada e amigável de reativação para um cliente que está inativo. ' +
              'Seja conciso (máx 2 frases). Use o nome do cliente e detalhes do veículo. Não use emojis em excesso.',
          },
          {
            role: 'user',
            content: `Cliente: ${firstName}. ${lastServiceDesc} Inativo há ${daysSince} dias. Gere a mensagem de reativação.`,
          },
        ]);
      } catch (err) {
        this.logger.warn(`IA falhou para customer ${customer.id}: ${err.message}`);
        message = `Olá ${firstName}! Seu ${vehicle} fez a última revisão há ${daysSince} dias. Que tal agendar uma revisão? Estamos à disposição!`;
      }

      try {
        await this.whatsapp.sendMessage(tenantId, customer.phone, message);
        await this.throttle.record(customer.id, tenantId, customer.phone, MessageType.reactivation, message);

        await this.prisma.reactivationLog.create({
          data: { tenantId, customerId: customer.id, message },
        });

        this.logger.log(`Reativação enviada para customer ${customer.id}`);
      } catch (err) {
        this.logger.error(`Falha ao enviar reativação para customer ${customer.id}: ${err.message}`);
      }
    }
  }

  // ─── API ─────────────────────────────────────────────────

  async getHistory(tenantId: string) {
    return this.prisma.reactivationLog.findMany({
      where: { tenantId },
      orderBy: { sentAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
  }

  async getStats(tenantId: string) {
    const total = await this.prisma.reactivationLog.count({ where: { tenantId } });
    const reactivated = await this.prisma.reactivationLog.count({
      where: { tenantId, reactivated: true },
    });

    // Marca clientes como reativados se fizeram nova OS após o log
    await this.markReactivated(tenantId);

    return {
      totalSent: total,
      totalReactivated: reactivated,
      conversionRate: total > 0 ? ((reactivated / total) * 100).toFixed(1) + '%' : '0%',
    };
  }

  private async markReactivated(tenantId: string) {
    const pendingLogs = await this.prisma.reactivationLog.findMany({
      where: { tenantId, reactivated: false },
      select: { id: true, customerId: true, sentAt: true },
    });

    for (const log of pendingLogs) {
      const newOrder = await this.prisma.order.findFirst({
        where: {
          tenantId,
          customerId: log.customerId,
          createdAt: { gt: log.sentAt },
        },
      });

      if (newOrder) {
        await this.prisma.reactivationLog.update({
          where: { id: log.id },
          data: { reactivated: true, reactivatedAt: newOrder.createdAt },
        });
      }
    }
  }
}
