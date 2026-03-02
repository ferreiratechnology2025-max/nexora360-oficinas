import { Module } from '@nestjs/common';
import { UpsellService } from './upsell.service';
import { UpsellController } from './upsell.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AiModule } from '../../ai/ai.module';
import { MessageThrottleModule } from '../message-throttle/message-throttle.module';

@Module({
  imports: [PrismaModule, WhatsAppModule, AiModule, MessageThrottleModule],
  providers: [UpsellService],
  controllers: [UpsellController],
  exports: [UpsellService],
})
export class UpsellModule {}
