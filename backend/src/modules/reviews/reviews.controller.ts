import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  findAll(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.reviewsService.findAll(req.user.tenantId);
  }

  @Get('stats')
  getStats(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.reviewsService.getStats(req.user.tenantId);
  }
}
