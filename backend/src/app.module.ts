import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';

// Core modules
import { LoggerModule } from './modules/logger/logger.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module'; // @Global — disponível em todos os módulos

// Auth
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

// Feature modules
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { OrdersModule } from './modules/orders/orders.module';
import { FilesModule } from './modules/files/files.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { EmailsModule } from './modules/emails/emails.module';

// Phase 2 modules
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { BillingModule } from './modules/billing/billing.module';
import { TrialGuardModule } from './modules/trial-guard/trial-guard.module';
import { AdminModule } from './modules/admin/admin.module';
import { TenantStatusGuard } from './modules/guards/tenant-status.guard';

// Phase 3 modules
import { TrackingModule } from './modules/tracking/tracking.module';

// Phase 4 modules — Growth Engine
import { MessageThrottleModule } from './modules/message-throttle/message-throttle.module';
import { SegmentsModule } from './modules/segments/segments.module';
import { ReactivationModule } from './modules/reactivation/reactivation.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { UpsellModule } from './modules/upsell/upsell.module';
import { ReviewsModule } from './modules/reviews/reviews.module';

// AI + Cron
import { AiModule } from './ai/ai.module';
import { CronModule } from './cron/cron.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        redis: {
          host: cfg.get('REDIS_HOST', 'localhost'),
          port: cfg.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),

    // Core
    ScheduleModule.forRoot(),
    LoggerModule,
    HealthModule,
    PrismaModule,

    // Auth + Features
    AuthModule,
    UsersModule,
    TenantsModule,
    CustomersModule,
    VehiclesModule,
    OrdersModule,
    FilesModule,
    WhatsAppModule,
    EmailsModule,

    // Phase 2
    OnboardingModule,
    BillingModule,
    TrialGuardModule,
    AdminModule,

    // Phase 3
    TrackingModule,

    // Phase 4 — Growth Engine
    MessageThrottleModule,
    SegmentsModule,
    ReactivationModule,
    RemindersModule,
    CampaignsModule,
    UpsellModule,
    ReviewsModule,

    // AI + Cron
    AiModule,
    CronModule,
  ],
  providers: [
    // Guard global 1: valida JWT (respeita @Public())
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Guard global 2: verifica status do tenant (roda após JWT)
    { provide: APP_GUARD, useClass: TenantStatusGuard },
  ],
})
export class AppModule {}
