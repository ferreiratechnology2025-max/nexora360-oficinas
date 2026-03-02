import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, customerId: string, dto: CreateVehicleDto) {
    // Check if vehicle exists
    const existingVehicle = await this.prisma.vehicle.findFirst({
      where: {
        plate: dto.plate,
        tenantId,
      },
    });

    if (existingVehicle) {
      throw new BadRequestException('Veículo já cadastrado');
    }

    return this.prisma.vehicle.create({
      data: {
        tenantId,
        customerId,
        plate: dto.plate,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        color: dto.color,
      },
      include: {
        customer: true,
        orders: true,
      },
    });
  }

  async findAll(customerId?: string, tenantId?: string) {
    const where: any = tenantId ? { tenantId } : {};

    if (customerId) {
      where.customerId = customerId;
    }

    return this.prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        orders: true,
      },
    });
  }

  async findOne(id: string, tenantId?: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        customer: true,
        orders: true,
      },
    });

    if (!vehicle || (tenantId && vehicle.tenantId !== tenantId)) {
      throw new BadRequestException('Veículo não encontrado');
    }

    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto, tenantId?: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle || (tenantId && vehicle.tenantId !== tenantId)) {
      throw new BadRequestException('Veículo não encontrado');
    }

    // Parse year to number
    const year = dto.year ? Number(dto.year) : undefined;

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        plate: dto.plate,
        brand: dto.brand,
        model: dto.model,
        year: year,
        color: dto.color,
      },
    });
  }

  async remove(id: string, tenantId?: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle || (tenantId && vehicle.tenantId !== tenantId)) {
      throw new BadRequestException('Veículo não encontrado');
    }

    return this.prisma.vehicle.delete({
      where: { id },
    });
  }
}
