import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private whatsapp: WhatsAppService,
  ) {}

  // ─── Webhook MercadoPago ─────────────────────────────────

  async handleMercadoPagoWebhook(payload: any) {
    const { type, action, data } = payload;

    this.logger.log(`MP webhook: type=${type} action=${action} id=${data?.id}`);

    if (type === 'payment') {
      const payment = await this.fetchMpPayment(data.id);
      await this.processPayment(payment);
    } else if (type === 'subscription_preapproval') {
      const subscription = await this.fetchMpSubscription(data.id);
      await this.processSubscription(subscription);
    }

    return { received: true };
  }

  private async processPayment(payment: any) {
    if (!payment) return;

    const tenantId = payment.metadata?.tenant_id || payment.external_reference;
    if (!tenantId) {
      this.logger.warn('MP payment sem tenant_id no metadata/external_reference');
      return;
    }

    // Record payment history
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant) {
      const mpStatus = payment.status === 'approved' ? 'approved'
        : ['cancelled', 'refunded', 'charged_back'].includes(payment.status) ? 'refunded'
        : 'rejected';

      await this.prisma.paymentHistory.create({
        data: {
          tenantId,
          planId: tenant.planId,
          amount: payment.transaction_amount ?? 0,
          method: payment.payment_method_id ?? 'mercadopago',
          status: mpStatus,
          mpPaymentId: String(payment.id),
          paidAt: mpStatus === 'approved' ? new Date() : null,
        },
      }).catch((err) => this.logger.warn(`PaymentHistory create failed: ${err.message}`));
    }

    if (payment.status === 'approved') {
      await this.activateSubscription(tenantId, payment);
    } else if (['cancelled', 'refunded', 'charged_back'].includes(payment.status)) {
      await this.cancelSubscription(tenantId, 'Pagamento cancelado/reembolsado');
    }
  }

  private async processSubscription(sub: any) {
    if (!sub) return;

    const tenantId = sub.metadata?.tenant_id || sub.external_reference;
    if (!tenantId) return;

    if (sub.status === 'cancelled') {
      await this.cancelSubscription(tenantId, 'Assinatura cancelada pelo usuário');
    } else if (sub.status === 'authorized') {
      await this.activateSubscription(tenantId, { id: sub.id, isSubscription: true });
    }
  }

  // ─── Ativar assinatura ───────────────────────────────────

  async activateSubscription(tenantId: string, paymentData: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });
    if (!tenant) {
      this.logger.warn(`activateSubscription: tenant ${tenantId} não encontrado`);
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Upsert subscription
    const existing = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['active', 'past_due', 'inactive'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          mpPaymentId: String(paymentData.id),
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelledAt: null,
          pastDueWarningAt: null,
        },
      });
    } else {
      const planId = tenant.planId ?? (await this.prisma.plan.findUnique({ where: { name: 'starter' } }))?.id ?? '';
      await this.prisma.subscription.create({
        data: {
          tenantId,
          planId,
          status: 'active',
          mpPaymentId: String(paymentData.id),
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'active', isActive: true },
    });

    this.logger.log(`Assinatura ativada — tenant ${tenantId}`);
  }

  // ─── Cancelar assinatura ─────────────────────────────────

  async cancelSubscription(tenantId: string, reason: string) {
    await this.prisma.subscription.updateMany({
      where: { tenantId, status: 'active' },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'suspended', isActive: false },
    });

    this.logger.log(`Assinatura cancelada — tenant ${tenantId}: ${reason}`);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant?.whatsappInstance) {
      const msg =
        `⚠️ *Nexora360 — Assinatura cancelada*\n\n` +
        `Olá *${tenant.nome}*, sua assinatura foi cancelada.\n` +
        `Para reativar o acesso, renove seu plano em:\n` +
        `👉 https://nexora360.com/planos`;
      await this.whatsapp.sendMessage(tenantId, tenant.whatsappInstance, msg).catch(() => {});
    }
  }

  // ─── Cron: inadimplência D-3 e D-7 ─────────────────────

  async sendPastDueWarnings() {
    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Subscriptions que vencem em até 3 dias e ainda não foram avisadas
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: { lte: in3days },
        pastDueWarningAt: null,
      },
      include: { tenant: true },
    });

    for (const sub of subscriptions) {
      const tenant = sub.tenant;
      if (!tenant.whatsappInstance) continue;

      const diasRestantes = sub.currentPeriodEnd
        ? Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / 86400000))
        : 0;

      const msg =
        `🔔 *Nexora360 — Renovação em ${diasRestantes} dia(s)*\n\n` +
        `Olá *${tenant.nome}*, sua assinatura vence em breve.\n` +
        `Renove agora para não perder o acesso:\n` +
        `👉 https://nexora360.com/planos`;

      try {
        await this.whatsapp.sendMessage(tenant.id, tenant.whatsappInstance, msg);
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'past_due', pastDueWarningAt: now },
        });
        this.logger.log(`Aviso D-3 enviado ao tenant ${tenant.id}`);
      } catch (err) {
        this.logger.error(`Falha ao enviar aviso D-3: ${err.message}`);
      }
    }
  }

  async suspendOverdueSubscriptions() {
    const now = new Date();
    const overdueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'past_due',
        currentPeriodEnd: { lt: now },
      },
      include: { tenant: true },
    });

    for (const sub of overdueSubscriptions) {
      await this.cancelSubscription(sub.tenantId, 'Inadimplência — D-7 sem pagamento');
    }

    if (overdueSubscriptions.length) {
      this.logger.log(`${overdueSubscriptions.length} tenant(s) suspenso(s) por inadimplência`);
    }
  }

  // ─── Reativação manual (admin) ───────────────────────────

  async reactivateTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant não encontrado');

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'active', isActive: true },
    });

    return { message: `Tenant ${tenantId} reativado` };
  }

  // ─── Helpers MercadoPago ─────────────────────────────────

  private async fetchMpPayment(paymentId: string) {
    const token = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (!token) {
      this.logger.warn('MERCADOPAGO_ACCESS_TOKEN não configurado');
      return null;
    }
    try {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      this.logger.error(`Erro ao buscar pagamento MP ${paymentId}: ${err.message}`);
      return null;
    }
  }

  private async fetchMpSubscription(subscriptionId: string) {
    const token = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (!token) return null;
    try {
      const res = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      this.logger.error(`Erro ao buscar subscription MP ${subscriptionId}: ${err.message}`);
      return null;
    }
  }
}
