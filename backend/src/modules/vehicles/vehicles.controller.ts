import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  create(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehiclesService.create(req.user.tenantId, dto.customerId, dto);
  }

  @Get()
  findAll(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Query('customerId') customerId?: string,
  ) {
    return this.vehiclesService.findAll(customerId, req.user.tenantId);
  }

  @Get(':id')
  findOne(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.vehiclesService.findOne(id, req.user.tenantId);
  }

  @Put(':id')
  update(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(id, dto, req.user.tenantId);
  }

  @Delete(':id')
  remove(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.vehiclesService.remove(id, req.user.tenantId);
  }
}
