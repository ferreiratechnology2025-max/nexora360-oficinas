import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Response, Request as ExpressRequest } from 'express';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './guards/superadmin.guard';
import { RejectTrialDto } from './dto/reject-trial.dto';
import { Throttle } from '@nestjs/throttler';
import { AdminActionType } from '@prisma/client';

interface SendMessageDto {
  type: 'whatsapp' | 'email';
  message: string;
}

/** Todos os endpoints /admin/* exigem superadmin + rate limit 60 req/min */
@UseGuards(SuperAdminGuard)
@Throttle({ default: { limit: 60, ttl: 60000 } })
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private getAdminId(req: any): string {
    return req.user?.id ?? req.user?.sub ?? 'unknown';
  }

  // ─── Trials ──────────────────────────────────────────────

  @Get('trials/pending')
  getPendingTrials() {
    return this.adminService.getPendingTrials();
  }

  @Post('trials/:tenantId/approve')
  approveTrial(@Param('tenantId') tenantId: string, @Req() req: ExpressRequest) {
    return this.adminService.approveTrial(tenantId, this.getAdminId(req));
  }

  @Post('trials/:tenantId/reject')
  rejectTrial(
    @Param('tenantId') tenantId: string,
    @Body() dto: RejectTrialDto,
    @Req() req: ExpressRequest,
  ) {
    return this.adminService.rejectTrial(tenantId, dto.reason, this.getAdminId(req));
  }

  // ─── Tenants ─────────────────────────────────────────────

  @Get('tenants')
  getAllTenants(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getAllTenants(page, limit);
  }

  @Get('tenants/:id')
  getTenantProfile(@Param('id') id: string) {
    return this.adminService.getTenantProfile(id);
  }

  @Patch('tenants/:id/block')
  blockTenant(@Param('id') id: string, @Req() req: ExpressRequest) {
    return this.adminService.blockTenant(id, this.getAdminId(req));
  }

  @Patch('tenants/:id/unblock')
  unblockTenant(@Param('id') id: string, @Req() req: ExpressRequest) {
    return this.adminService.unblockTenant(id, this.getAdminId(req));
  }

  @Post('tenants/:id/message')
  sendMessageToTenant(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Req() req: ExpressRequest,
  ) {
    return this.adminService.sendMessageToTenant(id, dto.type, dto.message, this.getAdminId(req));
  }

  // ─── Métricas ─────────────────────────────────────────────

  @Get('metrics')
  getMetrics() {
    return this.adminService.getMetrics();
  }

  // ─── Pagamentos ───────────────────────────────────────────

  @Get('payments')
  getPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getPayments(page, limit);
  }

  @Get('payments/:tenantId')
  getTenantPayments(@Param('tenantId') tenantId: string) {
    return this.adminService.getTenantPayments(tenantId);
  }

  @Get('revenue/monthly')
  getMonthlyRevenue() {
    return this.adminService.getMonthlyRevenue();
  }

  // ─── Monitoramento ────────────────────────────────────────

  @Get('system/health')
  getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  // ─── Relatórios CSV ───────────────────────────────────────

  @Get('reports/tenants')
  async reportTenants(@Res() res: Response, @Req() req: ExpressRequest) {
    const csv = await this.adminService.reportTenantsCsv();
    await this.adminService.logAction(
      this.getAdminId(req),
      AdminActionType.view_report,
      undefined,
      'report',
      { name: 'tenants' },
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="nexora-tenants.csv"');
    res.send(csv);
  }

  @Get('reports/revenue')
  async reportRevenue(@Res() res: Response, @Req() req: ExpressRequest) {
    const csv = await this.adminService.reportRevenueCsv();
    await this.adminService.logAction(
      this.getAdminId(req),
      AdminActionType.view_report,
      undefined,
      'report',
      { name: 'revenue' },
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="nexora-revenue.csv"');
    res.send(csv);
  }

  @Get('reports/trials')
  async reportTrials(@Res() res: Response, @Req() req: ExpressRequest) {
    const csv = await this.adminService.reportTrialsCsv();
    await this.adminService.logAction(
      this.getAdminId(req),
      AdminActionType.view_report,
      undefined,
      'report',
      { name: 'trials' },
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="nexora-trials.csv"');
    res.send(csv);
  }

  // ─── Logs ─────────────────────────────────────────────────

  @Get('logs')
  getLogs(@Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number) {
    return this.adminService.getLogs(limit);
  }
}
