import { Module } from '@nestjs/common';
import { MessageThrottleService } from './message-throttle.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MessageThrottleService],
  exports: [MessageThrottleService],
})
export class MessageThrottleModule {}
