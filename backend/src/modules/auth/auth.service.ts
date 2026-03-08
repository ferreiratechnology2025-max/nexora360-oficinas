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
    cnpj?: string;
    ownerName?: string;
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
        cnpj: dto.cnpj,
        slug: dto.nome.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(7),
        plano: 'basic',
        limiteMensagens: 500,
      },
    });

    // Cria o usuário owner padrão (usa ownerName se informado, senão usa nome da oficina)
    const user = await this.prisma.user.create({
      data: {
        name: dto.ownerName ?? dto.nome,
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

    const payload: JwtPayload = { sub: user.id, email: user.email || '', role: user.role, tenantId: user.tenantId };
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

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new BadRequestException('Senha atual incorreta');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { message: 'Senha alterada com sucesso' };
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

  async mechanicLogin(dto: { email: string; password: string }) {
    // Find user directly by email — no slug needed (email is unique across all tenants)
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user) {
      throw new BadRequestException('E-mail ou senha inválidos');
    }

    if (user.role !== 'mechanic') {
      throw new BadRequestException('Acesso permitido apenas para mecânicos');
    }

    if (!user.isActive) {
      throw new BadRequestException('Usuário inativo. Fale com o dono da oficina');
    }

    if (!user.tenant.isActive) {
      throw new BadRequestException('Oficina inativa');
    }

    if (!user.password) {
      throw new BadRequestException('E-mail ou senha inválidos');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('E-mail ou senha inválidos');
    }

    // Track last login on tenant
    await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    const payload: JwtPayload = { sub: user.id, email: user.email || '', role: user.role, tenantId: user.tenantId };
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
        id: user.tenant.id,
        nome: user.tenant.nome,
        slug: user.tenant.slug,
      },
      accessToken: token,
      tokenType: 'Bearer',
    };
  }
}
