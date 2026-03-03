import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { CampaignsService, CreateCampaignDto } from './campaigns.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignsService.create(req.user.tenantId, dto);
  }

  @Get()
  findAll(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.campaignsService.findAll(req.user.tenantId);
  }

  @Get('segments')
  getSegments(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.campaignsService.getSegments(req.user.tenantId);
  }

  @Get(':id')
  findOne(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.campaignsService.findOne(id, req.user.tenantId);
  }

  @Delete(':id')
  cancel(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.campaignsService.cancel(id, req.user.tenantId);
  }

  @Post(':id/send')
  sendNow(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.campaignsService.sendNow(id, req.user.tenantId);
  }
}
