import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';

@Module({
  imports: [PrismaModule, WhatsAppModule],
  providers: [TrackingService],
  controllers: [TrackingController],
})
export class TrackingModule {}
