import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCustomerDto) {
    // cpf é required no banco
    const cpf = dto.cpf || `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Extract optional fields
    const { phone2, email, address, number, neighborhood, city, state, zipCode, notes, ...data } = dto;
    return this.prisma.customer.create({
      data: {
        ...data,
        tenantId,
        phone: dto.phone,
        cpf,
        email: email || undefined,
        address: address || undefined,
        number: number || undefined,
        neighborhood: neighborhood || undefined,
        city: city || undefined,
        state: state || undefined,
        zipCode: zipCode || undefined,
      },
    });
  }

  async findAll(tenantId: string, search?: string, limit?: number) {
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    return this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findOne(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { vehicles: { orderBy: { createdAt: 'desc' } } },
    });

    if (customer && customer.tenantId !== tenantId) {
      return null;
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, tenantId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer || customer.tenantId !== tenantId) {
      return null;
    }

    return this.prisma.customer.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer || customer.tenantId !== tenantId) {
      return null;
    }

    return this.prisma.customer.delete({
      where: { id },
    });
  }
}
