import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ReactivationService } from './reactivation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('reactivation')
export class ReactivationController {
  constructor(private readonly reactivationService: ReactivationService) {}

  @Get('history')
  getHistory(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.reactivationService.getHistory(req.user.tenantId);
  }

  @Get('stats')
  getStats(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.reactivationService.getStats(req.user.tenantId);
  }
}
