import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class TrialGuardService {
  private readonly logger = new Logger(TrialGuardService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
  ) {}

  /** Chamado pelo cron a cada hora: suspende trials vencidos (dia 8+) */
  async suspendExpiredTrials() {
    const now = new Date();
    const expired = await this.prisma.tenant.findMany({
      where: {
        status: 'trial',
        trialEndsAt: { lt: now },
      },
    });

    for (const tenant of expired) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'suspended', isActive: false, trialStatus: 'expired' },
      });
      this.logger.warn(`Trial expirado — tenant ${tenant.id} suspenso`);
    }

    if (expired.length) {
      this.logger.log(`${expired.length} trial(s) suspenso(s) por expiração`);
    }
  }

  /** Cron diário: envia aviso WhatsApp no dia 5 do trial */
  async sendDay5Warnings() {
    const now = new Date();
    const day5Start = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // faltam 2 dias
    const day5End   = new Date(day5Start.getTime() + 24 * 60 * 60 * 1000);

    const tenants = await this.prisma.tenant.findMany({
      where: {
        status: 'trial',
        trialEndsAt: { gte: day5Start, lt: day5End },
        trialStatus: 'approved',
      },
    });

    for (const tenant of tenants) {
      if (!tenant.whatsappInstance) continue;

      const diasRestantes = tenant.trialEndsAt
        ? Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 2;

      const message =
        `⚠️ *Nexora360 — Seu trial está acabando!*\n\n` +
        `Olá *${tenant.nome}*, seu período de avaliação gratuita expira em *${diasRestantes} dias*.\n\n` +
        `Para continuar usando o sistema sem interrupções, assine um plano em:\n` +
        `👉 https://nexora360.com/planos\n\n` +
        `Dúvidas? Fale conosco pelo WhatsApp.`;

      try {
        await this.whatsapp.sendMessage(tenant.id, tenant.whatsappInstance, message);
        this.logger.log(`Aviso D5 enviado ao tenant ${tenant.id}`);
      } catch (err) {
        this.logger.error(`Falha ao enviar aviso D5 ao tenant ${tenant.id}: ${err.message}`);
      }
    }
  }

  /** Aprova trial: inicia contador de 7 dias */
  async approveTrial(tenantId: string) {
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'trial',
        isActive: true,
        trialStatus: 'approved',
        trialStartedAt: now,
        trialEndsAt,
        trialRejectionReason: null,
      },
    });

    this.logger.log(`Trial aprovado para tenant ${tenantId}. Expira em: ${trialEndsAt.toISOString()}`);
    return { trialStartedAt: now, trialEndsAt };
  }

  /** Rejeita trial */
  async rejectTrial(tenantId: string, reason: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'rejected',
        isActive: false,
        trialStatus: 'rejected',
        trialRejectionReason: reason,
      },
    });
    this.logger.log(`Trial rejeitado para tenant ${tenantId}: ${reason}`);
  }
}
