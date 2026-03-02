import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Put,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { OrdersService } from './orders.service';
import { FilesService } from '../files/files.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AdvanceOrderDto } from './dto/advance-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request as ExpressRequest } from 'express';

type AuthUser = { id: string; tenantId: string; role: string };

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly filesService: FilesService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner')
  create(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(req.user.tenantId, dto);
  }

  @Get()
  findAll(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Query('mechanicId') mechanicId?: string,
  ) {
    return this.ordersService.findAll(req.user, mechanicId);
  }

  @Get('number/:number')
  findByNumber(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('number') number: string,
  ) {
    return this.ordersService.findByNumber(number, req.user.tenantId);
  }

  @Get(':id')
  findOne(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.ordersService.findOne(id, req.user);
  }

  @Put(':id')
  update(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('owner')
  async remove(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
  ) {
    try {
      await this.ordersService.remove(id, req.user.tenantId);
      return { message: 'Ordem de serviço removida com sucesso' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /** Mecânico (ou dono) avança o status em um passo */
  @Patch(':id/advance')
  advance(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: AdvanceOrderDto,
  ) {
    return this.ordersService.advance(id, req.user, dto);
  }

  /** Cancelamento exclusivo para o dono */
  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('owner')
  cancel(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.ordersService.cancel(id, req.user.tenantId);
  }

  /**
   * Upload de foto por etapa da OS.
   * stage: checkin | diagnosis | parts | checkout
   */
  @Post(':id/photos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => cb(null, path.join(__dirname, '../../../uploads')),
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `photo-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        cb(allowed.includes(file.mimetype) ? null : new Error('Apenas imagens são permitidas'), allowed.includes(file.mimetype));
      },
    }),
  )
  async uploadPhoto(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('stage') stage: string,
  ) {
    if (!file) throw new BadRequestException('Nenhuma foto enviada');

    const VALID_STAGES = ['checkin', 'diagnosis', 'parts', 'checkout'];
    if (!stage || !VALID_STAGES.includes(stage)) {
      throw new BadRequestException(`stage deve ser um de: ${VALID_STAGES.join(', ')}`);
    }

    // Verify order belongs to this tenant (and mechanic access)
    const order = await this.ordersService.findOne(id, req.user);

    return this.filesService.uploadOrderPhoto(file, order.id, stage, req.user.tenantId, req.user.id);
  }

  // ─── Legacy endpoints ──────────────────────────────────────

  @Post(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('owner')
  completeOrder(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.ordersService.completeOrder(id, req.user.tenantId);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('owner')
  approveOrder(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.ordersService.approve(id, req.user.tenantId);
  }

  @Post(':id/deliver')
  @UseGuards(RolesGuard)
  @Roles('owner')
  deliverOrder(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.ordersService.deliver(id, req.user.tenantId);
  }
}
