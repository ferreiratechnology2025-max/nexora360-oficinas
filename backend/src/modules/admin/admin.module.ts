import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TrialGuardModule } from '../trial-guard/trial-guard.module';
import { BillingModule } from '../billing/billing.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { EmailsModule } from '../emails/emails.module';

@Module({
  imports: [PrismaModule, TrialGuardModule, BillingModule, WhatsAppModule, EmailsModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
