import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { EmailsService } from './emails.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('emails')
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @Post('send')
  async sendEmail(@Body() dto: { to: string; subject: string; body: string }) {
    return this.emailsService.sendEmail(dto.to, dto.subject, dto.body);
  }

  @Post('send-order-confirmation')
  async sendOrderConfirmation(@Body() dto: { orderId: string; email: string }) {
    return this.emailsService.sendOrderConfirmation(dto.orderId, dto.email);
  }
}
