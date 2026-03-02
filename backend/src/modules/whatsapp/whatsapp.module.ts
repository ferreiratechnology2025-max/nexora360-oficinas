import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppProcessor, WHATSAPP_QUEUE } from './whatsapp.processor';
import { AiModule } from '../../ai/ai.module';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    BullModule.registerQueue({ name: WHATSAPP_QUEUE }),
  ],
  providers: [WhatsAppService, WhatsAppProcessor],
  controllers: [WhatsAppController],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
