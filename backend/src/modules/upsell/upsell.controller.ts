import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UpsellService } from './upsell.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('upsell')
export class UpsellController {
  constructor(private readonly upsellService: UpsellService) {}

  @Get('suggestions')
  getSuggestions(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.upsellService.getSuggestions(req.user.tenantId);
  }

  @Get('stats')
  getStats(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.upsellService.getStats(req.user.tenantId);
  }
}
