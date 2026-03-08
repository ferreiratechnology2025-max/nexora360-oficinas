import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class TrackingService {
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
  ) {}

  async getByToken(token: string) {
    const order = await this.prisma.order.findUnique({
      where: { trackingToken: token },
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { brand: true, model: true, plate: true, year: true } },
        mechanic: { select: { name: true } },
        tenant: { select: { nome: true, phone: true } },
        files: {
          where: { stage: { not: null } },
          select: { id: true, url: true, stage: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');

    // Group photos by stage
    const photosByStage: Record<string, Array<{ id: string; url: string; createdAt: Date }>> = {};
    for (const f of order.files) {
      if (!f.stage) continue;
      if (!photosByStage[f.stage]) photosByStage[f.stage] = [];
      photosByStage[f.stage].push({ id: f.id, url: f.url ?? '', createdAt: f.createdAt });
    }

    // Build status timeline from timestamps
    const timeline = this.buildTimeline(order);

    return {
      trackingToken: order.trackingToken,
      orderNumber: order.orderNumber,
      status: order.status,
      problemDescription: order.problemDescription,
      diagnosis: order.diagnosis,
      laborValue: order.laborValue,
      partsValue: order.partsValue,
      totalValue: order.laborValue + order.partsValue,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deliveredAt: order.deliveredAt,
      mechanic: order.mechanic ? order.mechanic.name.split(' ')[0] : null,
      vehicle: order.vehicle,
      tenant: order.tenant ? { name: order.tenant.nome, phone: order.tenant.phone } : undefined,
      photosByStage,
      timeline,
    };
  }

  async approveByToken(token: string) {
    const order = await this.prisma.order.findUnique({
      where: { trackingToken: token },
      include: { customer: true, vehicle: true },
    });

    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');

    if (order.status !== 'waiting_approval') {
      throw new BadRequestException('Esta OS não está aguardando aprovação');
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'in_progress',
        approvedAt: new Date(),
        inProgressAt: new Date(),
      },
      include: { customer: true, vehicle: true },
    });

    await this.whatsapp.sendOrderStatusNotification(updated, 'in_progress').catch(() => {});

    return { success: true, status: updated.status };
  }

  async rejectByToken(token: string) {
    const order = await this.prisma.order.findUnique({
      where: { trackingToken: token },
      include: { customer: true, vehicle: true },
    });

    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');

    if (order.status !== 'waiting_approval') {
      throw new BadRequestException('Esta OS não está aguardando aprovação');
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'rejected' },
      include: { customer: true, vehicle: true },
    });

    await this.whatsapp.sendOrderStatusNotification(updated, 'rejected').catch(() => {});

    return { success: true, status: updated.status };
  }

  private buildTimeline(order: any) {
    const entries: Array<{ status: string; label: string; at: Date | null }> = [
      { status: 'received',         label: 'Veículo recebido',          at: order.createdAt },
      { status: 'diagnosis',        label: 'Em diagnóstico',            at: order.diagnosisAt },
      { status: 'waiting_approval', label: 'Aguardando aprovação',      at: order.diagnosisAt && !order.approvedAt ? null : order.approvedAt ? null : null },
      { status: 'in_progress',      label: 'Serviço em andamento',      at: order.inProgressAt },
      { status: 'testing',          label: 'Em testes',                 at: order.testingAt },
      { status: 'ready',            label: 'Pronto para retirada',      at: order.completedAt },
      { status: 'delivered',        label: 'Entregue',                  at: order.deliveredAt },
      { status: 'cancelled',        label: 'Cancelado',                 at: order.cancelledAt },
    ];

    const STATUS_SEQUENCE = [
      'received', 'diagnosis', 'waiting_approval', 'in_progress',
      'testing', 'ready', 'delivered',
    ];

    const currentIdx = STATUS_SEQUENCE.indexOf(order.status);

    return entries
      .filter(e => {
        if (e.status === 'cancelled') return order.status === 'cancelled';
        const idx = STATUS_SEQUENCE.indexOf(e.status);
        return idx !== -1 && idx <= currentIdx;
      })
      .map(e => ({
        status: e.status,
        label: e.label,
        at: e.at,
        isCurrent: e.status === order.status,
      }));
  }
}
