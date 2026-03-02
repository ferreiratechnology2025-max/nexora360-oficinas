import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantDto, UpdateUazapiDto } from './dto/update-tenant.dto';
import { OrderStatus } from '../orders/enums/order-status.enum';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, isActive: true },
        },
        _count: {
          select: { customers: true, vehicles: true, orders: true },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Oficina não encontrada');
    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    return this.prisma.tenant.update({ where: { id }, data: updateTenantDto });
  }

  async updateUazapi(id: string, updateUazapiDto: UpdateUazapiDto) {
    const data: Record<string, any> = {};
    if (updateUazapiDto.uazapiInstanceId !== undefined) {
      data['whatsappInstance'] = updateUazapiDto.uazapiInstanceId;
    }
    return this.prisma.tenant.update({ where: { id }, data });
  }

  async getUsage(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        limiteMensagens: true,
        mensagensUsadas: true,
        _count: {
          select: {
            orders: {
              where: { createdAt: { gte: new Date(new Date().setDate(1)) } },
            },
          },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Oficina não encontrada');

    return {
      mensagens: {
        usadas: tenant.mensagensUsadas,
        limite: tenant.limiteMensagens,
        percentual: (tenant.mensagensUsadas / tenant.limiteMensagens) * 100,
      },
      ordensMes: tenant._count.orders,
    };
  }

  async getDashboard(id: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      todayOrders,
      pendingApprovals,
      readyForPickup,
      deliveredThisMonth,
      monthlyRevenue,
      activeClientsResult,
      quotesSentThisMonth,
      quotesApprovedThisMonth,
      topMechanicResult,
    ] = await Promise.all([
      // OS abertas hoje
      this.prisma.order.count({
        where: {
          tenantId: id,
          createdAt: { gte: today },
          status: { not: OrderStatus.cancelled },
        },
      }),

      // OS aguardando aprovação de orçamento
      this.prisma.order.count({
        where: { tenantId: id, status: OrderStatus.waiting_approval },
      }),

      // OS prontas para retirada
      this.prisma.order.count({
        where: { tenantId: id, status: OrderStatus.ready },
      }),

      // OS entregues no mês
      this.prisma.order.count({
        where: {
          tenantId: id,
          status: OrderStatus.delivered,
          deliveredAt: { gte: monthStart },
        },
      }),

      // Faturamento do mês (soma laborValue + partsValue das OS entregues)
      this.prisma.order.aggregate({
        where: {
          tenantId: id,
          status: OrderStatus.delivered,
          deliveredAt: { gte: monthStart },
        },
        _sum: { totalValue: true },
      }),

      // Clientes distintos com OS no mês
      this.prisma.order.findMany({
        where: {
          tenantId: id,
          createdAt: { gte: monthStart },
          status: { not: OrderStatus.cancelled },
        },
        select: { customerId: true },
        distinct: ['customerId'],
      }),

      // Total de orçamentos enviados no mês (OS que chegaram em waiting_approval)
      this.prisma.order.count({
        where: {
          tenantId: id,
          createdAt: { gte: monthStart },
          status: { notIn: [OrderStatus.received, OrderStatus.cancelled] },
        },
      }),

      // Orçamentos aprovados (in_progress, testing, ready, delivered) no mês
      this.prisma.order.count({
        where: {
          tenantId: id,
          approvedAt: { gte: monthStart },
        },
      }),

      // Mecânico com mais OS concluídas no mês
      this.prisma.order.groupBy({
        by: ['mechanicId'],
        where: {
          tenantId: id,
          status: OrderStatus.delivered,
          deliveredAt: { gte: monthStart },
          mechanicId: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      }),
    ]);

    // Fetch top mechanic name
    let topMechanic: { name: string; completedOrders: number } | null = null;
    if (topMechanicResult.length > 0 && topMechanicResult[0].mechanicId) {
      const mechanic = await this.prisma.user.findUnique({
        where: { id: topMechanicResult[0].mechanicId },
        select: { name: true },
      });
      if (mechanic) {
        topMechanic = {
          name: mechanic.name,
          completedOrders: topMechanicResult[0]._count.id,
        };
      }
    }

    const approvalRate =
      quotesSentThisMonth > 0
        ? Math.round((quotesApprovedThisMonth / quotesSentThisMonth) * 100)
        : 0;

    return {
      todayOrders,
      pendingApprovals,
      readyForPickup,
      deliveredThisMonth,
      monthlyRevenue: monthlyRevenue._sum.totalValue ?? 0,
      activeClientsThisMonth: activeClientsResult.length,
      approvalRate,
      topMechanic,
    };
  }
}
