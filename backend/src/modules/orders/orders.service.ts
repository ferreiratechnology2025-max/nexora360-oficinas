import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AdvanceOrderDto } from './dto/advance-order.dto';
import { OrderStatus } from './enums/order-status.enum';

const STATUS_SEQUENCE: OrderStatus[] = [
  OrderStatus.received,
  OrderStatus.diagnosis,
  OrderStatus.waiting_approval,
  OrderStatus.in_progress,
  OrderStatus.testing,
  OrderStatus.ready,
  OrderStatus.delivered,
];

function nextStatus(current: OrderStatus): OrderStatus | null {
  const idx = STATUS_SEQUENCE.indexOf(current);
  if (idx === -1 || idx === STATUS_SEQUENCE.length - 1) return null;
  return STATUS_SEQUENCE[idx + 1];
}

type AuthUser = { id: string; tenantId: string; role: string };

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
  ) {}

  async create(tenantId: string, dto: CreateOrderDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId, tenantId },
    });
    if (!customer) throw new BadRequestException('Cliente não encontrado nesta oficina');

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId, tenantId },
    });
    if (!vehicle) throw new BadRequestException('Veículo não encontrado nesta oficina');

    const trackingToken =
      dto.trackingToken ||
      `OS-${tenantId.substring(0, 6)}-${Date.now().toString().slice(-6)}`;

    const order = await this.prisma.order.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        vehicleId: vehicle.id,
        mechanicId: dto.mechanicId,
        problemDescription: dto.problemDescription,
        laborValue: dto.laborValue ?? 0,
        partsValue: dto.partsValue ?? 0,
        estimatedDays: dto.estimatedDays ?? 5,
        orderNumber: trackingToken,
        trackingToken,
        status: OrderStatus.received,
      },
      include: { customer: true, vehicle: true },
    });

    // WhatsApp notification: received
    await this.whatsapp.sendOrderStatusNotification(order, 'received');

    return order;
  }

  async findAll(user: AuthUser, mechanicId?: string) {
    const where: any = { tenantId: user.tenantId };

    if (user.role === 'mechanic') {
      // Mechanic only sees their own orders
      where.mechanicId = user.id;
    } else if (mechanicId) {
      where.mechanicId = mechanicId;
    }

    return this.prisma.order.findMany({
      where,
      include: { customer: true, vehicle: true, mechanic: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        mechanic: { select: { id: true, name: true } },
        files: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order || order.tenantId !== user.tenantId) {
      throw new NotFoundException('Ordem de serviço não encontrada');
    }

    // Mechanic can only see their own orders
    if (user.role === 'mechanic' && order.mechanicId !== user.id) {
      throw new ForbiddenException('Acesso negado a esta ordem de serviço');
    }

    return order;
  }

  /**
   * Mecânico avança o status da OS em um passo.
   * Dono também pode avançar.
   * waiting_approval → in_progress requer clientApproved: true.
   */
  async advance(id: string, user: AuthUser, dto: AdvanceOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: true, vehicle: true },
    });

    if (!order || order.tenantId !== user.tenantId) {
      throw new NotFoundException('Ordem de serviço não encontrada');
    }

    // Mechanic must be the assigned one
    if (user.role === 'mechanic' && order.mechanicId !== user.id) {
      throw new ForbiddenException('Você não está atribuído a esta OS');
    }

    const currentStatus = order.status as unknown as OrderStatus;

    if (currentStatus === OrderStatus.cancelled || currentStatus === OrderStatus.delivered) {
      throw new BadRequestException('Esta OS já foi finalizada');
    }

    const next = nextStatus(currentStatus);
    if (!next) throw new BadRequestException('Status já é o final');

    // waiting_approval → in_progress requires client approval
    if (currentStatus === OrderStatus.waiting_approval && next === OrderStatus.in_progress) {
      if (!dto.clientApproved) {
        throw new BadRequestException(
          'É necessário informar clientApproved: true para avançar após aprovação do cliente',
        );
      }
    }

    // Build update data
    const data: any = { status: next };

    if (next === OrderStatus.diagnosis) {
      data.diagnosisAt = new Date();
      if (dto.diagnosis) data.diagnosis = dto.diagnosis;
    } else if (next === OrderStatus.in_progress) {
      data.inProgressAt = new Date();
      data.approvedAt = new Date();
    } else if (next === OrderStatus.testing) {
      data.testingAt = new Date();
    } else if (next === OrderStatus.ready) {
      data.completedAt = new Date();
    } else if (next === OrderStatus.delivered) {
      data.deliveredAt = new Date();
    }

    // Update totalValue when status reaches waiting_approval (owner already set laborValue/partsValue)
    if (next === OrderStatus.waiting_approval) {
      data.totalValue = order.laborValue + order.partsValue;
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data,
      include: { customer: true, vehicle: true },
    });

    // WhatsApp notification
    await this.whatsapp.sendOrderStatusNotification(updated, next);

    return updated;
  }

  /**
   * Cancela a OS — exclusivo para role owner.
   */
  async cancel(id: string, tenantId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order || order.tenantId !== tenantId) {
      throw new NotFoundException('Ordem de serviço não encontrada');
    }

    if (order.status === OrderStatus.delivered || order.status === OrderStatus.cancelled) {
      throw new BadRequestException('Esta OS já foi finalizada');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.cancelled, cancelledAt: new Date() },
      include: { customer: true, vehicle: true },
    });

    await this.whatsapp.sendOrderStatusNotification(updated, 'cancelled');

    return updated;
  }

  async findByNumber(orderNumber: string, tenantId: string) {
    return this.prisma.order.findFirst({
      where: { trackingToken: orderNumber, tenantId },
    });
  }

  /**
   * Atualiza campos de orçamento — apenas owner.
   * Mecânico NÃO pode editar preço, peças ou mão de obra.
   */
  async update(id: string, dto: UpdateOrderDto, user: AuthUser) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order || order.tenantId !== user.tenantId) {
      throw new NotFoundException('Ordem de serviço não encontrada');
    }

    // Mechanic cannot edit financial fields
    if (user.role === 'mechanic') {
      if (dto.laborValue !== undefined || dto.partsValue !== undefined) {
        throw new ForbiddenException('Mecânico não pode editar valores financeiros');
      }
    }

    const data: any = { ...dto };
    // Recalculate totalValue whenever financials change
    const newLabor = dto.laborValue ?? order.laborValue;
    const newParts = dto.partsValue ?? order.partsValue;
    data.totalValue = newLabor + newParts;

    return this.prisma.order.update({ where: { id }, data });
  }

  /**
   * Exclui a OS — apenas owner.
   */
  async remove(id: string, tenantId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order || order.tenantId !== tenantId) {
      throw new NotFoundException('Ordem de serviço não encontrada');
    }

    return this.prisma.order.delete({ where: { id } });
  }

  // ─── Legacy endpoints (kept for backwards compatibility) ─────────

  async completeOrder(id: string, tenantId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || order.tenantId !== tenantId) throw new NotFoundException('Ordem não encontrada');
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.ready, completedAt: new Date() },
    });
  }

  async approve(id: string, tenantId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || order.tenantId !== tenantId) throw new NotFoundException('Ordem não encontrada');
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.waiting_approval, totalValue: order.laborValue + order.partsValue },
      include: { customer: true, vehicle: true, mechanic: true },
    });
  }

  async deliver(id: string, tenantId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || order.tenantId !== tenantId) throw new NotFoundException('Ordem não encontrada');
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.delivered, deliveredAt: new Date() },
      include: { customer: true, vehicle: true, mechanic: true },
    });
    await this.whatsapp.sendOrderStatusNotification(updated, 'delivered');
    return updated;
  }
}
