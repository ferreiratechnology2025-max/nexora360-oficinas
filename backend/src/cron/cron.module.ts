import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { PrismaModule } from '../modules/prisma/prisma.module';
import { TrialGuardModule } from '../modules/trial-guard/trial-guard.module';
import { BillingModule } from '../modules/billing/billing.module';

@Module({
  imports: [PrismaModule, TrialGuardModule, BillingModule],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
