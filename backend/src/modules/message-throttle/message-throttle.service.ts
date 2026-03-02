import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageType } from '@prisma/client';

// Priority order (lower index = higher priority)
const MESSAGE_PRIORITY: MessageType[] = [
  MessageType.os_notification,
  MessageType.review,
  MessageType.upsell,
  MessageType.reactivation,
  MessageType.campaign,
  MessageType.reminder,
];

@Injectable()
export class MessageThrottleService {
  private readonly logger = new Logger(MessageThrottleService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Verifica se o cliente pode receber uma mensagem do tipo informado.
   * Regras:
   *  - Máx. 2 mensagens automáticas por semana (exceto os_notification)
   *  - Máx. 1 reactivation por mês
   * Retorna true se pode enviar.
   */
  async canSend(
    customerId: string,
    tenantId: string,
    type: MessageType,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // os_notification nunca é bloqueada pelo throttle
    if (type === MessageType.os_notification) {
      return { allowed: true };
    }

    const now = new Date();

    // Janela semanal (7 dias)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklyCount = await this.prisma.messageLog.count({
      where: {
        customerId,
        tenantId,
        type: { not: MessageType.os_notification },
        sentAt: { gte: weekAgo },
      },
    });

    if (weeklyCount >= 2) {
      return { allowed: false, reason: 'Limite semanal de 2 mensagens automáticas atingido' };
    }

    // Janela mensal para reactivation (30 dias)
    if (type === MessageType.reactivation) {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const monthlyReactivation = await this.prisma.messageLog.count({
        where: {
          customerId,
          tenantId,
          type: MessageType.reactivation,
          sentAt: { gte: monthAgo },
        },
      });

      if (monthlyReactivation >= 1) {
        return { allowed: false, reason: 'Limite mensal de 1 reativação atingido' };
      }
    }

    return { allowed: true };
  }

  /**
   * Registra o envio de uma mensagem no log de throttle.
   */
  async record(
    customerId: string,
    tenantId: string,
    phone: string,
    type: MessageType,
    message: string,
  ): Promise<void> {
    await this.prisma.messageLog.create({
      data: { customerId, tenantId, phone, type, message },
    });
  }

  /**
   * Verifica e registra em uma única operação atômica.
   * Retorna true se a mensagem foi registrada (e pode ser enviada).
   */
  async checkAndRecord(
    customerId: string,
    tenantId: string,
    phone: string,
    type: MessageType,
    message: string,
  ): Promise<boolean> {
    const check = await this.canSend(customerId, tenantId, type);
    if (!check.allowed) {
      this.logger.debug(`Throttle bloqueou envio [${type}] para customer ${customerId}: ${check.reason}`);
      return false;
    }
    await this.record(customerId, tenantId, phone, type, message);
    return true;
  }

  getPriority(type: MessageType): number {
    return MESSAGE_PRIORITY.indexOf(type);
  }
}
