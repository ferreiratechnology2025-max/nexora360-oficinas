import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrialGuardService } from '../trial-guard/trial-guard.service';
import { BillingService } from '../billing/billing.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailsService } from '../emails/emails.service';
import { AdminActionType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private trialGuard: TrialGuardService,
    private billing: BillingService,
    private whatsapp: WhatsAppService,
    private emails: EmailsService,
  ) {}

  // ─── Admin Log ───────────────────────────────────────────

  async logAction(
    adminId: string,
    action: AdminActionType,
    targetId?: string,
    targetType?: string,
    details?: object,
  ) {
    await this.prisma.adminLog.create({
      data: { adminId, action, targetId, targetType, details },
    }).catch(() => {});
  }

  async getLogs(limit = 200) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.prisma.adminLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Trials ──────────────────────────────────────────────

  async getPendingTrials() {
    const now = new Date();
    const tenants = await this.prisma.tenant.findMany({
      where: { trialStatus: 'pending_approval' },
      select: {
        id: true,
        nome: true,
        email: true,
        cnpj: true,
        phone: true,
        whatsappInstance: true,
        registrationIp: true,
        status: true,
        trialStatus: true,
        createdAt: true,
        plan: { select: { name: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return tenants.map((t) => ({
      ...t,
      waitingHours: Math.round((now.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)),
    }));
  }

  async approveTrial(tenantId: string, adminId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (tenant.trialStatus !== 'pending_approval') {
      throw new NotFoundException('Tenant não possui trial pendente');
    }
    const result = await this.trialGuard.approveTrial(tenantId);
    await this.logAction(adminId, AdminActionType.approve_trial, tenantId, 'Tenant', { nome: tenant.nome });
    return { message: 'Trial aprovado', tenantId, ...result };
  }

  async rejectTrial(tenantId: string, reason: string, adminId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    await this.trialGuard.rejectTrial(tenantId, reason);
    await this.logAction(adminId, AdminActionType.reject_trial, tenantId, 'Tenant', { reason });
    return { message: 'Trial rejeitado', tenantId };
  }

  // ─── Tenants ─────────────────────────────────────────────

  async getAllTenants(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          nome: true,
          email: true,
          cnpj: true,
          phone: true,
          status: true,
          trialStatus: true,
          trialEndsAt: true,
          isActive: true,
          plano: true,
          lastLoginAt: true,
          mensagensUsadas: true,
          limiteMensagens: true,
          createdAt: true,
          plan: { select: { displayName: true, priceMonthly: true } },
          subscriptions: {
            where: { status: 'active' },
            take: 1,
            select: { status: true, currentPeriodEnd: true },
          },
          _count: {
            select: { orders: true, customers: true, users: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count(),
    ]);

    const enriched = tenants.map((t) => {
      const health = this.computeHealth(t, thirtyDaysAgo);
      const messageUsagePct = t.limiteMensagens > 0 ? (t.mensagensUsadas / t.limiteMensagens) * 100 : 0;

      return {
        ...t,
        health,
        messageUsagePct: parseFloat(messageUsagePct.toFixed(1)),
        totalOrders: t._count.orders,
        totalCustomers: t._count.customers,
        totalUsers: t._count.users,
        monthlyPrice: t.plan?.priceMonthly ?? 0,
        nextBillingDate: t.subscriptions[0]?.currentPeriodEnd ?? null,
      };
    });

    return { tenants: enriched, total, page, limit };
  }

  async getTenantProfile(tenantId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        subscriptions: { orderBy: { createdAt: 'desc' }, include: { plan: true } },
        paymentHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { orders: true, customers: true, users: true } },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const [ordersThisMonth, whatsappThisMonth, reactivationAiCalls, upsellAiCalls] = await Promise.all([
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      this.prisma.whatsAppMessage.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      this.prisma.reactivationLog.count({ where: { tenantId, sentAt: { gte: startOfMonth } } }),
      this.prisma.upsellSuggestion.count({ where: { tenantId, sent: true, sentAt: { gte: startOfMonth } } }),
    ]);

    const health = this.computeHealth(
      {
        status: tenant.status,
        isActive: tenant.isActive,
        lastLoginAt: tenant.lastLoginAt,
        mensagensUsadas: tenant.mensagensUsadas,
        limiteMensagens: tenant.limiteMensagens,
      },
      thirtyDaysAgo,
    );

    return {
      ...tenant,
      health,
      usage: {
        ordersThisMonth,
        whatsappThisMonth,
        aiCallsThisMonth: reactivationAiCalls + upsellAiCalls,
      },
    };
  }

  private computeHealth(
    tenant: { status: any; isActive: boolean; lastLoginAt?: Date | null; mensagensUsadas: number; limiteMensagens: number },
    thirtyDaysAgo: Date,
  ): 'healthy' | 'at_risk' | 'churned' {
    if (!tenant.isActive || tenant.status === 'suspended') return 'churned';
    const messageUsagePct = tenant.limiteMensagens > 0 ? (tenant.mensagensUsadas / tenant.limiteMensagens) * 100 : 0;
    const lastActive = tenant.lastLoginAt;
    const isInactive = !lastActive || lastActive < thirtyDaysAgo;
    if (isInactive || messageUsagePct >= 80) return 'at_risk';
    return 'healthy';
  }

  async blockTenant(tenantId: string, adminId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'suspended', isActive: false },
    });
    await this.logAction(adminId, AdminActionType.block_tenant, tenantId, 'Tenant', { nome: tenant.nome });
    return { message: `Tenant ${tenant.nome} bloqueado` };
  }

  async unblockTenant(tenantId: string, adminId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    const hasSub = await this.prisma.subscription.findFirst({ where: { tenantId, status: 'active' } });
    const newStatus = hasSub ? 'active' : tenant.trialStatus === 'approved' ? 'trial' : 'active';
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: newStatus as any, isActive: true },
    });
    await this.logAction(adminId, AdminActionType.unblock_tenant, tenantId, 'Tenant', { nome: tenant.nome });
    return { message: `Tenant ${tenant.nome} desbloqueado`, newStatus };
  }

  async sendMessageToTenant(
    tenantId: string,
    type: 'whatsapp' | 'email',
    message: string,
    adminId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    if (type === 'whatsapp' && tenant.phone) {
      await this.whatsapp.sendMessage(tenantId, tenant.phone, message);
    } else if (type === 'email') {
      await this.emails.sendEmail(tenant.email, 'Mensagem da Nexora360', message);
    }

    await this.logAction(adminId, AdminActionType.send_message, tenantId, 'Tenant', {
      type,
      preview: message.substring(0, 100),
    });

    return { success: true, type, tenantId };
  }

  // ─── Métricas financeiras ─────────────────────────────────

  async getMetrics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(startOfMonth.getTime() - 1);

    const [
      totalTenants,
      active,
      trial,
      suspended,
      pendingApproval,
      activeSubscriptions,
      pastDueSubs,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.tenant.count({ where: { status: 'trial' } }),
      this.prisma.tenant.count({ where: { status: 'suspended' } }),
      this.prisma.tenant.count({ where: { trialStatus: 'pending_approval' } }),
      this.prisma.subscription.findMany({
        where: { status: 'active' },
        include: { plan: true },
      }),
      this.prisma.subscription.findMany({
        where: { status: 'past_due' },
        include: { tenant: true, plan: true },
      }),
    ]);

    // MRR atual
    const mrr = activeSubscriptions.reduce((sum, s) => sum + (s.plan?.priceMonthly ?? 0), 0);
    const arr = mrr * 12;

    // MRR por plano
    const mrrByPlan: Record<string, { count: number; revenue: number }> = {};
    for (const sub of activeSubscriptions) {
      const planName = sub.plan?.displayName ?? 'unknown';
      if (!mrrByPlan[planName]) mrrByPlan[planName] = { count: 0, revenue: 0 };
      mrrByPlan[planName].count++;
      mrrByPlan[planName].revenue += sub.plan?.priceMonthly ?? 0;
    }

    // MRR mês anterior
    const lastMonthSubs = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'cancelled'] },
        currentPeriodStart: { lte: endOfLastMonth },
        OR: [
          { currentPeriodEnd: { gte: startOfLastMonth } },
          { cancelledAt: { gte: startOfLastMonth } },
        ],
      },
      include: { plan: true },
    });
    const lastMonthMrr = lastMonthSubs.reduce((sum, s) => sum + (s.plan?.priceMonthly ?? 0), 0);
    const mrrGrowth =
      lastMonthMrr > 0
        ? parseFloat((((mrr - lastMonthMrr) / lastMonthMrr) * 100).toFixed(1))
        : mrr > 0
        ? 100
        : 0;

    // Churn do mês
    const churnedThisMonth = await this.prisma.subscription.count({
      where: { status: 'cancelled', cancelledAt: { gte: startOfMonth } },
    });
    const activeAtStartOfMonth = await this.prisma.subscription.count({
      where: {
        status: { in: ['active', 'cancelled', 'past_due'] },
        currentPeriodStart: { lt: startOfMonth },
      },
    });
    const churnRate =
      activeAtStartOfMonth > 0
        ? parseFloat(((churnedThisMonth / activeAtStartOfMonth) * 100).toFixed(1))
        : 0;

    // Novos assinantes este mês
    const newPaidThisMonth = await this.prisma.subscription.count({
      where: { status: 'active', currentPeriodStart: { gte: startOfMonth } },
    });
    const newTrialsThisMonth = await this.prisma.tenant.count({
      where: { trialStatus: 'approved', trialStartedAt: { gte: startOfMonth } },
    });
    const convertedFromTrial = await this.prisma.tenant.count({
      where: {
        status: 'active',
        trialStatus: 'approved',
        subscriptions: { some: { status: 'active', currentPeriodStart: { gte: startOfMonth } } },
      },
    });
    const trialConversionRate =
      newTrialsThisMonth > 0
        ? parseFloat(((convertedFromTrial / newTrialsThisMonth) * 100).toFixed(1))
        : 0;

    // Inadimplentes
    const overdue = pastDueSubs.map((s) => ({
      tenantId: s.tenantId,
      tenantName: s.tenant.nome,
      amount: s.plan?.priceMonthly ?? 0,
      daysOverdue: s.currentPeriodEnd
        ? Math.max(
            0,
            Math.floor((now.getTime() - s.currentPeriodEnd.getTime()) / (1000 * 60 * 60 * 24)),
          )
        : 0,
    }));
    const totalAtRisk = overdue.reduce((sum, o) => sum + o.amount, 0);

    // Trials pendentes
    const pendingTrials = await this.getPendingTrials();

    return {
      mrr,
      arr,
      mrrGrowth: `${mrrGrowth > 0 ? '+' : ''}${mrrGrowth}%`,
      lastMonthMrr,
      mrrByPlan,
      churn: { count: churnedThisMonth, rate: `${churnRate}%` },
      newSubscribers: {
        paid: newPaidThisMonth,
        trials: newTrialsThisMonth,
        trialConversionRate: `${trialConversionRate}%`,
      },
      totals: { totalTenants, active, trial, suspended, pendingApproval },
      activeSubscriptions: activeSubscriptions.length,
      overdue: { tenants: overdue, totalAtRisk },
      pendingTrials,
    };
  }

  // ─── Histórico de pagamentos ──────────────────────────────

  async getPayments(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.prisma.paymentHistory.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, nome: true, email: true } },
          plan: { select: { displayName: true } },
        },
      }),
      this.prisma.paymentHistory.count(),
    ]);
    return { payments, total, page, limit };
  }

  async getTenantPayments(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    return this.prisma.paymentHistory.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { displayName: true } } },
    });
  }

  async getMonthlyRevenue() {
    const results: {
      month: string;
      revenue: number;
      newSubscribers: number;
      churned: number;
    }[] = [];

    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthLabel = start.toISOString().substring(0, 7);

      const [payments, newSubs, churned] = await Promise.all([
        this.prisma.paymentHistory.aggregate({
          where: { paidAt: { gte: start, lte: end }, status: 'approved' },
          _sum: { amount: true },
        }),
        this.prisma.subscription.count({
          where: { currentPeriodStart: { gte: start, lte: end } },
        }),
        this.prisma.subscription.count({
          where: { status: 'cancelled', cancelledAt: { gte: start, lte: end } },
        }),
      ]);

      results.push({
        month: monthLabel,
        revenue: payments._sum.amount ?? 0,
        newSubscribers: newSubs,
        churned,
      });
    }

    return results;
  }

  // ─── Monitoramento técnico ────────────────────────────────

  async getSystemHealth() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last3days = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Database latency
    const dbStart = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - dbStart;

    // Last successful AI call
    const lastAiCall = await this.prisma.reactivationLog.findFirst({
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });

    // Last MP webhook
    const lastMpPayment = await this.prisma.paymentHistory.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, status: true },
    });

    // Usage last 24h
    const [whatsappLast24h, ordersLast24h] = await Promise.all([
      this.prisma.whatsAppMessage.groupBy({
        by: ['tenantId'],
        where: { createdAt: { gte: last24h } },
        _count: { id: true },
      }),
      this.prisma.order.groupBy({
        by: ['tenantId'],
        where: { createdAt: { gte: last24h } },
        _count: { id: true },
      }),
    ]);

    // Alerts
    const [inactiveTenants, nearLimitTenants, recentPaymentFailures] = await Promise.all([
      this.prisma.tenant.findMany({
        where: {
          isActive: true,
          OR: [{ lastLoginAt: { lt: last7days } }, { lastLoginAt: null }],
        },
        select: { id: true, nome: true, email: true, lastLoginAt: true },
        take: 20,
      }),
      this.prisma.tenant.findMany({
        where: { isActive: true, mensagensUsadas: { gt: 0 } },
        select: { id: true, nome: true, mensagensUsadas: true, limiteMensagens: true },
      }),
      this.prisma.paymentHistory.findMany({
        where: { status: { in: ['rejected', 'refunded'] }, createdAt: { gte: last3days } },
        include: { tenant: { select: { nome: true, email: true } } },
      }),
    ]);

    const nearLimit = nearLimitTenants.filter(
      (t) => t.limiteMensagens > 0 && t.mensagensUsadas / t.limiteMensagens >= 0.8,
    );

    return {
      services: {
        database: { status: 'ok', latencyMs: dbLatencyMs },
        redis: { status: 'unknown', note: 'Monitore via Bull dashboard' },
        ai: {
          status: lastAiCall ? 'ok' : 'no_recent_calls',
          lastCallAt: lastAiCall?.sentAt ?? null,
        },
        mercadopago: {
          status: lastMpPayment ? 'ok' : 'no_webhooks',
          lastWebhookAt: lastMpPayment?.createdAt ?? null,
        },
      },
      usageLast24h: {
        whatsappByTenant: whatsappLast24h,
        ordersByTenant: ordersLast24h,
      },
      alerts: {
        inactiveTenants: inactiveTenants.map((t) => ({
          ...t,
          inactiveDays: t.lastLoginAt
            ? Math.floor((now.getTime() - t.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
            : null,
        })),
        nearMessageLimit: nearLimit,
        recentPaymentFailures,
      },
    };
  }

  // ─── Relatórios CSV ───────────────────────────────────────

  async reportTenantsCsv(): Promise<string> {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        plan: true,
        _count: { select: { orders: true, customers: true, users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header =
      'id,nome,email,cnpj,status,plano,preco_mensal,total_os,total_clientes,total_usuarios,ultimo_acesso,criado_em';
    const rows = tenants.map((t) =>
      [
        t.id,
        `"${t.nome.replace(/"/g, '""')}"`,
        t.email,
        t.cnpj ?? '',
        t.status,
        t.plan?.displayName ?? t.plano,
        t.plan?.priceMonthly ?? 0,
        t._count.orders,
        t._count.customers,
        t._count.users,
        t.lastLoginAt?.toISOString() ?? '',
        t.createdAt.toISOString(),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  async reportRevenueCsv(): Promise<string> {
    const monthly = await this.getMonthlyRevenue();
    const header = 'mes,receita,novos_assinantes,cancelamentos';
    const rows = monthly.map((m) =>
      [m.month, m.revenue.toFixed(2), m.newSubscribers, m.churned].join(','),
    );
    return [header, ...rows].join('\n');
  }

  async reportTrialsCsv(): Promise<string> {
    const trials = await this.prisma.tenant.findMany({
      where: { trialStatus: { not: null } },
      select: {
        id: true,
        nome: true,
        email: true,
        cnpj: true,
        registrationIp: true,
        whatsappInstance: true,
        trialStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const header =
      'id,nome,email,cnpj,ip_registro,whatsapp,status_trial,trial_inicio,trial_fim,criado_em';
    const rows = trials.map((t) =>
      [
        t.id,
        `"${t.nome.replace(/"/g, '""')}"`,
        t.email,
        t.cnpj ?? '',
        t.registrationIp ?? '',
        t.whatsappInstance ?? '',
        t.trialStatus ?? '',
        t.trialStartedAt?.toISOString() ?? '',
        t.trialEndsAt?.toISOString() ?? '',
        t.createdAt.toISOString(),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }
}
