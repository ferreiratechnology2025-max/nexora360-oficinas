import { Controller, Post, Body, BadRequestException, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MechanicLoginDto } from './dto/mechanic-login.dto';
import { Public } from './decorators/public.decorator';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register-tenant')
  async registerTenant(@Body() dto: RegisterTenantDto) {
    return this.authService.registerTenant(dto);
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.email, dto.password);
    if (!result) {
      throw new BadRequestException('E-mail ou senha inválidos');
    }
    return result;
  }

  @Public()
  @Post('mechanic-login')
  async mechanicLogin(@Body() dto: MechanicLoginDto) {
    return this.authService.mechanicLogin({
      email: dto.email,
      password: dto.password,
      tenantSlug: dto.tenantSlug,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  async refresh(@Request() req: any) {
    return this.authService.refreshToken(req.user.id);
  }
}
