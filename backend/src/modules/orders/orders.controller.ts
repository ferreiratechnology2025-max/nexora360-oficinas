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
import { memoryStorage } from 'multer';
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

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

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
    @Query('status') status?: string,
  ) {
    return this.ordersService.findAll(req.user, mechanicId, status);
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

  // ─── Fotos da OS ───────────────────────────────────────────

  /** Lista todas as fotos de uma OS */
  @Get(':id/photos')
  async getPhotos(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
  ) {
    // Verify access
    await this.ordersService.findOne(id, req.user);
    return this.filesService.findFilesByOrder(id);
  }

  /** Upload de foto (mecânico ou dono). stage é opcional, padrão 'general' */
  @Post(':id/photos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
          return cb(new BadRequestException('Apenas imagens são permitidas (JPEG, PNG, WebP)'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadPhoto(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('stage') stage?: string,
  ) {
    if (!file) throw new BadRequestException('Nenhuma foto enviada');

    const VALID_STAGES = ['checkin', 'diagnosis', 'parts', 'checkout', 'general'];
    const resolvedStage = stage && VALID_STAGES.includes(stage) ? stage : 'general';

    // Verify order belongs to this tenant (and mechanic access)
    const order = await this.ordersService.findOne(id, req.user);

    return this.filesService.uploadOrderPhoto(file, order.id, resolvedStage, req.user.tenantId, req.user.id);
  }

  /** Exclui uma foto de OS */
  @Delete(':id/photos/:fileId')
  async deletePhoto(
    @Req() req: ExpressRequest & { user: AuthUser },
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    // Verify access to the order first
    await this.ordersService.findOne(id, req.user);
    await this.filesService.deleteFile(fileId);
    return { message: 'Foto removida com sucesso' };
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
