import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantStatusGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Rotas @Public() passam sem verificação
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Sem usuário autenticado → JwtAuthGuard já trata isso
    if (!user?.tenantId) return true;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true, status: true, isActive: true, trialEndsAt: true },
    });

    if (!tenant) throw new ForbiddenException('Tenant não encontrado');

    const now = new Date();

    switch (tenant.status) {
      case 'active':
        return true;

      case 'trial':
        if (!tenant.trialEndsAt || tenant.trialEndsAt > now) return true;
        // Trial expirou — suspender na próxima passagem do cron, mas bloquear já
        throw new ForbiddenException(
          'Período de trial expirado. Assine um plano para continuar.',
        );

      case 'pending_approval':
        throw new ForbiddenException(
          'Aguardando aprovação do acesso. Em breve nossa equipe entrará em contato.',
        );

      case 'suspended':
        throw new ForbiddenException(
          'Acesso suspenso. Regularize sua assinatura em nexora360.com/planos',
        );

      case 'rejected':
        throw new ForbiddenException('Acesso rejeitado. Entre em contato com o suporte.');

      default:
        throw new ForbiddenException('Status de conta inválido.');
    }
  }
}
