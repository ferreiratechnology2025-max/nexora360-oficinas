import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { MessageThrottleService } from '../message-throttle/message-throttle.service';
import { MessageType } from '@prisma/client';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
    private throttle: MessageThrottleService,
  ) {}

  // ─── CRON: a cada hora ────────────────────────────────────
  @Cron('30 * * * *', { name: 'reviews-cron' })
  async runReviewRequests() {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        await this.processForTenant(tenant.id);
      } catch (err) {
        this.logger.error(`Erro nos reviews do tenant ${tenant.id}: ${err.message}`);
      }
    }
  }

  async processForTenant(tenantId: string): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25h atrás
    const to = new Date(now.getTime() - 23 * 60 * 60 * 1000);   // 23h atrás (janela de 24h ±1h)

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: 'delivered',
        deliveredAt: { gte: from, lt: to },
        review: null, // ainda sem review
      },
      include: { customer: true, vehicle: true },
    });

    for (const order of orders) {
      const allowed = await this.throttle.canSend(order.customerId, tenantId, MessageType.review);
      if (!allowed.allowed) continue;

      const firstName = order.customer.name.split(' ')[0];
      const vehicle = `${order.vehicle.brand} ${order.vehicle.model}`.trim();
      const message = `Como foi sua experiência na oficina, ${firstName}? Seu ${vehicle} foi entregue ontem. Responda com uma nota de *1 a 5* ⭐`;

      try {
        await this.whatsapp.sendMessage(tenantId, order.customer.phone, message);
        await this.throttle.record(order.customerId, tenantId, order.customer.phone, MessageType.review, message);
        this.logger.log(`Pedido de review enviado para customer ${order.customerId}, order ${order.id}`);
      } catch (err) {
        this.logger.error(`Falha ao enviar review request para order ${order.id}: ${err.message}`);
      }
    }
  }

  /**
   * Salva resposta de review recebida via WhatsApp.
   * Chamado pelo webhook handler quando mensagem é recebida.
   */
  async saveReview(tenantId: string, phone: string, rawMessage: string): Promise<boolean> {
    const rating = this.parseRating(rawMessage);
    if (rating === null) return false;

    // Encontra o cliente pelo telefone
    const customer = await this.prisma.customer.findFirst({
      where: { tenantId, phone },
    });
    if (!customer) return false;

    // Encontra a OS entregue mais recente que ainda não tem review
    const order = await this.prisma.order.findFirst({
      where: {
        tenantId,
        customerId: customer.id,
        status: 'delivered',
        review: null,
      },
      orderBy: { deliveredAt: 'desc' },
    });
    if (!order) return false;

    await this.prisma.review.create({
      data: {
        tenantId,
        orderId: order.id,
        customerId: customer.id,
        rating,
        comment: rawMessage.trim(),
      },
    });

    this.logger.log(`Review ${rating}/5 salvo para order ${order.id}`);
    return true;
  }

  private parseRating(message: string): number | null {
    const trimmed = message.trim();
    // Aceita "1", "2", "3", "4", "5" ou variações com espaço/emoji
    const match = trimmed.match(/^[1-5]/);
    if (!match) return null;
    const n = parseInt(match[0], 10);
    return n >= 1 && n <= 5 ? n : null;
  }

  // ─── API ─────────────────────────────────────────────────

  async findAll(tenantId: string) {
    return this.prisma.review.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        order: { select: { id: true, orderNumber: true, deliveredAt: true } },
      },
    });
  }

  async getStats(tenantId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { tenantId },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return { totalReviews: 0, averageRating: 0, npsApproximate: 0, distribution: {} };
    }

    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = sum / total;

    // NPS aproximado: promotores (5) - detratores (1-2) em %
    const promoters = reviews.filter((r) => r.rating === 5).length;
    const detractors = reviews.filter((r) => r.rating <= 2).length;
    const nps = Math.round(((promoters - detractors) / total) * 100);

    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const r of reviews) {
      distribution[String(r.rating)]++;
    }

    return {
      totalReviews: total,
      averageRating: parseFloat(avg.toFixed(2)),
      npsApproximate: nps,
      distribution,
    };
  }
}
