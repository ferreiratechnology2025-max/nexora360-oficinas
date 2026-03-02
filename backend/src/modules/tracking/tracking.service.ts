import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private prisma: PrismaService) {}

  async getByToken(token: string) {
    const order = await this.prisma.order.findUnique({
      where: { trackingToken: token },
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { brand: true, model: true, plate: true, year: true } },
        mechanic: { select: { name: true } },
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
      status: order.status,
      mechanic: order.mechanic ? order.mechanic.name.split(' ')[0] : null,
      vehicle: order.vehicle,
      photosByStage,
      timeline,
    };
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

    // Only return entries that have occurred (timestamp set) or is current status
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
