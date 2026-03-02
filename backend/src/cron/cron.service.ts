import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../modules/prisma/prisma.service';
import { OrderStatus } from '../modules/orders/enums/order-status.enum';
import { TrialGuardService } from '../modules/trial-guard/trial-guard.service';
import { BillingService } from '../modules/billing/billing.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    private trialGuard: TrialGuardService,
    private billing: BillingService,
  ) {}

  // ─── Hourly ──────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCron() {
    this.logger.log('Hourly cron...');
    await Promise.all([
      this.updateStaleOrders(),
      this.trialGuard.suspendExpiredTrials(),
      this.billing.suspendOverdueSubscriptions(),
    ]);
  }

  // ─── Daily ───────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCron() {
    this.logger.log('Daily cron...');
    await Promise.all([
      this.sendOrderReminders(),
      this.trialGuard.sendDay5Warnings(),
      this.billing.sendPastDueWarnings(),
    ]);
  }

  // ─── Weekly ──────────────────────────────────────────────

  @Cron(CronExpression.EVERY_WEEK)
  async handleWeeklyCron() {
    this.logger.log('Weekly cron...');
    await this.generateWeeklyReports();
  }

  // ─── Helpers ─────────────────────────────────────────────

  private async updateStaleOrders() {
    const staleOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.received,
        createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    for (const order of staleOrders) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.diagnosis },
      });
    }
    if (staleOrders.length) {
      this.logger.log(`${staleOrders.length} ordem(s) movida(s) para diagnosis`);
    }
  }

  private async sendOrderReminders() {
    const pastDue = await this.prisma.order.findMany({
      where: {
        status: { not: OrderStatus.delivered },
        estimatedCompletion: { lte: new Date() },
      },
      include: { customer: true },
    });
    for (const order of pastDue) {
      this.logger.log(`OS ${order.trackingToken} vencida — cliente ${order.customer.name}`);
    }
  }

  private async generateWeeklyReports() {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [weeklyOrders, weeklyRevenue] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: lastWeek } } }),
      this.prisma.order.aggregate({
        _sum: { totalValue: true },
        where: { createdAt: { gte: lastWeek }, status: OrderStatus.delivered },
      }),
    ]);
    this.logger.log(
      `Weekly: ${weeklyOrders} OS | R$${weeklyRevenue._sum?.totalValue ?? 0} receita`,
    );
  }
}
