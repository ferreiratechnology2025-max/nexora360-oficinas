import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async registerTenant(dto: {
    nome: string;
    email: string;
    password: string;
    phone?: string;
  }) {
    // Verifica se o email já existe (tanto para tenant quanto para user)
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { email: dto.email },
    });

    if (existingTenant) {
      throw new ConflictException('E-mail já cadastrado para uma oficina');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const tenant = await this.prisma.tenant.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        slug: dto.nome.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(7),
        plano: 'basic',
        limiteMensagens: 500,
      },
    });

    // Cria o usuário owner padrão
    const user = await this.prisma.user.create({
      data: {
        name: dto.nome,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        role: 'owner',
        tenantId: tenant.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const payload: JwtPayload = { sub: user.id, email: user.email || '' };
    const token = this.jwtService.sign(payload);

    return {
      user,
      tenant,
      accessToken: token,
      tokenType: 'Bearer',
    };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        role: dto.role || 'owner',
        tenantId: dto.tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const payload: JwtPayload = { sub: user.id, email: user.email || '' };
    const token = this.jwtService.sign(payload);

    return {
      user,
      accessToken: token,
      tokenType: 'Bearer',
    };
  }

  async login(email: string, password: string) {
    // Tenta encontrar o usuário primeiro
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Se não encontrar, tenta encontrar pelo tenant (email da oficina)
    if (!user) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { email },
      });

      if (tenant) {
        // Retorna dados da oficina para login
        return {
          tenant: {
            id: tenant.id,
            nome: tenant.nome,
            email: tenant.email,
            phone: tenant.phone,
            plano: tenant.plano,
          },
          message: 'tenant_found',
        };
      }
    }

    if (!user) {
      return null;
    }

    if (!user) {
      return null;
    }

    if (!user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    // Track last login on tenant
    await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    const payload: JwtPayload = { sub: user.id, email: user.email || '' };
    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        tenantId: user.tenantId,
      },
      accessToken: token,
      tokenType: 'Bearer',
    };
  }

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo');
    }

    if (!user.tenant.isActive) {
      throw new UnauthorizedException('Oficina inativa');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async mechanicLogin(dto: { email: string; password: string; tenantSlug: string }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });

    if (!tenant) {
      throw new BadRequestException('Oficina não encontrada');
    }

    if (!tenant.isActive) {
      throw new BadRequestException('Oficina inativa');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    if (user.tenantId !== tenant.id) {
      throw new BadRequestException('Usuário não pertence à esta oficina');
    }

    if (!user.isActive) {
      throw new BadRequestException('Usuário inativo');
    }

    if (!user.password) {
      throw new BadRequestException('Senha inválida');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Senha inválida');
    }

    // Track last login on tenant
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    const payload: JwtPayload = { sub: user.id, email: user.email || '' };
    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
      },
      tenant: {
        id: tenant.id,
        nome: tenant.nome,
        slug: tenant.slug,
      },
      accessToken: token,
      tokenType: 'Bearer',
    };
  }
}
