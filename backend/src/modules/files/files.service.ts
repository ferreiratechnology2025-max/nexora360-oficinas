import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as uuid from 'uuid';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'text/plain',
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const BUCKET = 'order-photos';

@Injectable()
export class FilesService {
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const url = this.config.get<string>('SUPABASE_URL') ?? '';
    // Service key bypasses RLS — required for server-side uploads
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY') ?? this.config.get<string>('SUPABASE_ANON_KEY') ?? '';
    this.supabase = createClient(url, key);
  }

  // ─── Supabase helpers ────────────────────────────────────

  private async uploadToSupabase(
    buffer: Buffer,
    storagePath: string,
    mimeType: string,
  ): Promise<string> {
    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (error) {
      throw new BadRequestException(`Falha no upload para Storage: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    return publicUrl;
  }

  private async removeFromSupabase(storagePath: string): Promise<void> {
    await this.supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  }

  // ─── Upload genérico ─────────────────────────────────────

  async upload(
    file: Express.Multer.File,
    tenantId: string,
    uploadedById: string,
    orderId?: string,
    description?: string,
  ) {
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('O arquivo deve ter no máximo 5MB');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não permitido');
    }

    const ext = path.extname(file.originalname);
    const storagePath = `${tenantId}/${uuid.v4()}${ext}`;
    const buffer = file.buffer ?? Buffer.alloc(0);
    const publicUrl = await this.uploadToSupabase(buffer, storagePath, file.mimetype);

    const record = await this.prisma.file.create({
      data: {
        tenantId,
        originalName: file.originalname,
        fileName: storagePath,
        path: storagePath,
        url: publicUrl,
        size: file.size,
        mimeType: file.mimetype,
        orderId: orderId ?? null,
        description: description ?? null,
        uploadedById,
      },
    });

    return {
      id: record.id,
      originalName: record.originalName,
      fileName: record.fileName,
      url: publicUrl,
      size: record.size,
      mimeType: record.mimeType,
      createdAt: record.createdAt,
    };
  }

  // ─── Upload de foto de OS ────────────────────────────────

  async uploadOrderPhoto(
    file: Express.Multer.File,
    orderId: string,
    stage: string,
    tenantId: string,
    uploadedById: string,
  ) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Apenas imagens são permitidas (JPEG, PNG, WebP)');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Foto deve ter no máximo 5MB');
    }

    const ext = path.extname(file.originalname);
    const storagePath = `${tenantId}/orders/${orderId}/${stage}-${uuid.v4()}${ext}`;
    const buffer = file.buffer ?? Buffer.alloc(0);
    const publicUrl = await this.uploadToSupabase(buffer, storagePath, file.mimetype);

    const record = await this.prisma.file.create({
      data: {
        tenantId,
        originalName: file.originalname,
        fileName: storagePath,
        path: storagePath,
        url: publicUrl,
        size: file.size,
        mimeType: file.mimetype,
        orderId,
        stage,
        uploadedById,
      },
    });

    return {
      id: record.id,
      url: publicUrl,
      stage: record.stage,
      originalName: record.originalName,
      createdAt: record.createdAt,
    };
  }

  // ─── Listar arquivos de OS ───────────────────────────────

  async findFilesByOrder(orderId: string) {
    return this.prisma.file.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Excluir arquivo ─────────────────────────────────────

  async deleteFile(fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Arquivo não encontrado');

    await this.removeFromSupabase(file.path);

    return this.prisma.file.delete({ where: { id: fileId } });
  }

  // ─── Servir arquivo (compat legado) ─────────────────────

  async serveFile(filename: string, response: any) {
    const file = await this.prisma.file.findFirst({
      where: { OR: [{ fileName: filename }, { path: { contains: filename } }] },
    });

    if (file?.url) {
      // Redirect to Supabase public URL
      response.redirect(302, file.url);
      return;
    }

    response.status(404).send('Arquivo não encontrado');
  }
}
