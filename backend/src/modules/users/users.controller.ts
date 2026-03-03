import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request as ExpressRequest } from 'express';

type AuthUser = { id: string; tenantId: string; role: string };

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  /** POST /users — cria mecânico (owner only) */
  @Post()
  @Roles('owner')
  create(@Req() req: ExpressRequest & { user: AuthUser }, @Body() dto: CreateUserDto) {
    return this.usersService.create(req.user.tenantId, dto);
  }

  @Get()
  findAll(@Req() req: ExpressRequest & { user: AuthUser }) {
    return this.usersService.findAll(req.user.tenantId);
  }

  /** GET /users/mechanics — lista mecânicos ativos */
  @Get('mechanics')
  findMechanics(@Req() req: ExpressRequest & { user: AuthUser }) {
    return this.usersService.findMechanics(req.user.tenantId);
  }

  /**
   * GET /users/mechanic/performance — KPIs do mecânico logado.
   * Acessível pelo próprio mecânico ou pelo dono.
   */
  @Get('mechanic/performance')
  getMechanicPerformance(@Req() req: ExpressRequest & { user: AuthUser }) {
    return this.usersService.getMechanicPerformance(req.user.tenantId, req.user.id);
  }

  @Get(':id/stats')
  @Roles('owner')
  getMechanicStats(@Req() req: ExpressRequest & { user: AuthUser }, @Param('id') id: string) {
    return this.usersService.getMechanicStats(req.user.tenantId, id);
  }

  @Get(':id')
  findOne(@Req() req: ExpressRequest & { user: AuthUser }, @Param('id') id: string) {
    return this.usersService.findOne(req.user.tenantId, id);
  }

  @Put(':id')
  @Roles('owner')
  update(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(req.user.tenantId, id, dto);
  }

  /** PATCH /users/:id/deactivate — desativa mecânico */
  @Patch(':id/deactivate')
  @Roles('owner')
  deactivate(@Req() req: ExpressRequest & { user: AuthUser }, @Param('id') id: string) {
    return this.usersService.deactivate(req.user.tenantId, id);
  }

  /** PATCH /users/:id/reactivate — reativa mecânico */
  @Patch(':id/reactivate')
  @Roles('owner')
  reactivate(@Req() req: ExpressRequest & { user: AuthUser }, @Param('id') id: string) {
    return this.usersService.reactivate(req.user.tenantId, id);
  }

  @Delete(':id')
  @Roles('owner')
  remove(@Req() req: ExpressRequest & { user: AuthUser }, @Param('id') id: string) {
    return this.usersService.remove(req.user.tenantId, id);
  }
}
