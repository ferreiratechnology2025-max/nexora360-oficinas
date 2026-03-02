import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { OrderStatus } from '../orders/enums/order-status.enum';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, createUserDto: CreateUserDto) {
    const { email, password, ...data } = createUserDto;

    const existingUser = await this.prisma.user.findFirst({
      where: { email, tenantId },
    });
    if (existingUser) throw new ConflictException('Email já cadastrado para esta oficina');

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        ...data,
        email,
        password: hashedPassword,
        role: 'mechanic',
        tenantId,
      },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        commissionRate: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findMechanics(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, role: 'mechanic', isActive: true },
      select: { id: true, name: true, commissionRate: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { customer: true, vehicle: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async update(tenantId: string, id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(tenantId, id);

    const data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const activeOrders = await this.prisma.order.findFirst({
      where: {
        mechanicId: id,
        status: { notIn: [OrderStatus.delivered, OrderStatus.cancelled] },
      },
    });

    if (activeOrders) {
      return this.prisma.user.update({ where: { id }, data: { isActive: false } });
    }

    return this.prisma.user.delete({ where: { id } });
  }

  /**
   * Desativa um mecânico (sem excluir).
   * Mecânico desativado não consegue fazer login (auth service verifica isActive).
   */
  async deactivate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Reativa um mecânico.
   */
  async reactivate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.user.update({ where: { id }, data: { isActive: true } });
  }

  /**
   * Retorna os KPIs de performance do mecânico logado.
   * NÃO inclui valores financeiros.
   */
  async getMechanicPerformance(tenantId: string, userId: string) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [completedThisMonth, activeOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          tenantId,
          mechanicId: userId,
          status: OrderStatus.delivered,
          deliveredAt: { gte: monthStart },
        },
        select: { id: true, createdAt: true, deliveredAt: true },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          mechanicId: userId,
          status: { in: [OrderStatus.received, OrderStatus.diagnosis, OrderStatus.in_progress, OrderStatus.testing, OrderStatus.ready] },
        },
      }),
    ]);

    // Average time in days (createdAt → deliveredAt)
    let avgDays = 0;
    if (completedThisMonth.length > 0) {
      const totalMs = completedThisMonth.reduce((acc, o) => {
        if (o.deliveredAt) return acc + (o.deliveredAt.getTime() - o.createdAt.getTime());
        return acc;
      }, 0);
      avgDays = Math.round(totalMs / completedThisMonth.length / (1000 * 60 * 60 * 24));
    }

    return {
      completedThisMonth: completedThisMonth.length,
      avgDaysPerOrder: avgDays,
      activeOrders,
    };
  }
}
