import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AiService } from '../../ai/ai.service';
import { MessageThrottleService } from '../message-throttle/message-throttle.service';
import { MessageType } from '@prisma/client';

@Injectable()
export class UpsellService {
  private readonly logger = new Logger(UpsellService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
    private ai: AiService,
    private throttle: MessageThrottleService,
  ) {}

  // ─── CRON: semanal, segunda-feira às 10h ──────────────────
  @Cron('0 10 * * 1', { name: 'upsell-cron' })
  async runUpsell() {
    this.logger.log('Iniciando CRON de upsell...');

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        await this.processForTenant(tenant.id);
      } catch (err) {
        this.logger.error(`Erro no upsell do tenant ${tenant.id}: ${err.message}`);
      }
    }

    this.logger.log('CRON de upsell concluído.');
  }

  async processForTenant(tenantId: string): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: 'delivered',
        deliveredAt: { gte: thirtyDaysAgo },
      },
      include: {
        customer: true,
        vehicle: true,
      },
    });

    for (const order of recentOrders) {
      const allowed = await this.throttle.canSend(order.customerId, tenantId, MessageType.upsell);
      if (!allowed.allowed) continue;

      // Evitar enviar se já houve reactivation ou upsell recente (30 dias)
      const recentMsg = await this.prisma.messageLog.findFirst({
        where: {
          customerId: order.customerId,
          tenantId,
          type: { in: [MessageType.reactivation, MessageType.upsell] },
          sentAt: { gte: thirtyDaysAgo },
        },
      });
      if (recentMsg) continue;

      const firstName = order.customer.name.split(' ')[0];
      const vehicle = `${order.vehicle.brand} ${order.vehicle.model}`.trim();
      const daysSince = order.deliveredAt
        ? Math.floor((Date.now() - order.deliveredAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Histórico do veículo (últimas 3 OS)
      const history = await this.prisma.order.findMany({
        where: { tenantId, vehicleId: order.vehicleId, status: 'delivered' },
        orderBy: { deliveredAt: 'desc' },
        take: 3,
        select: { problemDescription: true, diagnosis: true, deliveredAt: true },
      });

      const historyText = history
        .map((h, i) => `OS ${i + 1}: ${h.problemDescription || h.diagnosis || 'serviço geral'}`)
        .join('; ');

      let suggestion: string;
      try {
        suggestion = await this.ai.chat([
          {
            role: 'system',
            content:
              'Você é um especialista em manutenção automotiva. Com base no histórico de serviços do veículo, ' +
              'sugira o próximo serviço mais provável de ser necessário. Seja específico e útil. ' +
              'Responda apenas com a sugestão em 1 frase curta.',
          },
          {
            role: 'user',
            content: `Veículo: ${vehicle}. Histórico: ${historyText}. Último serviço: ${daysSince} dias atrás.`,
          },
        ]);
      } catch (err) {
        this.logger.warn(`IA falhou no upsell para customer ${order.customerId}: ${err.message}`);
        suggestion = `revisão preventiva após ${daysSince} dias do último serviço`;
      }

      const message = `Olá ${firstName}! Seu ${vehicle} fez serviço há ${daysSince} dias. Com base no uso, sugerimos: ${suggestion} Agende agora!`;

      try {
        await this.prisma.upsellSuggestion.create({
          data: {
            tenantId,
            customerId: order.customerId,
            orderId: order.id,
            suggestion,
          },
        });

        await this.whatsapp.sendMessage(tenantId, order.customer.phone, message);
        await this.throttle.record(order.customerId, tenantId, order.customer.phone, MessageType.upsell, message);

        await this.prisma.upsellSuggestion.updateMany({
          where: { tenantId, customerId: order.customerId, orderId: order.id, sent: false },
          data: { sent: true, sentAt: new Date() },
        });

        this.logger.log(`Upsell enviado para customer ${order.customerId}`);
      } catch (err) {
        this.logger.error(`Falha ao enviar upsell para customer ${order.customerId}: ${err.message}`);
      }
    }
  }

  // ─── API ─────────────────────────────────────────────────

  async getSuggestions(tenantId: string) {
    return this.prisma.upsellSuggestion.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        order: { select: { id: true, orderNumber: true, deliveredAt: true } },
      },
    });
  }

  async getStats(tenantId: string) {
    // Marca sugestões convertidas: cliente fez nova OS após receber a sugestão
    await this.markConverted(tenantId);

    const total = await this.prisma.upsellSuggestion.count({ where: { tenantId, sent: true } });
    const converted = await this.prisma.upsellSuggestion.count({ where: { tenantId, converted: true } });

    return {
      totalSuggestions: total,
      totalConverted: converted,
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) + '%' : '0%',
    };
  }

  private async markConverted(tenantId: string) {
    const sentSuggestions = await this.prisma.upsellSuggestion.findMany({
      where: { tenantId, sent: true, converted: false },
      select: { id: true, customerId: true, sentAt: true },
    });

    for (const suggestion of sentSuggestions) {
      if (!suggestion.sentAt) continue;

      const newOrder = await this.prisma.order.findFirst({
        where: {
          tenantId,
          customerId: suggestion.customerId,
          createdAt: { gt: suggestion.sentAt },
        },
      });

      if (newOrder) {
        await this.prisma.upsellSuggestion.update({
          where: { id: suggestion.id },
          data: { converted: true },
        });
      }
    }
  }
}
