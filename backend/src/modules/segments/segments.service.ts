import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SegmentType } from '@prisma/client';

@Injectable()
export class SegmentsService {
  private readonly logger = new Logger(SegmentsService.name);

  constructor(private prisma: PrismaService) {}

  // ─── CRON: recalcula segmentos diariamente às 2h ──────────
  @Cron('0 2 * * *', { name: 'recalculate-segments' })
  async recalculateAllTenants() {
    this.logger.log('Iniciando recálculo de segmentos...');
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        await this.recalculateForTenant(tenant.id);
      } catch (err) {
        this.logger.error(`Erro ao recalcular segmentos do tenant ${tenant.id}: ${err.message}`);
      }
    }
    this.logger.log('Recálculo de segmentos concluído.');
  }

  async recalculateForTenant(tenantId: string): Promise<void> {
    const now = new Date();
    const customers = await this.prisma.customer.findMany({
      where: { tenantId, isActive: true },
      include: {
        orders: {
          where: { tenantId, status: 'delivered' },
          orderBy: { deliveredAt: 'desc' },
          select: { deliveredAt: true, totalValue: true, createdAt: true },
        },
      },
    });

    // Remove segmentos antigos do tenant
    await this.prisma.customerSegment.deleteMany({ where: { tenantId } });

    const newSegments: { customerId: string; tenantId: string; segment: SegmentType }[] = [];

    for (const customer of customers) {
      const segments = this.calculateSegments(customer, now);
      for (const segment of segments) {
        newSegments.push({ customerId: customer.id, tenantId, segment });
      }
    }

    if (newSegments.length > 0) {
      await this.prisma.customerSegment.createMany({ data: newSegments, skipDuplicates: true });
    }

    this.logger.debug(`Tenant ${tenantId}: ${newSegments.length} segmentos recalculados`);
  }

  private calculateSegments(
    customer: { id: string; createdAt: Date; orders: { deliveredAt: Date | null; totalValue: number; createdAt: Date }[] },
    now: Date,
  ): SegmentType[] {
    const segments: SegmentType[] = [];
    const deliveredOrders = customer.orders.filter((o) => o.deliveredAt);
    const lastOrder = deliveredOrders[0];
    const lastDeliveredAt = lastOrder?.deliveredAt ?? null;

    const daysSinceLastOrder = lastDeliveredAt
      ? Math.floor((now.getTime() - lastDeliveredAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // NEW: primeira OS há menos de 30 dias
    const firstOrderDate = customer.orders.length > 0
      ? customer.orders[customer.orders.length - 1].createdAt
      : null;
    if (firstOrderDate) {
      const daysSinceFirst = Math.floor((now.getTime() - firstOrderDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceFirst < 30) {
        segments.push(SegmentType.NEW);
      }
    }

    if (daysSinceLastOrder !== null) {
      // FREQUENT: OS nos últimos 60 dias
      if (daysSinceLastOrder <= 60) {
        segments.push(SegmentType.FREQUENT);
      }
      // INACTIVE_30: sem OS há 30-60 dias
      if (daysSinceLastOrder > 30 && daysSinceLastOrder <= 60) {
        segments.push(SegmentType.INACTIVE_30);
      }
      // INACTIVE_60: sem OS há 60-90 dias
      if (daysSinceLastOrder > 60 && daysSinceLastOrder <= 90) {
        segments.push(SegmentType.INACTIVE_60);
      }
      // INACTIVE_90: sem OS há mais de 90 dias
      if (daysSinceLastOrder > 90) {
        segments.push(SegmentType.INACTIVE_90);
      }
    }

    // HIGH_VALUE: ticket médio acima de R$800
    if (deliveredOrders.length > 0) {
      const avgTicket = deliveredOrders.reduce((sum, o) => sum + o.totalValue, 0) / deliveredOrders.length;
      if (avgTicket > 800) {
        segments.push(SegmentType.HIGH_VALUE);
      }
    }

    return segments;
  }

  // ─── API: GET /segments ───────────────────────────────────

  async getSegmentCounts(tenantId: string) {
    const counts = await this.prisma.customerSegment.groupBy({
      by: ['segment'],
      where: { tenantId },
      _count: { segment: true },
    });

    const result: Record<string, number> = {};
    for (const segment of Object.values(SegmentType)) {
      result[segment] = 0;
    }
    for (const row of counts) {
      result[row.segment] = row._count.segment;
    }
    return result;
  }

  // ─── API: GET /segments/:segment/customers ────────────────

  async getCustomersBySegment(tenantId: string, segment: SegmentType) {
    const rows = await this.prisma.customerSegment.findMany({
      where: { tenantId, segment },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            orders: {
              where: { status: 'delivered' },
              orderBy: { deliveredAt: 'desc' },
              take: 1,
              select: { deliveredAt: true, totalValue: true },
            },
          },
        },
      },
    });

    return rows.map((r) => ({
      ...r.customer,
      segment,
      lastOrder: r.customer.orders[0] ?? null,
    }));
  }
}
