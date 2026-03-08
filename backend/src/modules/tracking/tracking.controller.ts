import { Controller, Get, Post, Patch, Param } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Public()
  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.trackingService.getByToken(token);
  }

  @Public()
  @Post(':token/approve')
  approveByToken(@Param('token') token: string) {
    return this.trackingService.approveByToken(token);
  }

  @Public()
  @Patch(':token/reject')
  rejectByToken(@Param('token') token: string) {
    return this.trackingService.rejectByToken(token);
  }
}
