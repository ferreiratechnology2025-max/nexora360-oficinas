import {
  Controller, Post, UseInterceptors, UploadedFile,
  BadRequestException, Param, Get, Res, Body, UseGuards,
  HttpException, HttpStatus, Req,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'text/plain',
];

function fileFilter(
  _req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(
      new HttpException(
        'Tipo de arquivo não permitido. Apenas imagens (JPEG, PNG, WebP) e PDFs são permitidos',
        HttpStatus.BAD_REQUEST,
      ),
      false,
    );
  }
  callback(null, true);
}

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('orderId') orderId?: string,
    @Body('description') description?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }
    const tenantId = req.user?.tenantId ?? 'unknown';
    const uploadedById = req.user?.id ?? 'system';
    return this.filesService.upload(file, tenantId, uploadedById, orderId, description);
  }

  /**
   * Retorna redirect 302 para a URL pública do Supabase Storage.
   * Mantido para compatibilidade com links antigos.
   */
  @Get(':filename')
  async getFile(@Param('filename') filename: string, @Res() response: Response) {
    try {
      await this.filesService.serveFile(filename, response);
    } catch {
      response.status(404).json({ error: 'Arquivo não encontrado' });
    }
  }
}
