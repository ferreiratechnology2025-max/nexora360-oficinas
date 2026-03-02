import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check() {
    return this.healthService.check();
  }

  @Get('database')
  async checkDatabase() {
    return this.healthService.checkDatabase();
  }

  @Get('disk')
  async checkDiskSpace() {
    return this.healthService.checkDiskSpace();
  }

  @Get('all')
  async checkAll() {
    return this.healthService.checkAll();
  }
}
