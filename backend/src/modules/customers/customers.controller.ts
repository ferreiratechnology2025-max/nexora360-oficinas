import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(req.user.tenantId, dto);
  }

  @Get()
  findAll(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.customersService.findAll(req.user.tenantId);
  }

  @Get(':id')
  findOne(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.customersService.findOne(id, req.user.tenantId);
  }

  @Put(':id')
  update(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, dto, req.user.tenantId);
  }

  @Delete(':id')
  remove(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.customersService.remove(id, req.user.tenantId);
  }
}
