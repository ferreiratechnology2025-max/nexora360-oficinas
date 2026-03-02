import { Module } from '@nestjs/common';
import { SegmentsService } from './segments.service';
import { SegmentsController } from './segments.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SegmentsService],
  controllers: [SegmentsController],
  exports: [SegmentsService],
})
export class SegmentsModule {}
