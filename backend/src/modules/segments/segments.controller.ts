import { Controller, Get, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { SegmentsService } from './segments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SegmentType } from '@prisma/client';
import { Request as ExpressRequest } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('segments')
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get()
  getCounts(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.segmentsService.getSegmentCounts(req.user.tenantId);
  }

  @Get(':segment/customers')
  getCustomers(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Param('segment') segment: string,
  ) {
    const validSegments = Object.values(SegmentType) as string[];
    if (!validSegments.includes(segment)) {
      throw new BadRequestException(`Segmento inválido. Válidos: ${validSegments.join(', ')}`);
    }
    return this.segmentsService.getCustomersBySegment(req.user.tenantId, segment as SegmentType);
  }
}
