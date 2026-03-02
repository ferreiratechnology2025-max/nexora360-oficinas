import { Module } from '@nestjs/common';
import { ReactivationService } from './reactivation.service';
import { ReactivationController } from './reactivation.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AiModule } from '../../ai/ai.module';
import { MessageThrottleModule } from '../message-throttle/message-throttle.module';

@Module({
  imports: [PrismaModule, WhatsAppModule, AiModule, MessageThrottleModule],
  providers: [ReactivationService],
  controllers: [ReactivationController],
  exports: [ReactivationService],
})
export class ReactivationModule {}
