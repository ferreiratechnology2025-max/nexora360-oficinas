import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { SegmentsModule } from '../segments/segments.module';
import { MessageThrottleModule } from '../message-throttle/message-throttle.module';

@Module({
  imports: [PrismaModule, WhatsAppModule, SegmentsModule, MessageThrottleModule],
  providers: [CampaignsService],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
