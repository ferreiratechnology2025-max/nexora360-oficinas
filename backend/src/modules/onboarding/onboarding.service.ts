import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterOnboardingDto } from './dto/register-onboarding.dto';
import { SelectPlanDto } from './dto/select-plan.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /** POST /onboarding/register */
  async register(dto: RegisterOnboardingDto, registrationIp: string) {
    // CNPJ único
    const existingCnpj = await this.prisma.tenant.findUnique({ where: { cnpj: dto.cnpj } });
    if (existingCnpj) throw new ConflictException('CNPJ já cadastrado');

    const existingEmail = await this.prisma.tenant.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('E-mail já cadastrado');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const slug =
      dto.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      Math.random().toString(36).substring(2, 7);

    const tenant = await this.prisma.tenant.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        cnpj: dto.cnpj,
        slug,
        status: 'pending_approval',
        isActive: false,
        registrationIp,
        whatsappInstance: dto.whatsappInstance,
        plano: 'starter',
        limiteMensagens: 500,
      },
    });

    const owner = await this.prisma.user.create({
      data: {
        name: dto.nome,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        role: 'owner',
        tenantId: tenant.id,
      },
    });

    const payload: JwtPayload = {
      sub: owner.id,
      email: owner.email,
      tenantId: tenant.id,
      role: owner.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Cadastro realizado. Solicite o trial para iniciar o período de avaliação.',
      tenantId: tenant.id,
      status: tenant.status,
      accessToken,
      tokenType: 'Bearer',
    };
  }

  /** POST /onboarding/select-plan */
  async selectPlan(tenantId: string, dto: SelectPlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { name: dto.planName } });
    if (!plan) throw new NotFoundException('Plano não encontrado');

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { planId: plan.id, plano: plan.name, limiteMensagens: plan.messageLimit },
    });

    return { message: `Plano ${plan.displayName} selecionado com sucesso`, plan };
  }

  /** POST /onboarding/request-trial */
  async requestTrial(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    // 1 trial por CNPJ para sempre
    if (tenant.trialStatus !== null) {
      throw new ConflictException('Este CNPJ já utilizou ou solicitou o período de trial');
    }

    if (tenant.status === 'active') {
      throw new BadRequestException('Tenant já possui assinatura ativa');
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { trialStatus: 'pending_approval', status: 'pending_approval' },
    });

    return {
      message: 'Solicitação de trial enviada. Aguardando aprovação da equipe Nexora.',
      status: 'pending_approval',
    };
  }

  /** GET /onboarding/status */
  async getStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        nome: true,
        status: true,
        trialStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
        trialRejectionReason: true,
        plano: true,
        planId: true,
        isActive: true,
        subscriptions: {
          where: { status: 'active' },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const now = new Date();
    const trialDaysLeft =
      tenant.trialEndsAt && tenant.status === 'trial'
        ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / 86400000))
        : null;

    const messages: Record<string, string> = {
      pending_approval: 'Sua conta está aguardando aprovação da equipe Nexora.',
      trial:            trialDaysLeft !== null ? `Trial ativo — ${trialDaysLeft} dia(s) restante(s).` : 'Trial ativo.',
      active:           'Assinatura ativa.',
      suspended:        'Acesso suspenso. Regularize sua assinatura.',
      rejected:         tenant.trialRejectionReason ?? 'Acesso rejeitado.',
    };

    return {
      tenantId: tenant.id,
      nome: tenant.nome,
      status: tenant.status,
      trialStatus: tenant.trialStatus,
      trialDaysLeft,
      plano: tenant.plano,
      hasActiveSubscription: tenant.subscriptions.length > 0,
      message: messages[tenant.status] ?? '',
    };
  }
}
