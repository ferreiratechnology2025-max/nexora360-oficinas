import { Controller, Get, Put, Body, UseGuards, Request, Req } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto, UpdateUazapiDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request as ExpressRequest } from 'express';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get('me')
  async getMyTenant(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.tenantsService.findById(req.user.tenantId);
  }

  @Put('me')
  @Roles('owner')
  async updateMyTenant(@Req() req: ExpressRequest & { user: { tenantId: string } }, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantsService.update(req.user.tenantId, updateTenantDto);
  }

  @Put('uazapi')
  @Roles('owner')
  async updateUazapi(@Req() req: ExpressRequest & { user: { tenantId: string } }, @Body() updateUazapiDto: UpdateUazapiDto) {
    return this.tenantsService.updateUazapi(req.user.tenantId, updateUazapiDto);
  }

  @Get('usage')
  @Roles('owner')
  async getUsage(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.tenantsService.getUsage(req.user.tenantId);
  }

  @Get('dashboard')
  @Roles('owner')
  async getDashboard(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.tenantsService.getDashboard(req.user.tenantId);
  }
}
