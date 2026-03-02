import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { RemindersService, UpdateReminderConfigDto } from './reminders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('config')
  getConfig(@Req() req: ExpressRequest & { user: { tenantId: string } }) {
    return this.remindersService.getConfig(req.user.tenantId);
  }

  @Patch('config')
  updateConfig(
    @Req() req: ExpressRequest & { user: { tenantId: string } },
    @Body() dto: UpdateReminderConfigDto,
  ) {
    return this.remindersService.updateConfig(req.user.tenantId, dto);
  }
}
