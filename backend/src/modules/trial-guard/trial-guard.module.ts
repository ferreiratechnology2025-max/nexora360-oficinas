import { Module } from '@nestjs/common';
import { TrialGuardService } from './trial-guard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, WhatsAppModule],
  providers: [TrialGuardService],
  exports: [TrialGuardService],
})
export class TrialGuardModule {}
