import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { SegmentsService } from '../segments/segments.service';
import { MessageThrottleService } from '../message-throttle/message-throttle.service';
import { CampaignType, MessageType, SegmentType } from '@prisma/client';

export interface CreateCampaignDto {
  name: string;
  type: CampaignType;
  segment: string;
  message: string;
  scheduledAt?: string;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
    private segments: SegmentsService,
    private throttle: MessageThrottleService,
  ) {}

  // ─── CRON: a cada hora, dispara campanhas agendadas ───────
  @Cron('0 * * * *', { name: 'campaigns-cron' })
  async runScheduledCampaigns() {
    const now = new Date();

    const dueCampaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
    });

    for (const campaign of dueCampaigns) {
      try {
        await this.dispatchCampaign(campaign.id, campaign.tenantId);
      } catch (err) {
        this.logger.error(`Erro ao disparar campanha ${campaign.id}: ${err.message}`);
      }
    }
  }

  async dispatchCampaign(campaignId: string, tenantId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.tenantId !== tenantId) return;
    if (campaign.status === 'cancelled') return;

    const validSegments = Object.values(SegmentType) as string[];
    let customers: { id: string; phone: string; name: string }[] = [];

    if (validSegments.includes(campaign.segment)) {
      const rows = await this.segments.getCustomersBySegment(tenantId, campaign.segment as SegmentType);
      customers = rows.map((r) => ({ id: r.id, phone: r.phone, name: r.name }));
    } else {
      // "all" — todos os clientes ativos do tenant
      customers = await this.prisma.customer.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, phone: true, name: true },
      });
    }

    let totalSent = 0;

    for (const customer of customers) {
      const allowed = await this.throttle.canSend(customer.id, tenantId, MessageType.campaign);
      if (!allowed.allowed) continue;

      const firstName = customer.name.split(' ')[0];
      const message = campaign.message.replace('{nome}', firstName);

      try {
        if (campaign.type === CampaignType.whatsapp || campaign.type === CampaignType.both) {
          await this.whatsapp.sendMessage(tenantId, customer.phone, message);
          await this.throttle.record(customer.id, tenantId, customer.phone, MessageType.campaign, message);
        }
        totalSent++;
      } catch (err) {
        this.logger.warn(`Falha ao enviar campanha para customer ${customer.id}: ${err.message}`);
      }
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'sent', sentAt: new Date(), totalSent },
    });

    this.logger.log(`Campanha ${campaignId} disparada: ${totalSent} enviadas`);
  }

  // ─── API ─────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        segment: dto.segment,
        message: dto.message,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: 'scheduled',
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.tenantId !== tenantId) {
      throw new NotFoundException('Campanha não encontrada');
    }
    return campaign;
  }

  async cancel(id: string, tenantId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.tenantId !== tenantId) {
      throw new NotFoundException('Campanha não encontrada');
    }
    if (campaign.status !== 'scheduled') {
      throw new BadRequestException('Só é possível cancelar campanhas com status scheduled');
    }
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  async sendNow(id: string, tenantId: string) {
    const campaign = await this.findOne(id, tenantId);
    if (campaign.status === 'cancelled') {
      throw new BadRequestException('Campanha cancelada não pode ser disparada');
    }
    if (campaign.status === 'sent') {
      throw new BadRequestException('Campanha já foi enviada');
    }
    await this.dispatchCampaign(id, tenantId);
    return this.findOne(id, tenantId);
  }

  async getSegments(tenantId: string) {
    const counts = await this.segments.getSegmentCounts(tenantId);
    const all = await this.prisma.customer.count({ where: { tenantId, isActive: true } });
    return [
      { type: 'all',         label: 'Todos os clientes',                  count: all },
      { type: 'INACTIVE_30', label: 'Inativos há 30 dias',                count: counts['INACTIVE_30'] ?? 0 },
      { type: 'INACTIVE_60', label: 'Inativos há 60 dias',                count: counts['INACTIVE_60'] ?? 0 },
      { type: 'INACTIVE_90', label: 'Inativos há 90 dias',                count: counts['INACTIVE_90'] ?? 0 },
      { type: 'NEW',         label: 'Clientes recentes (últimos 30 dias)', count: counts['NEW'] ?? 0 },
    ];
  }
}
